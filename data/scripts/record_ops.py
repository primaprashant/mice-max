"""Fill agent_steps, the AI operations log behind the Ops view (docs/10-ai-operations-plan.md, minimal version).

Runs in build_db.py after simulate.py. Every row is mode = 'replay'. Setup rows come from data agents already
built; before and during rows from the simulated events (simulated = 1); LLM text from data/raw/ops/<conf>/*.json.
Never calls an API, so rebuilds give the same rows.
"""
import datetime as dt
import json

import ops_events
import ops_files
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


def after_row(db, cid, start):
    """After phase: the day after close, the money flows into the city view. One row, from city_estimates."""
    est = db.execute("""SELECT end_weekday, season, early_jpy, middle_jpy, strong_jpy FROM city_estimates
                       WHERE conference_id = ?""", (cid,)).fetchone()
    if not est:
        return []
    end = db.execute("SELECT end_date FROM conferences WHERE id = ?", (cid,)).fetchone()[0]
    ts = f"{end}T09:00:00+09:00"  # morning after the close
    wd = dt.date.fromisoformat(end).strftime("%A")
    jpy = lambda v: f"¥{v:,}"
    return {"id": f"{cid}-after-01", "conference_id": cid, "phase": "after", "ts": ts, "agent": "reporter",
            "tool": "rules", "title_ja": "結果を都市ビューへ", "title_en": "Results flow into the city view",
            "summary_ja": f"大会終了（{wd}）の翌朝。新規支出の推計を都市ビューへ渡す：慎重{est[2]//10000}万円、"
                          f"標準{est[3]//10000}万円、強気{est[4]//10000}万円（推計値）。",
            "summary_en": f"Morning after the close ({wd}). Estimated new spending flows into the city view: "
                          f"cautious {jpy(est[2])}, middle {jpy(est[3])}, strong {jpy(est[4])} (estimates).",
            "output": {"early_jpy": est[2], "middle_jpy": est[3], "strong_jpy": est[4], "season": est[1],
                       "is_estimate": True}, "simulated": 0}


def load(db):
    ids = [r[0] for r in db.execute("SELECT id FROM conferences WHERE is_demo = 1 ORDER BY id")]
    for cid in ids:
        first = db.execute("SELECT min(ts) FROM events WHERE conference_id = ?", (cid,)).fetchone()[0]
        setup_ts = (dt.datetime.fromisoformat(first) - dt.timedelta(days=1)).replace(
            hour=10, minute=0, second=0).isoformat()  # organizer pastes the URL the day before the first email
        insert(db, ops_setup.rows(db, cid, setup_ts))
        insert(db, ops_events.rows(db, cid))
        start = db.execute("SELECT start_date FROM conferences WHERE id = ?", (cid,)).fetchone()[0]
        insert(db, ops_files.rows(db, cid, start))
        insert(db, [after_row(db, cid, start)])
