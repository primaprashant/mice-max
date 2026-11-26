"""Live disruption: a simulated heavy-snow bus alert, then real agent steps to replan (docs/10, stream B).

POST /api/disruption/{cid}          all six steps at once
POST /api/disruption/{cid}/find     steps 1-3 (alert, affected, alternatives); returns run_id
POST /api/disruption/{cid}/replan   step 4 (picks) for that run_id
POST /api/disruption/{cid}/write    steps 5-6 (messages, ryokan call)
Affected attendees and alternatives come from Neo4j Aura; SQLite is the fallback (tool label says which)."""
import json
import os
import sqlite3
import time
import uuid
from collections import defaultdict
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from . import steplog
from .llm import FAST, chat_json, env

router = APIRouter()
DATA = Path(__file__).resolve().parents[3] / "data"
DB_PATH = Path(os.environ.get("MICEMAX_DB") or DATA / "micemax.db")
AGENT = "disruption"
_RUNS: dict[str, dict] = {}

AFFECTED = """MATCH (a:Attendee)-[j:JOINED]->(e:Experience)-[:HAS_STOP]->(:Plan)-[:AT]->(:Place)-[:IN_AREA]->(:Place {id: $area})
WHERE j.window_id = $window AND NOT j.cancelled
RETURN DISTINCT a.id AS attendee_id, a.name_ja AS name_ja, a.name_en AS name_en, a.language AS language,
       j.party_size AS party_size, j.booked AS booked, e.id AS experience_id ORDER BY attendee_id"""

ALTERNATIVES = """MATCH (e:Experience)-[f:FITS]->(:Window {id: $window})
WHERE NOT EXISTS { (e)-[:HAS_STOP]->(:Plan)-[:AT]->(:Place)-[:IN_AREA]->(:Place {id: $area}) }
RETURN e.id AS id, f.travel_min AS travel_min ORDER BY id"""

PICK = """You replan group trips after a simulated heavy-snow alert. Use only the facts given; never add prices,
times, routes or availability that are not there. For each affected experience pick one alternative from the list.
Snow may also slow road buses, so prefer options reached by train and close in price and feel. Rooms still have to be checked.
Return {"picks": [{"from_experience_id": "", "to_experience_id": "", "confidence": 0.0-1.0,
 "why_ja": "", "why_en": ""}]} with one or two short sentences per reason."""

WRITE = """Write short, kind messages to attendees whose trip changed after a simulated heavy-snow alert.
One message per group. Say what changed, the new plan and that rooms are still being confirmed. Use only the facts
given. Natural polite Japanese, then a faithful English version. Start with 【模擬警報】 / [Simulated alert].
Return {"messages": [{"experience_id": "", "ja": "", "en": ""}]}"""


def _db():
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _neo4j(query: str, **params) -> list[dict]:
    import neo4j
    if not env("NEO4J_URI"):
        raise RuntimeError("NEO4J_URI not set")
    with neo4j.GraphDatabase.driver(env("NEO4J_URI"), auth=(env("NEO4J_USERNAME"), env("NEO4J_PASSWORD")),
                                    connection_timeout=8) as d:
        return [dict(r) for r in d.execute_query(query, database_=env("NEO4J_DATABASE"), **params).records]


def _sqlite_affected(db, cid, wid, in_area) -> list[dict]:
    """Same joins the graph has (build_graph.joins), read from the event log."""
    seen = defaultdict(lambda: {"party_size": None, "booked": False, "cancelled": False})
    for r in db.execute("""SELECT attendee_id, experience_id, event_type, party_size FROM events
            WHERE conference_id = ? AND window_id = ? AND event_type IN ('plan_joined','plan_booked','plan_cancelled')
            ORDER BY ts, event_id""", (cid, wid)):
        k = (r["attendee_id"], r["experience_id"])
        if r["event_type"] == "plan_joined":
            seen[k]["party_size"] = r["party_size"]
        elif k in seen:
            seen[k]["booked" if r["event_type"] == "plan_booked" else "cancelled"] = True
    out = []
    for (aid, eid), v in sorted(seen.items()):
        if eid in in_area and v["party_size"] and not v["cancelled"]:
            a = db.execute("SELECT name_ja, name_en, language FROM attendees WHERE id = ?", (aid,)).fetchone()
            out.append({"attendee_id": aid, **dict(a), "party_size": v["party_size"], "booked": v["booked"],
                        "experience_id": eid})
    return out


def _sqlite_alternatives(db, cid, kind, month, in_area) -> list[dict]:
    """Simplified fit: same kind, runs that month, outside the area. Saved list for this conference if there is one."""
    saved = DATA / "raw" / "ops" / cid / "disruption.json"
    if saved.exists():
        return [{"id": i, "travel_min": None} for i in json.loads(saved.read_text())["alternatives"]]
    return [{"id": r["id"], "travel_min": None} for r in db.execute("SELECT id, months FROM experiences WHERE kind = ?", (kind,))
            if r["id"] not in in_area and (not r["months"] or month in json.loads(r["months"]))]


def _copy(db, ids) -> dict:
    out = {}
    for r in db.execute(f"SELECT experience_id, lang, card_title, included, good_to_know FROM experience_copy "
                        f"WHERE experience_id IN ({','.join('?' * len(ids))})", list(ids)):
        out.setdefault(r["experience_id"], {})[r["lang"]] = {
            "title": r["card_title"], "included": r["included"], "good_to_know": r["good_to_know"]}
    return out


def find(cid: str) -> dict:
    with _db() as db:
        h = db.execute("""SELECT h.experience_id, h.window_id, e.kind, w.day, w.start_time, w.end_time, w.name_ja, w.name_en
            FROM headlines h JOIN experiences e ON e.id = h.experience_id JOIN windows w ON w.id = h.window_id
            WHERE h.conference_id = ? AND h.kind = 'extra_night'""", (cid,)).fetchone()
        if not h:
            raise HTTPException(404, "no extra-night headline for this conference")
        area = db.execute("""SELECT a.id, a.name_ja, a.name_en FROM experience_stops s JOIN plans p ON p.id = s.plan_id
            JOIN places pl ON pl.id = p.place_id JOIN places a ON a.id = pl.area_id
            WHERE s.experience_id = ? ORDER BY s.n""", (h["experience_id"],)).fetchone()
        in_area = {r[0] for r in db.execute("""SELECT DISTINCT s.experience_id FROM experience_stops s
            JOIN plans p ON p.id = s.plan_id JOIN places pl ON pl.id = p.place_id WHERE pl.area_id = ?""", (area["id"],))}
        day, wid = h["day"], h["window_id"]
        steps = []
        alert = {"simulated": True, "area": area["id"], "day": day,
                 "ja": f"【模擬警報】大雪のため、{int(day[5:7])}月{int(day[8:])}日は{area['name_ja']}方面のバスが運休",
                 "en": f"[Simulated alert] Heavy snow: buses to {area['name_en']} suspended on {day}"}
        steps.append(steplog.record(cid, AGENT, "Alert received", "警報を受信", alert["en"], alert["ja"], step=1,
                                    tool="rules", simulated=True, output=alert))

        def query(graph_q, fallback, **params):
            t = time.time()
            try:
                rows, tool = _neo4j(graph_q, **params), "graph"
            except Exception:
                rows, tool = fallback(), "rules"
            return rows, tool, {"model": "Neo4j Aura" if tool == "graph" else "SQLite fallback",
                                "ms": int((time.time() - t) * 1000)}

        affected, tool, meta = query(AFFECTED, lambda: _sqlite_affected(db, cid, wid, in_area), area=area["id"], window=wid)
        groups = defaultdict(list)
        for a in affected:
            groups[a["experience_id"]].append(a)
        people = sum(a["party_size"] or 1 for a in affected)
        steps.append(steplog.record(
            cid, AGENT, "Find affected attendees", "影響を受ける参加者を検索",
            f"{len(affected)} bookings, {people} people in {len(groups)} groups ({meta['model']})",
            f"{len(affected)}件の予約、{len(groups)}グループ{people}名（{meta['model']}）",
            step=2, tool=tool, meta=meta, simulated=True,
            output={"source": meta["model"], "query": AFFECTED if tool == "graph" else None, "affected": affected}))

        alts, tool, meta = query(ALTERNATIVES, lambda: _sqlite_alternatives(db, cid, h["kind"], int(day[5:7]), in_area),
                                 area=area["id"], window=wid)
        alts = [a for a in alts if a["id"] not in in_area]
        steps.append(steplog.record(
            cid, AGENT, "Alternatives in the same window", "同じ時間枠の代案",
            f"{len(alts)} options outside {area['name_en']} ({meta['model']})",
            f"{area['name_ja']}以外で{len(alts)}件（{meta['model']}）",
            step=3, tool=tool, meta=meta, output={"source": meta["model"], "alternatives": [a["id"] for a in alts]}))

        info = {r["id"]: dict(r) for r in db.execute(
            f"SELECT id, area_id, price_jpy, start_until, notes FROM experiences WHERE id IN "
            f"({','.join('?' * (len(alts) + len(groups)))})", [a["id"] for a in alts] + list(groups))}
        copy = _copy(db, list(info))
    run_id = uuid.uuid4().hex[:10]
    _RUNS[run_id] = {
        "alert": alert, "window": {"id": wid, "day": day, "start": h["start_time"], "end": h["end_time"],
                                   "name_en": h["name_en"], "name_ja": h["name_ja"]},
        "groups": [{"experience_id": e, "people": sum(a["party_size"] or 1 for a in rows), "bookings": len(rows),
                    "copy": copy.get(e), **{k: info.get(e, {}).get(k) for k in ("price_jpy", "notes")}}
                   for e, rows in groups.items()],
        "alternatives": [{**info.get(a["id"], {}), "travel_min": a["travel_min"], "copy": copy.get(a["id"])} for a in alts],
        "titles": {e: copy.get(e) for e in copy}}
    return {"run_id": run_id, "steps": steps}


def _title(run, eid, lang):
    return ((run["titles"].get(eid) or {}).get(lang) or {}).get("title") or eid


def replan(cid: str, run_id: str) -> dict:
    run = _RUNS.get(run_id)
    if not run:
        raise HTTPException(404, "unknown run_id; call /find first")
    steps = []
    run["picks"] = []
    if not run["groups"]:
        return {"steps": steps}
    facts = {k: run[k] for k in ("alert", "window", "groups", "alternatives")}
    out, meta = chat_json(PICK, "Facts:\n" + json.dumps(facts, ensure_ascii=False), model=FAST)
    valid = {a["id"] for a in run["alternatives"]}
    picks = [p for p in out.get("picks", []) if p.get("to_experience_id") in valid]
    for p in picks:
        for k in ("from", "to"):
            p[f"{k}_title_ja"] = _title(run, p[f"{k}_experience_id"], "ja")
            p[f"{k}_title_en"] = _title(run, p[f"{k}_experience_id"], "en")
        p["people"] = next((g["people"] for g in run["groups"] if g["experience_id"] == p["from_experience_id"]), None)
    conf = min((p.get("confidence") or 0 for p in picks), default=None)
    steps.append(steplog.record(
        cid, AGENT, "Pick one alternative per group", "グループごとに代案を選択",
        "; ".join(f"{p['from_title_en']} to {p['to_title_en']}" for p in picks),
        "、".join(f"{p['from_title_ja']}から{p['to_title_ja']}へ" for p in picks),
        step=4, meta=meta, confidence=conf, output={"picks": picks}))
    run["picks"] = picks
    return {"steps": steps}


def write(cid: str, run_id: str) -> dict:
    run = _RUNS.get(run_id)
    if not run or "picks" not in run:
        raise HTTPException(404, "unknown run_id; call /replan first")
    picks, steps = run["picks"], []
    brief = {"alert": run["alert"], "window": run["window"],
             "changes": [{"experience_id": p["from_experience_id"], "people": p["people"],
                          "old": run["titles"].get(p["from_experience_id"]),
                          "new": next(a for a in run["alternatives"] if a["id"] == p["to_experience_id"]),
                          "why_en": p.get("why_en")} for p in picks]}
    out, meta = chat_json(WRITE, "Facts:\n" + json.dumps(brief, ensure_ascii=False), model=FAST)
    msgs = out.get("messages", [])
    steps.append(steplog.record(cid, AGENT, "Write messages to attendees", "参加者への案内を作成",
                                f"{len(msgs)} messages in Japanese and English", f"日英の案内{len(msgs)}通",
                                step=5, meta=meta, output={"messages": msgs}))

    row = steplog.record(cid, AGENT, "Call the ryokan to move the booking", "旅館に電話して予約を変更",
                         "Booking agent calls the original hotel to cancel or move the bookings under its policy.",
                         "予約担当が元の宿に電話し、規定に沿って予約の取り消しまたは変更を依頼します。",
                         step=6, tool="voice", simulated=True, output={"groups": len(picks)})
    row["mode"] = "replay"  # this step is not run live; shown as Replay
    steps.append(row)
    return {"steps": steps}


class ReplanIn(BaseModel):
    run_id: str


@router.post("/api/disruption/{conference_id}/find")
def post_find(conference_id: str):
    return find(conference_id)


@router.post("/api/disruption/{conference_id}/replan")
def post_replan(conference_id: str, body: ReplanIn):
    try:
        return replan(conference_id, body.run_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"replan failed: {e}")


@router.post("/api/disruption/{conference_id}/write")
def post_write(conference_id: str, body: ReplanIn):
    try:
        return write(conference_id, body.run_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"write failed: {e}")


@router.post("/api/disruption/{conference_id}")
def post_all(conference_id: str):
    first = find(conference_id)
    rid = first["run_id"]
    return {"steps": first["steps"] + replan(conference_id, rid)["steps"] + write(conference_id, rid)["steps"]}
