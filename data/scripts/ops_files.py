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


def qa_rows(cid, start_date):
    path = OPS / cid / "qa.json"
    if not path.exists():
        return []
    qa = json.loads(path.read_text())
    out = []
    for n, q in enumerate(sorted(qa["items"], key=lambda q: q["ts"]), 1):
        org = q["who"] == "organizer"
        out.append({"id": f"{cid}-qa-{n:02d}", "conference_id": cid, "ts": q["ts"],
                    "phase": "before" if q["ts"][:10] < start_date else "during",
                    "agent": "analyst" if org else "concierge", "tool": "llm", "model": qa["written_by"]["model"],
                    "title_ja": "主催者からの質問" if org else "参加者からの質問",
                    "title_en": "Organizer question" if org else "Attendee question",
                    "handed_to_human": int(q["handed_to_human"]),
                    "summary_ja": f"Q：{q['q_ja']}\nA：{q['a_ja']}", "summary_en": f"Q: {q['q_en']}\nA: {q['a_en']}",
                    "output": {"label_ja": qa["label_ja"], "label_en": qa["label_en"], **q}, "simulated": 1})
    return out


def rows(cid, start_date):
    return call_row(cid) + qa_rows(cid, start_date)
