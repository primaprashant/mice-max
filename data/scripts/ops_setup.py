"""Setup rows (pipeline steps 1-9) for agent_steps, built only from data agents already made (T3-T6).

Counts and short samples go in the JA/EN summaries, details in output. No timings, tokens or confidence:
they were not measured. Step 6 reruns simulate.py's fit rules and keeps the reason for each experience ruled out.
"""
import datetime as dt
import json
from collections import Counter

import simulate as sim

ROLE_LABELS = {"industry_engineer": ("企業の技術者", "Industry engineers"),
               "academic_researcher": ("大学・研究機関の研究者", "Academic researchers"),
               "student": ("学生", "Students"), "exhibitor_staff": ("出展企業スタッフ", "Exhibitor staff")}
TYPE_LABELS = {"plenary": ("全体講演", "plenary"), "symposium": ("シンポジウム", "symposium"), "oral": ("口演", "oral"),
               "poster": ("ポスター", "poster"), "sponsor": ("共催セミナー", "sponsor"), "social": ("懇親会", "social"),
               "excursion": ("見学会", "excursion"), "other": ("その他", "other")}
KIND_LABELS = {"short": ("短時間", "short"), "evening": ("夜", "evening"), "extra_night": ("延泊", "extra night"),
               "specialist": ("専門見学", "specialist")}
WINDOW_LABELS = {"early_morning": ("早朝", "early morning"), "lunch": ("昼", "lunch"), "evening": ("夜", "evening"),
                 "free_afternoon": ("午後", "free afternoon"), "during_program": ("会期中", "during the program"),
                 "after_close": ("閉会後", "after the close"), "extra_night": ("延泊", "extra night")}
MONTHS_EN = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def why_not(e, w, free, C):
    """Copy of simulate.fits that returns (reason, detail_ja, detail_en) instead of False, or None if it fits.
    Experiences of a kind the window doesn't offer return 'kind' and are not listed."""
    m = w["start"].month
    if e["kind"] not in w["kinds"]:
        return "kind", "", ""
    if e["months"] and m not in e["months"]:
        return "month", f"{m}月は実施していない", f"not offered in {MONTHS_EN[m - 1]}"
    if e["kind"] == "specialist" and not e["fields"] & C["fields"]:
        return "field", "この分野向けではない", "not for this field"
    if e["kind"] == "extra_night":
        if free > 0 and not (e["start_until"] and w["start"] > sim.at(w["day"], e["start_until"])):
            return None
        return ("leave_by", f"{e['start_until']}までに札幌を出る必要がある",
                f"must leave Sapporo by {e['start_until']}")
    need, travel = e["duration_min"] or sim.DEFAULT_MIN[e["kind"]], e["travel"] or sim.DEFAULT_TRAVEL
    if need + 2 * travel > free:
        return ("too_long", f"往復込みで{need + 2 * travel}分必要、空きは{free:.0f}分",
                f"needs {need + 2 * travel} min with travel, window has {free:.0f}")
    begin = w["start"] + dt.timedelta(minutes=travel)
    if e["start_from"]:
        begin = max(begin, sim.at(w["day"], e["start_from"]))
    if e["start_until"] and begin > sim.at(w["day"], e["start_until"]):
        return ("closed", f"着くのは{begin:%H:%M}、開始は{e['start_until']}まで",
                f"arrives {begin:%H:%M}, last start {e['start_until']}")
    if begin + dt.timedelta(minutes=need + travel) > w["end"]:
        return ("ends_late", f"開始が{begin:%H:%M}になり、{w['end_time']}までに戻れない",
                f"can't start before {begin:%H:%M}, so not back by {w['end_time']}")
    return None


def titles(db):
    rows = db.execute("SELECT experience_id, lang, card_title FROM experience_copy").fetchall()
    out = {}
    for eid, lang, t in rows:
        out.setdefault(eid, {})[lang] = t
    return out


def filter_windows(db, C):
    """Step 6: per window, the experiences that fit and the ones ruled out with a reason."""
    T = titles(db)
    out, reasons = [], Counter()
    for w in C["windows"]:
        free = 9999 if w["kind"] == "extra_night" else (w["end"] - w["start"]).total_seconds() / 60
        fit, ruled = [], []
        for e in C["exps"]:
            r = why_not(e, w, free, C)
            if r is None:
                fit.append(e["id"])
            elif r[0] != "kind":
                reasons[r[0]] += 1
                ruled.append({"experience_id": e["id"], "title_ja": T.get(e["id"], {}).get("ja"),
                              "title_en": T.get(e["id"], {}).get("en"), "reason": r[0], "why_ja": r[1],
                              "why_en": r[2]})
        out.append({"window_id": w["id"], "name_ja": w["name_ja"], "name_en": w["name_en"], "day": w["day"],
                    "start": w["start_time"], "end": w["end_time"], "fits": fit, "ruled_out": ruled})
    return out, reasons


REASON_LABELS = {"month": ("季節外", "out of season"), "field": ("分野違い", "wrong field"),
                 "leave_by": ("出発に間に合わない", "too late to leave"), "too_long": ("時間が足りない", "too long"),
                 "closed": ("開始時刻に間に合わない", "too late to start"), "ends_late": ("戻りが遅れる", "back too late")}


def rows(db, cid, ts):
    C = sim.load_conference(db, cid)
    conf, sessions, windows = C["conf"], C["sessions"], C["windows"]
    venue_ja, venue_en = db.execute("""SELECT p.name_ja, p.name_en FROM conference_venues v JOIN places p
        ON p.id = v.place_id WHERE v.conference_id = ? ORDER BY v.is_main DESC""", (cid,)).fetchone()
    name_ja = conf["name_ja"] or conf["name_en"]
    days = sorted({s["day"] for s in sessions})
    basis = Counter(s["basis"] for s in sessions)
    types = Counter(s["type"] for s in sessions)
    kinds = Counter(w["kind"] for w in windows)
    overlap = [w for w in windows if w["overlaps_program"]]
    filt, reasons = filter_windows(db, C)
    n_fit, n_out = sum(len(f["fits"]) for f in filt), sum(len(f["ruled_out"]) for f in filt)
    T = titles(db)
    exps = db.execute("SELECT id, kind, is_combo, fields FROM experiences").fetchall()
    spec = [e for e, k, _, f in exps if k == "specialist" and set(json.loads(f or "[]")) & C["fields"]]
    heads = db.execute("""SELECT h.kind, h.experience_id, h.window_id, h.start_time, h.people_min, h.people_max,
        w.name_ja, w.name_en FROM headlines h JOIN windows w ON w.id = h.window_id WHERE h.conference_id = ?
        ORDER BY h.kind""", (cid,)).fetchall()
    copy = db.execute("SELECT lang, count(*), sum(checked_by_human) FROM experience_copy GROUP BY lang").fetchall()
    n_copy = min(n for _, n, _ in copy)
    mix = json.loads(conf["attendee_mix"] or "{}")
    role_names = {r["role"]: (r.get("name_ja"), r.get("name_en")) for r in mix.get("roles") or []
                  if isinstance(r, dict)}
    roles = sorted(C["roles"].items(), key=lambda r: -r[1])
    label = lambda r: role_names.get(r) or ROLE_LABELS.get(r) or (r, r.replace("_", " "))
    top = roles[:3]
    sample_s = [s for s in sessions if s["type"] in ("plenary", "symposium")][:3]
    pct = lambda x: f"{x * 100:.0f}%"
    jt = lambda counter, labels: "、".join(f"{labels[k][0]}{n}" for k, n in counter.most_common())
    et = lambda counter, labels: ", ".join(f"{n} {labels[k][1]}" for k, n in counter.most_common())

    def row(step, agent, tool, tja, ten, sja, sen, output):
        return {"id": f"{cid}-setup-{step:02d}", "conference_id": cid, "phase": "setup", "ts": ts, "step": step,
                "agent": agent, "tool": tool, "title_ja": tja, "title_en": ten, "summary_ja": sja,
                "summary_en": sen, "output": output, "simulated": 0}

    moved_ja = f"（{basis['moved_from_last']}件は前回大会の日程を新しい日付に移したもの）" if basis["moved_from_last"] else ""
    moved_en = f" ({basis['moved_from_last']} moved from last edition's program to the new dates)" \
        if basis["moved_from_last"] else ""
    return [
        row(1, "reader", "search", "大会サイトを読む", "Read the conference site",
            f"{name_ja}：{conf['start_date']}〜{conf['end_date']}、{venue_ja}、参加見込み{conf['attendees']:,}人。",
            f"{conf['name_en']}: {conf['start_date']} to {conf['end_date']}, {venue_en}, "
            f"about {conf['attendees']:,} attendees expected.",
            {k: conf[k] for k in ("name_ja", "name_en", "start_date", "end_date", "attendees", "attendees_kind",
                                  "field", "field_detail", "scope", "website_url", "source_url")}
            | {"venue_ja": venue_ja, "venue_en": venue_en}),
        row(2, "scheduler", "llm", "プログラムを取り出す", "Extract the schedule",
            f"{len(days)}日間で{len(sessions)}セッション{moved_ja}。",
            f"{len(sessions)} sessions over {len(days)} days{moved_en}.",
            {"sessions": len(sessions), "days": days, "basis": dict(basis),
             "samples": [{k: s[k] for k in ("day", "start_time", "end_time", "title_ja", "title_en", "type")}
                         for s in sample_s]}),
        row(3, "sorter", "llm", "セッションを分類", "Sort the sessions",
            f"種類別：{jt(types, TYPE_LABELS)}。{len(overlap)}の空き時間は、参加者が抜けられるセッションと重なる。",
            f"By type: {et(types, TYPE_LABELS)}. {len(overlap)} windows run alongside sessions attendees may skip.",
            {"types": dict(types), "skippable_alongside": [
                {"window_id": w["id"], "name_en": w["name_en"], "runs_alongside": w["overlap_note"]} for w in overlap]}),
        row(4, "scheduler", "rules", "空き時間を見つける", "Find free time",
            f"空き時間{len(windows)}枠：{jt(kinds, WINDOW_LABELS)}。例：{windows[0]['name_ja']} "
            f"{windows[0]['start_time']}〜{windows[0]['end_time']}。",
            f"{len(windows)} free-time windows: {et(kinds, WINDOW_LABELS)}. "
            f"E.g. {windows[0]['name_en']} {windows[0]['start_time']}-{windows[0]['end_time']}.",
            {"windows": [{k: w[k] for k in ("id", "day", "start_time", "end_time", "kind", "name_ja", "name_en",
                                             "overlaps_program", "checked_by_human")} for w in windows]}),
        row(5, "audience", "llm", "参加者像を推定", "Estimate the audience",
            "主な参加者（推定）："
            + "、".join(f"{label(r)[0]}{pct(s)}" for r, s in top) + f"。海外から約{pct(C['overseas'])}。",
            f"Field: {conf['field_detail'] or conf['field']}. Main attendees (estimate): "
            + ", ".join(f"{label(r)[1]} {pct(s)}" for r, s in top) + f". About {pct(C['overseas'])} from overseas.",
            {"field": conf["field"], "field_detail": conf["field_detail"], "roles": dict(roles),
             "overseas_share": round(C["overseas"], 3), "is_estimate": True}),
        row(6, "filter", "graph", "体験を空き時間で絞り込む", "Filter experiences by free time",
            f"{len(windows)}枠で{n_fit}件が合う。{n_out}件を除外："
            + "、".join(f"{REASON_LABELS[k][0]}{n}" for k, n in reasons.most_common()) + "。",
            f"{n_fit} experience fits across {len(windows)} windows. {n_out} ruled out: "
            + ", ".join(f"{REASON_LABELS[k][1]} {n}" for k, n in reasons.most_common()) + ".",
            {"reasons": dict(reasons), "windows": filt}),
        row(7, "builder", "llm", "体験を組み立てる", "Build experiences",
            f"体験{len(exps)}件（組み合わせ{sum(c for _, _, c, _ in exps)}件）。この分野向けの専門見学{len(spec)}件。",
            f"{len(exps)} experiences ({sum(c for _, _, c, _ in exps)} combos). "
            f"{len(spec)} specialist visits suit this field.",
            {"experiences": len(exps), "combos": sum(c for _, _, c, _ in exps), "specialist_for_field": spec}),
        row(8, "ranker", "llm", "注目の体験を選ぶ", "Pick the headline experiences",
            "種類ごとに1件、事実を人が確認：" + "、".join(
                f"{T.get(h[1], {}).get('ja', h[1])}（{h[6]}）" for h in heads) + "。",
            "One per kind, facts checked by a person: " + "; ".join(
                f"{T.get(h[1], {}).get('en', h[1])} ({h[7]})" for h in heads) + ".",
            {"headlines": [dict(zip(("kind", "experience_id", "window_id", "start_time", "people_min", "people_max"),
                                    h[:6])) for h in heads]}),
        row(9, "writer", "llm", "日英の紹介文を書く", "Write JA/EN copy",
            f"体験{n_copy}件の紹介文を日本語と英語で、空き時間の名前{len(windows)}件。",
            f"Card copy for {n_copy} experiences in JA and EN, plus {len(windows)} window names.",
            {"copy": {l: {"rows": n, "checked_by_human": h} for l, n, h in copy},
             "sample": {"ja": T.get(heads[0][1], {}).get("ja"), "en": T.get(heads[0][1], {}).get("en")}
             if heads else None}),
    ]
