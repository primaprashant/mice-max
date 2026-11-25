"""Fill agent_steps, the AI operations log behind the Ops view (docs/10-ai-operations-plan.md, minimal version).

Runs in build_db.py after simulate.py. Every row is mode = 'replay'. Setup rows come from data agents already
built; before and during rows from the simulated events (simulated = 1); LLM text from data/raw/ops/<conf>/*.json.
Never calls an API, so rebuilds give the same rows.
"""
import datetime as dt
import json

import ops_events
import ops_setup

COLS = ["id", "conference_id", "phase", "ts", "step", "agent", "title_ja", "title_en", "tool", "model", "mode",
        "ms", "tokens_in", "tokens_out", "confidence", "handed_to_human", "summary_ja", "summary_en", "output",
        "artifact", "simulated"]


def insert(db, rows):
    for r in rows:
        r = {"mode": "replay", "handed_to_human": 0, **r}
        r["output"] = json.dumps(r["output"], ensure_ascii=False) if r.get("output") is not None else None
        db.execute(f"INSERT INTO agent_steps ({', '.join(COLS)}) VALUES ({', '.join('?' * len(COLS))})",
                   [r.get(c) for c in COLS])


def load(db):
    ids = [r[0] for r in db.execute("SELECT id FROM conferences WHERE is_demo = 1 ORDER BY id")]
    for cid in ids:
        first = db.execute("SELECT min(ts) FROM events WHERE conference_id = ?", (cid,)).fetchone()[0]
        setup_ts = (dt.datetime.fromisoformat(first) - dt.timedelta(days=1)).replace(
            hour=10, minute=0, second=0).isoformat()  # organizer pastes the URL the day before the first email
        insert(db, ops_setup.rows(db, cid, setup_ts))
        insert(db, ops_events.rows(db, cid))
