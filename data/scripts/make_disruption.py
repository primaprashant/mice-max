"""Snow disruption (M6): a simulated bus alert for the extra-night headline's area, affected attendees found with
a graph query on simulated joins, alternatives from the same window's fits outside that area, LLM-written JA/EN messages.

Usage: .venv/bin/python data/scripts/make_disruption.py <conf>    -> data/raw/ops/<conf>/disruption.json
Run once; builds read the file, never the API or the graph.
"""
import json
import sqlite3
import sys

import relate

import build_graph
import ops_llm
import simulate as sim
from build_graph import DATA

AFFECTED = """MATCH (a:Attendee)-[j:JOINED]->(e:Experience)-[:HAS_STOP]->(:Plan)-[:AT]->(:Place)-[:IN_AREA]->(:Place {id: $area})
WHERE j.window_id = $window AND NOT j.cancelled
RETURN DISTINCT a.id AS attendee_id, a.name_ja AS name_ja, a.name_en AS name_en, a.language AS language,
       j.party_size AS party_size, j.booked AS booked, e.id AS experience_id ORDER BY attendee_id"""

SYSTEM = """You replan a group trip for a demo after a simulated alert. Rules:
- Use only the facts given. Never add prices, times, routes, availability or cancellation terms that are not there.
- For each affected experience pick one alternative from the list. Prefer options that are easy to reach in heavy
  snow according to the facts (e.g. by train), and close in price and feel. Say rooms still have to be checked.
- Messages go to the affected attendees: short, kind, clear about what changed and what to do. Japanese first
  (natural, polite), then a faithful English version. Mention the alert is about heavy snow.
- ryokan_call: one or two sentences on what our booking agent asks the original hotel (cancel or move the
  bookings, under their policy), not the outcome.
Return JSON only: {"picks": [{"from_experience_id": "", "to_experience_id": "", "why_ja": "", "why_en": ""}],
 "messages": [{"experience_id": "", "ja": "", "en": ""}], "ryokan_call_ja": "", "ryokan_call_en": ""}"""


def main(cid):
    db = sqlite3.connect(DATA / "micemax.db")
    eid, wid = db.execute("SELECT experience_id, window_id FROM headlines WHERE conference_id = ? "
                          "AND kind = 'extra_night'", (cid,)).fetchone()
    area, area_ja, area_en = db.execute("""SELECT a.id, a.name_ja, a.name_en FROM experience_stops s
        JOIN plans p ON p.id = s.plan_id JOIN places pl ON pl.id = p.place_id JOIN places a ON a.id = pl.area_id
        WHERE s.experience_id = ? ORDER BY s.n""", (eid,)).fetchone()
    C = sim.load_conference(db, cid)
    w = next(x for x in C["windows"] if x["id"] == wid)
    with relate.connect(str(build_graph.GRAPH), read_only=True) as conn:
        affected = [dict(r) for r in conn.execute(AFFECTED, {"area": area, "window": wid}).fetchall()]
    in_area = {e for (e,) in db.execute("""SELECT DISTINCT s.experience_id FROM experience_stops s
        JOIN plans p ON p.id = s.plan_id JOIN places pl ON pl.id = p.place_id WHERE pl.area_id = ?""", (area,))}
    copy = {}
    for e, lang, title, inc, gtk in db.execute(
            "SELECT experience_id, lang, card_title, included, good_to_know FROM experience_copy"):
        copy.setdefault(e, {})[lang] = {"title": title, "included": inc, "good_to_know": gtk}
    alts = [{"id": e["id"], "area_id": e["area_id"], "price_jpy": e["price_jpy"], "leave_sapporo_by": e["start_until"],
             "copy": copy[e["id"]], "notes": e["notes"]}
            for e in C["exps"] if sim.fits(None, e, w, 9999, C) and e["id"] not in in_area]
    day = w["day"]
    alert = {"simulated": True, "ts": f"{day}T07:00:00+09:00",
             "ja": f"【模擬警報】大雪のため、{day[5:7].lstrip('0')}月{day[8:].lstrip('0')}日は{area_ja}方面のバスが運休",
             "en": f"[Simulated alert] Heavy snow: buses to {area_en} suspended on {day}"}
    hit = sorted({a["experience_id"] for a in affected})
    brief = {"alert": alert, "window": {k: w[k] for k in ("id", "day", "start_time", "end_time", "name_ja", "name_en")},
             "affected_experiences": [{"id": e, "copy": copy[e]} for e in hit],
             "affected_groups": [{"experience_id": e, "people": sum(a["party_size"] for a in affected
                                                                  if a["experience_id"] == e)} for e in hit],
             "alternatives": alts}
    out, meta = ops_llm.chat_json(SYSTEM, "Facts:\n" + json.dumps(brief, ensure_ascii=False))
    path = DATA / "raw" / "ops" / cid / "disruption.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"label_ja": "模擬警報、AIが作成した案内", "label_en": "simulated alert, AI-written messages",
                                "alert": alert, "area": area, "window_id": wid, "query": AFFECTED,
                                "affected": affected, "alternatives": [a["id"] for a in alts], **out,
                                "written_by": meta}, ensure_ascii=False, indent=1) + "\n")
    print(f"{path}: {len(affected)} affected, {len(alts)} alternatives, {meta['ms']} ms")


if __name__ == "__main__":
    main(sys.argv[1])
