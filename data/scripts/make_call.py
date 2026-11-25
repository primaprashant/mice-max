"""Booking call for one headline (M4): an LLM writes the JA script with EN translation, ElevenLabs reads it.

Usage:
  .venv/bin/python data/scripts/make_call.py script <conf> [kind]          -> data/raw/ops/<conf>/call.json
  .venv/bin/python data/scripts/make_call.py audio <conf> <agent_voice_id> <staff_voice_id>
                                                                           -> data/media/calls/<conf>.mp3
Facts come from the DB only; the party is the simulated group. Run once; builds read call.json, never the API.
"""
import datetime as dt
import json
import os
import sqlite3
import sys
import urllib.request

import env
import ops_llm
from ops_events import kept_joins

DATA = env.ENV.parent / "data"
SYSTEM = """You write a short, realistic Japanese phone call for a demo. MiceMax's AI booking agent calls a business
on behalf of conference attendees. Rules:
- Use only the facts in the brief. Never add prices, times, phone numbers, capacities or policies that are not there.
  When the staff member would need a fact we don't have, they say they will check, or simply confirm.
- The agent says early on that it is an AI assistant calling for MiceMax on behalf of the conference attendees.
- Natural polite Japanese (keigo), as said on the phone. 12 to 18 lines in all, alternating agent and staff.
- The goal is what the brief says needs a phone call. End with a clear result.
Return JSON only: {"lines": [{"speaker": "agent" or "staff", "ja": "...", "en": "..."}],
 "result_ja": "one line", "result_en": "one line", "facts_used": ["each fact from the brief the call relies on"]}"""


def brief(db, cid, kind):
    eid, wid, start, note = db.execute("SELECT experience_id, window_id, start_time, note FROM headlines "
                                       "WHERE conference_id = ? AND kind = ?", (cid, kind)).fetchone()
    day, wname = db.execute("SELECT day, name_ja FROM windows WHERE id = ?", (wid,)).fetchone()
    db.row_factory = sqlite3.Row
    plans = [dict(r) for r in db.execute("""SELECT p.name_ja, p.name_en, p.booking_method, p.booking_deadline,
        p.price_variants, p.notes, p.source_url FROM experience_stops s JOIN plans p ON p.id = s.plan_id
        WHERE s.experience_id = ? ORDER BY s.n""", (eid,))]
    db.row_factory = None
    names = dict(db.execute("SELECT id, name_ja FROM attendees WHERE conference_id = ?", (cid,)))
    group = [{"name_ja": names[j["a"]], "party_size": j["size"], "booked_online": j["booked"]}
             for j in kept_joins(db, cid) if j["e"] == eid and j["w"] == wid]
    return {"conference_id": cid, "experience_id": eid, "window_id": wid, "day": day, "window_name_ja": wname,
            "suggested_start": start, "headline_note": note, "plans": plans, "group": group,
            "people": sum(g["party_size"] for g in group),
            "call_ts": f"{dt.date.fromisoformat(day) - dt.timedelta(days=3)}T11:00:00+09:00"}


def script(cid, kind="extra_night"):
    db = sqlite3.connect(DATA / "micemax.db")
    b = brief(db, cid, kind)
    user = ("Brief (simulated attendees; names are fake):\n" + json.dumps(b, ensure_ascii=False, indent=1) +
            f"\n\nThe call takes place on {b['call_ts'][:10]}. Write the call.")
    out, meta = ops_llm.chat_json(SYSTEM, user)
    path = DATA / "raw" / "ops" / cid / "call.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"label_ja": "模擬通話", "label_en": "simulated call", "brief": b, **out,
                                "written_by": meta}, ensure_ascii=False, indent=1) + "\n")
    print(f"{path}: {len(out['lines'])} lines, {meta['ms']} ms, {meta['tokens_in']}+{meta['tokens_out']} tokens")


def audio(cid, agent_voice, staff_voice):
    env.load("ELEVEN_KEY")
    path = DATA / "raw" / "ops" / cid / "call.json"
    call = json.loads(path.read_text())
    voices = {"agent": agent_voice, "staff": staff_voice}
    parts, prev = [], {}
    for line in call["lines"]:
        v = voices[line["speaker"]]
        body = {"text": line["ja"], "model_id": "eleven_multilingual_v2", "language_code": "ja"}
        if prev.get(v):
            body["previous_text"] = prev[v]  # keeps each voice's tone steady
        req = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{v}?output_format=mp3_44100_128",
            data=json.dumps(body).encode(),
            headers={"xi-api-key": os.environ["ELEVEN_KEY"], "Content-Type": "application/json"})
        parts.append(urllib.request.urlopen(req, timeout=120).read())
        prev[v] = line["ja"]
    out = DATA / "media" / "calls" / f"{cid}.mp3"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(b"".join(parts))  # same format for every part, so plain joining plays fine
    call["audio"] = {"path": str(out.relative_to(DATA.parent)), "voices": voices, "model": "eleven_multilingual_v2"}
    path.write_text(json.dumps(call, ensure_ascii=False, indent=1) + "\n")
    print(f"{out}: {len(parts)} lines, {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    {"script": script, "audio": audio}[sys.argv[1]](*sys.argv[2:])
