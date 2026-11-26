"""Live ingest: a conference URL goes through pipeline steps 1-9 (docs/10-ai-operations-plan.md, stream A).

The browser calls one route per step, so no request runs long. State is in memory. Each step records a
steplog row. The last good run per URL is saved in ingest_runs/; if a live step fails, that step is
replayed from the file (mode "replay") so the run still finishes.
"""
import datetime as dt
import json
import re
import sqlite3
import sys
import time
import uuid
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from . import llm, steplog

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "data" / "scripts"))
import ops_setup  # noqa: E402  (fit rules with reasons, copied from simulate.py)
import simulate as sim  # noqa: E402

DB = ROOT / "data" / "micemax.db"
RUNS_DIR = Path(__file__).resolve().parent / "ingest_runs"
TESTED = ["jadm32", "icep2027", "iscnp33", "jos131", "iccdu24"]
STEPS = [  # n, key, agent, tool
    (1, "read", "reader", "llm"), (2, "schedule", "scheduler", "llm"), (3, "sort", "sorter", "llm"),
    (4, "free_time", "scheduler", "rules"), (5, "audience", "audience", "llm"), (6, "filter", "filter", "rules"),
    (7, "build", "builder", "llm"), (8, "rank", "ranker", "llm"), (9, "write", "writer", "llm")]
KINDS = {"early_morning": ["short"], "lunch": ["short"], "free_afternoon": ["short", "specialist"],
         "evening": ["evening"], "after_close": ["short", "evening", "specialist"], "extra_night": ["extra_night"]}
RUNS: dict[str, dict] = {}
router = APIRouter(prefix="/api/ingest")


def db():
    return sqlite3.connect(f"file:{DB}?mode=ro", uri=True)


# ---------- Routes ----------

@router.get("/tested")
def tested():
    with db() as c:
        rows = c.execute(f"SELECT id, name_ja, name_en, website_url FROM conferences WHERE id IN "
                         f"({','.join('?' * len(TESTED))})", TESTED).fetchall()
    return [{"id": i, "name_ja": ja, "name_en": en, "url": u, "recorded": _run_file(u).exists()}
            for i, ja, en, u in sorted(rows, key=lambda r: TESTED.index(r[0]))]


class Start(BaseModel):
    url: str


@router.post("/start")
def start(body: Start):
    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "url must start with http(s)://")
    with db() as c:
        row = c.execute("SELECT id FROM conferences WHERE rtrim(website_url, '/') = rtrim(?, '/')", (url,)).fetchone()
    run_id = uuid.uuid4().hex[:10]
    cid = row[0] if row else "live-" + urlparse(url).netloc
    RUNS[run_id] = {"url": url, "cid": cid, "ctx": {}, "results": {}}
    return {"run_id": run_id, "conference_id": cid, "replay_available": _run_file(url).exists(),
            "steps": [{"n": n, "key": k, "agent": a, "tool": t} for n, k, a, t in STEPS]}


@router.post("/{run_id}/step/{n}")
def step(run_id: str, n: int):
    run = RUNS.get(run_id)
    if not run or not 1 <= n <= 9:
        raise HTTPException(404, "unknown run or step")
    _, key, agent, tool = STEPS[n - 1]
    try:
        t0 = time.time()
        res = FUNCS[n](run["ctx"], run)
        if res["meta"].get("ms") is None:
            res["meta"]["ms"] = int((time.time() - t0) * 1000)
        res |= {"n": n, "key": key, "agent": agent, "tool": tool, "mode": "live"}
        meta = res.pop("meta", {})
        res |= {k: meta.get(k) for k in ("model", "ms", "tokens_in", "tokens_out")}
        steplog.record(run["cid"], agent, res["title_en"], res["title_ja"], res["summary_en"], res["summary_ja"],
                       phase="setup", step=n, tool=tool, meta=meta, confidence=res.get("confidence"),
                       output=res.get("preview"))
    except Exception as e:  # cover a stage failure with the last good run
        saved = _load(run["url"]).get(str(n))
        if not saved:
            raise HTTPException(502, f"step {n} failed: {e}")
        res = saved | {"mode": "replay", "error": str(e)[:200]}
        run["ctx"][n] = res["ctx"]
    run["results"][str(n)] = res
    if n == 9 and all(r["mode"] == "live" for r in run["results"].values()):
        RUNS_DIR.mkdir(exist_ok=True)
        _run_file(run["url"]).write_text(json.dumps(run["results"], ensure_ascii=False, indent=1))
    return {k: v for k, v in res.items() if k != "ctx"}


def _run_file(url: str) -> Path:
    return RUNS_DIR / (re.sub(r"[^a-z0-9]+", "-", url.lower().split("//", 1)[-1]).strip("-") + ".json")


def _load(url: str) -> dict:
    f = _run_file(url)
    return json.loads(f.read_text()) if f.exists() else {}


def out(ctx, n, data, meta, title, summary, counters, preview, confidence=None):
    """Shape one step result; ctx[n] holds what later steps need."""
    ctx[n] = data
    return {"ctx": data, "meta": meta, "title_en": title[0], "title_ja": title[1], "summary_en": summary[0],
            "summary_ja": summary[1], "counters": [{"value": v, "en": e, "ja": j} for v, e, j in counters],
            "preview": preview, "confidence": confidence}


# ---------- Step 1: Read ----------

def page_text(html: str) -> str:
    t = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"&nbsp;|&#160;", " ", t).replace("&amp;", "&").replace("&#39;", "'")
    return re.sub(r"\s+", " ", t).strip()


def fetch_site(url: str) -> tuple[str, list[str]]:
    """Home page plus up to 3 linked program, schedule or venue pages; text truncated."""
    h = {"User-Agent": "Mozilla/5.0 (MiceMax reader)"}
    with httpx.Client(follow_redirects=True, timeout=20, headers=h) as c:
        home = c.get(url)
        home.raise_for_status()
        links = re.findall(r'href="([^"#]+)"[^>]*>(.{0,80}?)</a', home.text, flags=re.S | re.I)
        pick = []
        for href, label in links:
            if re.search(r"program|schedule|overview|timetable|venue|日程|プログラム|開催概要|会場", href + label, re.I):
                u = urljoin(str(home.url), href)
                if u not in pick and u.rstrip("/") != url.rstrip("/") and not u.endswith(".pdf"):
                    pick.append(u)
        texts, pages = [page_text(home.text)[:6000]], [str(home.url)]
        for u in pick[:3]:
            try:
                r = c.get(u)
                if r.status_code == 200 and "html" in r.headers.get("content-type", ""):
                    texts.append(page_text(r.text)[:9000])
                    pages.append(u)
            except httpx.HTTPError:
                pass
    return "\n\n---\n\n".join(texts)[:24000], pages


def linkup(q: str) -> str | None:
    key = llm.env("LINKUP_API_KEY") or llm.env("linkup_key")
    if not key:
        return None
    try:
        r = httpx.post("https://api.linkup.so/v1/search", timeout=30, headers={"Authorization": f"Bearer {key}"},
                       json={"q": q, "depth": "standard", "outputType": "sourcedAnswer"})
        return r.json().get("answer")
    except Exception:
        return None


def s1(ctx, run):
    text, pages = fetch_site(run["url"])
    info, meta = llm.chat_json(
        "You read conference websites. Extract facts stated on the page; use null when not stated.",
        "Return {name_en, name_ja, start_date (YYYY-MM-DD), end_date, venue_en, venue_ja, city, field, "
        f"attendees_expected (int or null)}}.\n\nPAGES:\n{text}")
    gap = [k for k in ("start_date", "end_date", "venue_en") if not info.get(k)]
    filled = None
    if gap and (filled := linkup(f"{info.get('name_en') or run['url']} dates and venue")):
        info2, m2 = llm.chat_json("Fill missing conference facts from this search answer.",
                                  f"Missing: {gap}. Current: {json.dumps(info)}. Answer: {filled}. Return the full object.")
        info, meta = info2, {**meta, "ms": meta["ms"] + m2["ms"]}
    run["text"] = text
    name = info.get("name_en") or info.get("name_ja") or "?"
    return out(ctx, 1, info | {"pages": pages}, meta, ("Read the conference site", "大会サイトを読む"),
               (f"{name}: {info.get('start_date')} to {info.get('end_date')}, {info.get('venue_en')}.",
                f"{info.get('name_ja') or name}：{info.get('start_date')}〜{info.get('end_date')}、"
                f"{info.get('venue_ja') or info.get('venue_en')}。"),
               [(len(pages), "pages read", "ページを読んだ"), (len(text), "characters", "文字")],
               {"facts": {k: info.get(k) for k in ("name_en", "name_ja", "start_date", "end_date", "venue_en",
                                                  "venue_ja", "field", "attendees_expected")},
                "pages": pages, "linkup": bool(filled)})


# ---------- Step 2: Schedule ----------

TYPES = "plenary symposium oral poster sponsor social excursion other".split()


def s2(ctx, run):
    i = ctx[1]
    rows, meta = llm.chat_json(
        "You extract conference programs into rows. Use only sessions stated in the text; never invent.",
        f"Conference {i.get('name_en')} runs {i.get('start_date')} to {i.get('end_date')}. Return "
        '{"sessions": [[day YYYY-MM-DD, start HH:MM, end HH:MM, title_en, title_ja, type]], "note": str}. '
        f"type is one of {TYPES}. If times are missing, skip the row. At most 80 rows, main blocks first. "
        f"note says in one short sentence how complete the published program is.\n\nTEXT:\n{run.get('text', '')[:18000]}",
        max_tokens=6000)
    keys = ("day", "start_time", "end_time", "title_en", "title_ja", "type")
    ses = [dict(zip(keys, r)) for r in rows.get("sessions", []) if isinstance(r, list) and len(r) >= 6]
    ses = [s for s in ses if re.fullmatch(r"\d\d:\d\d", str(s["start_time"])) and re.fullmatch(r"\d\d:\d\d", str(s["end_time"]))]
    source, n_site = "site", len(ses)
    if n_site < 5:  # program not published yet: use the stored one (last edition moved to the new dates)
        with db() as c:
            stored = c.execute(f"SELECT {','.join(keys)} FROM sessions WHERE conference_id = ? ORDER BY day, "
                               "start_time", (run["cid"],)).fetchall()
        if stored:
            ses, source = [dict(zip(keys, r)) for r in stored], "stored"
    days = sorted({s["day"] for s in ses})
    src_en = (f" The site lists {n_site}; using the stored program (last edition moved to the new dates)."
              if source == "stored" else "")
    src_ja = f"サイト掲載は{n_site}件のため、保存済みプログラム（前回大会を新しい日付に移したもの）を使用。" if source == "stored" else ""
    return out(ctx, 2, {"sessions": ses, "note": rows.get("note")}, meta, ("Extract the schedule", "プログラムを取り出す"),
               (f"{len(ses)} sessions over {len(days)} days.{src_en} {rows.get('note') or ''}",
                f"{len(days)}日間で{len(ses)}セッション。{src_ja}"),
               [(len(ses), "sessions", "セッション"), (len(days), "days", "日")],
               {"sessions": ses[:8], "note": rows.get("note"), "source": source, "on_site": n_site})


# ---------- Step 3: Sort sessions ----------

def s3(ctx, run):
    ses = ctx[2]["sessions"]
    if not ses:
        raise RuntimeError("no sessions to sort")
    res, meta = llm.chat_json(
        "You judge which conference sessions most attendees must attend and which they can skip.",
        'Return {"must": [row indexes], "confidence": 0-1, "why_en": str, "why_ja": str}. Plenaries, '
        "keynotes, opening and award sessions are usually must-attend; parallel orals and posters skippable.\n"
        + "\n".join(f"{k}: {s['day']} {s['start_time']}-{s['end_time']} {s['type']} {s['title_en']}"
                    for k, s in enumerate(ses)))
    must = {k for k in res.get("must", []) if isinstance(k, int) and 0 <= k < len(ses)}
    for k, s in enumerate(ses):
        s["must"] = k in must
    conf = res.get("confidence")
    return out(ctx, 3, {"must": sorted(must)}, meta, ("Sort the sessions", "セッションを分類"),
               (f"{len(must)} must-attend, {len(ses) - len(must)} skippable. {res.get('why_en', '')}",
                f"必須{len(must)}件、抜けられる{len(ses) - len(must)}件。{res.get('why_ja', '')}"),
               [(len(must), "must-attend", "必須"), (len(ses) - len(must), "skippable", "抜けられる")],
               {"must": [ses[k]["title_en"] for k in sorted(must)][:6], "why_en": res.get("why_en"),
                "why_ja": res.get("why_ja")}, conf)


# ---------- Step 4: Free time ----------

def hm(m):
    return f"{m // 60:02d}:{m % 60:02d}"


def mins(s):
    h, m = map(int, s.split(":"))
    return h * 60 + m


def rule_windows(info, ses):
    """Gaps between sessions (drop-in posters and exhibits ignored). Days with no published sessions assume 09:00-18:00."""
    d0, d1 = dt.date.fromisoformat(info["start_date"]), dt.date.fromisoformat(info["end_date"])
    out_ = []
    for k in range((d1 - d0).days + 1):
        day = (d0 + dt.timedelta(days=k)).isoformat()
        busy = sorted((mins(s["start_time"]), mins(s["end_time"])) for s in ses if s["day"] == day
                      and mins(s["end_time"]) - mins(s["start_time"]) < sim.DROP_IN_MIN)
        busy = busy or [(540, 1080)]
        merged = [list(busy[0])]
        for a, b in busy[1:]:
            if a <= merged[-1][1] + 15:
                merged[-1][1] = max(merged[-1][1], b)
            else:
                merged.append([a, b])
        if merged[0][0] - 30 - 390 >= 60:
            gap = merged[0][0] - 30 - 390
            out_.append((day, 390, merged[0][0] - 30, "early_morning" if gap < 240 else "free_afternoon"))
        for (_, b), (a, _) in zip(merged, merged[1:]):
            if a - b >= 60:
                out_.append((day, b, a, "lunch" if 660 <= b <= 840 else "free_afternoon"))
        last = merged[-1][1]
        if day == info["end_date"]:
            out_.append((day, last, max(last, 1320), "after_close"))
            out_.append((day, last, last, "extra_night"))
        elif 1380 - (last + 30) >= 90:
            out_.append((day, last + 30, 1380, "evening"))
    return [{"day": d, "start_time": hm(a), "end_time": hm(b), "kind": kd, "plan_kinds": KINDS[kd]}
            for d, a, b, kd in out_]


def s4(ctx, run):
    info, ses = ctx[1], ctx[2]["sessions"]
    wins = rule_windows(info, ses)
    res, meta = llm.chat_json(
        "You check free-time windows at a conference. For each, decide if attendees are really free. Drop one only if a must-attend session or a fixed event clearly fills it.",
        'Return {"windows": [{"i": int, "keep": bool, "confidence": 0-1, "name_en": short, "name_ja": short, '
        '"reason_en": short}]}.\nSESSIONS:\n'
        + "\n".join(f"{s['day']} {s['start_time']}-{s['end_time']} {'MUST ' if s.get('must') else ''}{s['title_en']}"
                    for s in ses if s.get("must") or s["type"] in ("plenary", "social", "excursion"))
        + "\nWINDOWS (extra_night means staying one more night after the close):\n"
        + "\n".join(f"{k}: {w['day']} {w['start_time']}-{w['end_time']} {w['kind']}" for k, w in enumerate(wins)))
    checks = {c.get("i"): c for c in res.get("windows", []) if isinstance(c, dict)}
    kept, dropped = [], []
    for k, w in enumerate(wins):
        c = checks.get(k, {})
        w |= {"id": f"w{k + 1}", "name_en": c.get("name_en") or w["kind"], "name_ja": c.get("name_ja") or w["kind"],
              "confidence": c.get("confidence"), "reason_en": c.get("reason_en")}
        (kept if c.get("keep", True) or w["kind"] == "extra_night" else dropped).append(w)
    confs = [w["confidence"] for w in kept if isinstance(w["confidence"], (int, float))]
    conf = round(sum(confs) / len(confs), 2) if confs else None
    return out(ctx, 4, {"windows": kept}, meta, ("Find free time", "空き時間を見つける"),
               (f"Rules found {len(wins)} windows; the check kept {len(kept)}.",
                f"ルールで{len(wins)}枠、確認後{len(kept)}枠。"),
               [(len(kept), "windows", "空き時間"), (len(dropped), "dropped by check", "確認で除外")],
               {"windows": [{k: w[k] for k in ("day", "start_time", "end_time", "kind", "name_en", "name_ja",
                                               "confidence", "reason_en")} for w in kept],
                "dropped": [{k: w[k] for k in ("day", "start_time", "end_time", "name_en", "reason_en")}
                            for w in dropped]}, conf)


# ---------- Step 5: Audience ----------

def s5(ctx, run):
    with db() as c:
        vocab = sorted({f for (r,) in c.execute("SELECT fields FROM experiences WHERE fields IS NOT NULL")
                        for f in json.loads(r)})
    info = ctx[1]
    res, meta = llm.chat_json(
        "You estimate who attends a conference from its name and field.",
        f"Conference: {info.get('name_en')} ({info.get('field')}). Return {{\"fields\": [subset of {vocab}], "
        '"roles": {"academic_researcher": share, "industry_engineer": share, "student": share, "clinician": share}, '
        '"overseas_share": 0-1, "interests": [up to 4 of food, drinks, onsen, nature, culture, shopping, running], '
        '"confidence": 0-1, "summary_en": one sentence, "summary_ja": one sentence}.')
    fields = [f for f in res.get("fields", []) if f in vocab]
    return out(ctx, 5, {"fields": fields, "interests": res.get("interests")}, meta, ("Estimate the audience", "参加者像を推定"),
               (res.get("summary_en", ""), res.get("summary_ja", "")),
               [(len(fields), "matching fields", "分野タグ"), (f"{round((res.get('overseas_share') or 0) * 100)}%",
                                                          "from overseas (estimate)", "海外から（推定）")],
               {"fields": fields, "roles": res.get("roles"), "interests": res.get("interests")}, res.get("confidence"))


# ---------- Step 6: Filter (the guardrail) ----------

def load_exps(cid):
    with db() as c:
        c.row_factory = lambda cur, r: {d[0]: v for d, v in zip(cur.description, r)}
        venue = (c.execute("SELECT place_id FROM conference_venues WHERE conference_id = ? ORDER BY is_main DESC",
                           (cid,)).fetchone() or {}).get("place_id", "scc")
        exps = c.execute("""SELECT e.*, t.minutes AS travel FROM experiences e LEFT JOIN experience_travel t
            ON t.experience_id = e.id AND t.venue_place_id = ? ORDER BY e.id""", (venue,)).fetchall()
        c.row_factory = None
        titles = ops_setup.titles(c)
    for e in exps:
        e["months"] = json.loads(e["months"]) if e["months"] else None
        e["fields"] = set(json.loads(e["fields"])) if e["fields"] else set()
        e["title_en"], e["title_ja"] = titles.get(e["id"], {}).get("en"), titles.get(e["id"], {}).get("ja")
    return exps


def s6(ctx, run):
    exps, C = load_exps(run["cid"]), {"fields": set(ctx[5]["fields"])}
    res, n_fit, n_out = [], 0, 0
    for w in ctx[4]["windows"]:
        ww = w | {"kinds": w["plan_kinds"], "start": sim.at(w["day"], w["start_time"]),
                  "end": sim.at(w["day"], w["end_time"])}
        free = 9999 if w["kind"] == "extra_night" else (ww["end"] - ww["start"]).total_seconds() / 60
        fit, ruled = [], []
        for e in exps:
            r = ops_setup.why_not(e, ww, free, C)
            if r is None:
                fit.append({"id": e["id"], "kind": e["kind"], "title_en": e["title_en"], "title_ja": e["title_ja"]})
            elif r[0] != "kind":
                ruled.append({"id": e["id"], "title_en": e["title_en"], "title_ja": e["title_ja"], "reason": r[0],
                              "why_en": r[2], "why_ja": r[1]})
        n_fit, n_out = n_fit + len(fit), n_out + len(ruled)
        res.append({"window": w["id"], "name_en": w["name_en"], "name_ja": w["name_ja"], "day": w["day"],
                    "start": w["start_time"], "end": w["end_time"], "fits": fit, "ruled_out": ruled})
    sample = max(res, key=lambda r: len(r["ruled_out"]) + len(r["fits"]), default=None)
    return out(ctx, 6, {"windows": res}, {"model": None, "ms": None}, ("Check experiences against free time",
                                                                       "体験を空き時間で照合"),
               (f"{n_fit} fits across {len(res)} windows; {n_out} ruled out by opening hours, season, travel "
                f"or last start.", f"{len(res)}枠で{n_fit}件が合う。{n_out}件を営業時間、季節、移動、最終開始で除外。"),
               [(len(exps), "experiences checked", "照合した体験"), (n_fit, "accepted", "採用"),
                (n_out, "rejected", "除外")],
               {"sample": sample and sample | {"fits": sample["fits"][:6], "ruled_out": sample["ruled_out"][:6]},
                "per_window": [{"name_en": r["name_en"], "name_ja": r["name_ja"], "fits": len(r["fits"]),
                                "ruled_out": len(r["ruled_out"])} for r in res]})


# ---------- Step 7: Build ----------

def s7(ctx, run):
    fits = {r["window"]: r for r in ctx[6]["windows"]}
    known = {e["id"] for r in fits.values() for e in r["fits"] + r["ruled_out"]}
    catalog = "\n".join(f"{r['window']} {r['name_en']} {r['day']} {r['start']}-{r['end']}: "
                        + "; ".join(f"{e['id']} {e['title_en']}" for e in r["fits"][:12]) for r in fits.values())
    res, meta = llm.chat_json(
        "You design add-on experiences for conference attendees in Hokkaido. Propose freely, including ideas "
        "outside the list that you think attendees would love; a checker will verify them.",
        'Return {"ideas": [{"window": window id, "title_en": str, "title_ja": str, "experience_ids": [ids from '
        'the list, or [] if the idea is not in the list], "why_en": short}]} with 6 ideas: 4 from the list '
        f"(combos welcome) and 2 well-known Hokkaido ideas not in the list.\nLIST:\n{catalog}")
    ok, bad = [], []
    for idea in res.get("ideas", []):
        ids, w = idea.get("experience_ids") or [], fits.get(idea.get("window"))
        fit_ids = {e["id"] for e in (w or {}).get("fits", [])}
        if not ids or any(i not in known for i in ids):
            idea["reject_en"], idea["reject_ja"] = "not in our data", "データにない"
        elif not w:
            idea["reject_en"], idea["reject_ja"] = "unknown window", "空き時間が不明"
        elif miss := [i for i in ids if i not in fit_ids]:
            why = next((e for e in w["ruled_out"] if e["id"] == miss[0]), None)
            idea["reject_en"] = why["why_en"] if why else "doesn't fit this window"
            idea["reject_ja"] = why["why_ja"] if why else "この空き時間に合わない"
        (bad if "reject_en" in idea else ok).append(idea)
    return out(ctx, 7, {"ideas": ok}, meta, ("Build experiences", "体験を組み立てる"),
               (f"AI proposed {len(ok) + len(bad)} ideas; the check kept {len(ok)} and rejected {len(bad)}.",
                f"AIの提案{len(ok) + len(bad)}件、採用{len(ok)}件、却下{len(bad)}件。"),
               [(len(ok), "ideas kept", "採用"), (len(bad), "rejected by check", "却下")],
               {"kept": ok, "rejected": bad})


# ---------- Step 8: Rank ----------

def s8(ctx, run):
    wins = [r for r in ctx[6]["windows"] if r["fits"]]
    res, meta = llm.chat_json(
        "You rank experiences for conference attendees. Use only the ids given.",
        f"Conference: {ctx[1].get('name_en')}. Audience fields: {ctx[5]['fields']}. Interests: "
        f"{ctx[5].get('interests')}. Confidence is how sure you are these suit this audience. Return {{\"top\": [{{\"window\": id, \"ids\": [up to 3 ids], "
        '"confidence": 0-1}]}.\n' + "\n".join(f"{r['window']} {r['name_en']}: " + "; ".join(
            f"{e['id']} {e['title_en']}" for e in r["fits"][:15]) for r in wins))
    by = {r["window"]: r for r in wins}
    top = []
    for t in res.get("top", []):
        r = by.get(t.get("window"))
        if not r:
            continue
        ok = {e["id"]: e for e in r["fits"]}
        picks = [ok[i] for i in t.get("ids", []) if i in ok][:3]
        if picks:
            top.append({"window": r["window"], "name_en": r["name_en"], "name_ja": r["name_ja"], "picks": picks,
                        "confidence": t.get("confidence"),
                        "needs_approval": (t.get("confidence") or 0) < 0.6})
    confs = [t["confidence"] for t in top if isinstance(t["confidence"], (int, float))]
    flag = sum(t["needs_approval"] for t in top)
    return out(ctx, 8, {"top": top}, meta, ("Rank the top 3 per window", "空き時間ごとに上位3件"),
               (f"Top picks for {len(top)} windows; {flag} flagged for the organizer to approve.",
                f"{len(top)}枠で上位を選定、{flag}枠は主催者の承認待ち。"),
               [(len(top), "windows ranked", "選定した枠"), (flag, "need approval", "承認待ち")],
               {"top": top}, round(sum(confs) / len(confs), 2) if confs else None)


# ---------- Step 9: Write ----------

def s9(ctx, run):
    info, top = ctx[1], ctx[8]["top"]
    picks = "\n".join(f"{t['name_en']}: " + "; ".join(p["title_en"] or p["id"] for p in t["picks"]) for t in top)
    res, meta = llm.chat_json(
        "You write short, warm copy for a conference's free-time page and an email to the organizer.",
        f"Conference: {info.get('name_en')} / {info.get('name_ja')}, {info.get('start_date')} to "
        f"{info.get('end_date')}, {info.get('venue_en')}.\nPicks:\n{picks}\nReturn {{\"intro_en\": 2 sentences, "
        '"intro_ja": 2 sentences, "email_en": {"subject": str, "body": under 120 words}, '
        '"email_ja": {"subject": str, "body": under 250 characters}}. Natural Japanese, not translated-sounding.')
    return out(ctx, 9, res, meta, ("Write JA/EN copy", "日英の紹介文を書く"),
               ("Page intro and organizer email written in Japanese and English.",
                "ページ紹介文と主催者向けメールを日本語と英語で作成。"),
               [(2, "languages", "言語"), (2, "texts", "文書")], res)


FUNCS = {1: s1, 2: s2, 3: s3, 4: s4, 5: s5, 6: s6, 7: s7, 8: s8, 9: s9}
