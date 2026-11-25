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


def disruption_rows(db, cid):
    path = OPS / cid / "disruption.json"
    if not path.exists():
        return []
    d = json.loads(path.read_text())
    day, model = d["alert"]["ts"][:10], d["written_by"]["model"]
    groups = {}
    for a in d["affected"]:
        groups[a["experience_id"]] = groups.get(a["experience_id"], 0) + a["party_size"]
    people = sum(groups.values())
    T = {}
    for e, lang, t in db.execute("SELECT experience_id, lang, card_title FROM experience_copy"):
        T.setdefault(e, {})[lang] = t
    picks = [(T[p["from_experience_id"]], T[p["to_experience_id"]], groups.get(p["from_experience_id"], 0))
             for p in d["picks"]]
    base = {"conference_id": cid, "phase": "during", "simulated": 1}
    steps = [
        ("07:00", "watcher", "search", None, "運行情報（模擬警報）", "Transport alert (simulated)",
         d["alert"]["ja"], d["alert"]["en"], {"alert": d["alert"], "area": d["area"]}),
        ("07:01", "replanner", "graph", None, "影響を受ける参加者", "Find affected attendees",
         f"グラフ検索で{len(d['affected'])}件の予約（{people}人、{len(groups)}つの体験）が該当。",
         f"Graph query found {len(d['affected'])} bookings ({people} people, {len(groups)} experiences).",
         {"query": d["query"], "params": {"area": d["area"], "window": d["window_id"]}, "affected": d["affected"]}),
        ("07:03", "replanner", "llm", model, "代わりの案を選ぶ", "Pick alternatives",
         "".join(f"「{a['ja']}」の{n}人は「{b['ja']}」へ。" for a, b, n in picks),
         " ".join(f"\"{a['en']}\" ({n} people) moves to \"{b['en']}\"." for a, b, n in picks),
         {"picks": d["picks"], "candidates": d["alternatives"]}),
        ("07:05", "mailer", "llm", model, "参加者への案内", "Messages to attendees",
         f"{len(d['affected'])}人に日本語と英語で案内を送信。部屋の確認後に確定。",
         f"Sent JA/EN messages to {len(d['affected'])} attendees. Plans are final once rooms are confirmed.",
         {"messages": d["messages"]}),
        ("09:00", "booker", "voice", None, "宿に予約の変更を連絡", "Call the hotel about the bookings",
         d["ryokan_call_ja"], d["ryokan_call_en"], None),
    ]
    out = []
    for n, (hm, agent, tool, m, tja, ten, sja, sen, output) in enumerate(steps, 1):
        out.append({**base, "id": f"{cid}-disruption-{n:02d}", "ts": f"{day}T{hm}:00+09:00", "agent": agent,
                    "tool": tool, "model": m, "title_ja": tja, "title_en": ten, "summary_ja": sja,
                    "summary_en": sen, "output": {"label_ja": d["label_ja"], "label_en": d["label_en"],
                                                  **(output or {})}})
    return out


def rows(db, cid, start_date):
    return call_row(cid) + qa_rows(cid, start_date) + disruption_rows(db, cid)
