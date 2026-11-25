"""Rows for agent_steps from LLM text saved in data/raw/ops/<conf>/*.json (M4-M6). Missing files are skipped."""
import json
from pathlib import Path

OPS = Path(__file__).resolve().parent.parent / "raw" / "ops"
REPO = OPS.parents[2]


def call_row(cid):
    path = OPS / cid / "call.json"
    if not path.exists():
        return []
    c = json.loads(path.read_text())
    audio = (c.get("audio") or {}).get("path")
    return [{"id": f"{cid}-call-01", "conference_id": cid, "phase": "before", "ts": c["brief"]["call_ts"],
             "agent": "booker", "tool": "voice", "model": c["written_by"]["model"],
             "title_ja": "予約の電話（模擬通話）", "title_en": "Booking call (simulated call)",
             "summary_ja": c["result_ja"], "summary_en": c["result_en"],
             "output": {k: c[k] for k in ("label_ja", "label_en", "lines", "facts_used", "brief", "written_by")}
             | {"audio": c.get("audio")},
             "artifact": audio if audio and (REPO / audio).exists() else None, "simulated": 1}]


def rows(cid):
    return call_row(cid)
