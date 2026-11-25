"""Q&A samples (M5): an LLM writes 5 attendee and 3 organizer questions with answers from our data only.

Usage: .venv/bin/python data/scripts/make_qa.py <conf>    -> data/raw/ops/<conf>/qa.json
One question can't be answered from the data and is handed to a person. Run once; builds read qa.json.
"""
import datetime as dt
import json
import sqlite3
import sys
from collections import Counter

import ops_llm
import simulate as sim
from build_graph import DATA
from ops_events import kept_joins

SYSTEM = """You write sample questions and answers for a conference helper chat, for a demo. Rules:
- Answers use only the facts in the context. Never add prices, times, places or policies that are not there.
- Write 5 attendee questions and 3 organizer questions, varied and realistic. Attendees ask about free time,
  experiences, prices, getting there, weather or what to wear. Organizers ask about uptake and what to promote.
- Exactly one attendee question can't be answered from the context (for example a dietary or access need the data
  doesn't cover). Its answer says politely that a person on the team will reply, and handed_to_human is true.
- Organizer numbers are simulated; answers say they are simulated estimates.
- Each answer is 1 to 3 sentences. Japanese first (natural, polite), then a faithful English version.
Return JSON only: {"items": [{"who": "attendee" or "organizer", "q_ja": "", "q_en": "", "a_ja": "", "a_en": "",
 "handed_to_human": false, "sources": ["ids of windows, experiences or stats used"]}]}"""


def context(db, cid, asof):
    C = sim.load_conference(db, cid)
    conf = C["conf"]
    copy = {}
    for eid, lang, title, gtk, inc in db.execute(
            "SELECT experience_id, lang, card_title, good_to_know, included FROM experience_copy"):
        copy.setdefault(eid, {})[lang] = {"title": title, "good_to_know": gtk, "included": inc}
    E = {e["id"]: e for e in C["exps"]}
    windows = []
    for w in C["windows"]:
        free = 9999 if w["kind"] == "extra_night" else (w["end"] - w["start"]).total_seconds() / 60
        fits = [e for e in C["exps"] if sim.fits(None, e, w, free, C)]
        fits.sort(key=lambda e: (e["id"], w["id"]) not in C["headlines"])
        windows.append({"id": w["id"], "day": w["day"], "start": w["start_time"], "end": w["end_time"],
                        "name_ja": w["name_ja"], "name_en": w["name_en"], "fits": [
                            {"id": e["id"], "title_en": copy[e["id"]]["en"]["title"],
                             "title_ja": copy[e["id"]]["ja"]["title"], "price_jpy": e["price_jpy"],
                             "minutes": e["duration_min"], "travel_min_from_venue": e["travel"]} for e in fits[:8]]})
    heads = [{"kind": k, "id": e, "window_id": w, "start": st, "copy": copy[e], "notes": E[e]["notes"],
              "price_jpy": E[e]["price_jpy"]} for k, e, w, st in
             db.execute("SELECT kind, experience_id, window_id, start_time FROM headlines WHERE conference_id = ?",
                        (cid,))]
    month = dt.date.fromisoformat(conf["start_date"]).month
    season = db.execute("SELECT high_c, low_c, snow_depth_cm, wear_en, wear_ja FROM seasons WHERE month = ?",
                        (month,)).fetchone()
    joins = [j for j in kept_joins(db, cid) if j["ts"] < asof]
    kind = {e["id"]: e["kind"] for e in C["exps"]}
    scale = db.execute("SELECT scale FROM simulation_runs WHERE conference_id = ?", (cid,)).fetchone()[0]
    count = lambda t: db.execute("SELECT count(*) FROM events WHERE conference_id = ? AND event_type = ? AND ts < ?",
                                 (cid, t, asof)).fetchone()[0]
    stats = {"note": f"simulated, as of {asof[:16]}; multiply by scale {scale:g} for the real conference size",
             "joins_by_kind": dict(Counter(kind[j["e"]] for j in joins)),
             "top_experiences": [{"id": e, "title_en": copy[e]["en"]["title"], "joins": n}
                                 for e, n in Counter(j["e"] for j in joins).most_common(5)],
             "page_visits": count("page_visited"), "emails_opened": count("email_opened"),
             "joins_kept": len(joins), "cancellations": count("plan_cancelled")}
    return {"conference": {k: conf[k] for k in ("id", "name_ja", "name_en", "start_date", "end_date",
                                                  "attendees")},
            "weather_that_month": dict(zip(("high_c", "low_c", "snow_depth_cm", "wear_en", "wear_ja"), season)),
            "headlines": heads, "windows": windows, "organizer_stats_simulated": stats}


def main(cid):
    db = sqlite3.connect(DATA / "micemax.db")
    start = dt.date.fromisoformat(db.execute("SELECT start_date FROM conferences WHERE id = ?", (cid,)).fetchone()[0])
    # Fixed demo times: organizer questions in the last 2 days before the start (stats as of the first one),
    # attendee ones from the week before to day 2.
    org = [f"{start - dt.timedelta(days=2)}T15:00:00", f"{start - dt.timedelta(days=1)}T10:00:00",
           f"{start - dt.timedelta(days=1)}T16:00:00"]
    ctx = context(db, cid, org[0] + "+09:00")
    out, meta = ops_llm.chat_json(SYSTEM, "Context:\n" + json.dumps(ctx, ensure_ascii=False))
    att = [start - dt.timedelta(days=d) for d in (6, 3, 1)] + [start, start + dt.timedelta(days=1)]
    times = {"organizer": iter(f"{t}+09:00" for t in org),
             "attendee": iter(f"{d}T{h}+09:00" for d, h in zip(att, ["20:10:00", "21:30:00", "19:45:00",
                                                                   "07:20:00", "11:50:00"]))}
    for item in out["items"]:
        item["ts"] = next(times[item["who"]])
    path = DATA / "raw" / "ops" / cid / "qa.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"label_ja": "AIが作成した質問と回答の例", "label_en": "AI-written sample Q&A",
                                "items": out["items"], "written_by": meta}, ensure_ascii=False, indent=1) + "\n")
    print(f"{path}: {len(out['items'])} items, {meta['ms']} ms, {meta['tokens_in']}+{meta['tokens_out']} tokens")


if __name__ == "__main__":
    main(sys.argv[1])
