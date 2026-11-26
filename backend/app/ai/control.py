"""GET /api/ops/agents: every AI agent in the company, by department, with run counts.

The registry is static. Counts and tokens come from SQLite agent_steps (replay rows)
and steplog (live rows). Cost is an estimate: real live token counts times list price."""
import os
import sqlite3
from pathlib import Path

from fastapi import APIRouter

from . import steplog

router = APIRouter()

DB_PATH = Path(os.environ.get("MICEMAX_DB") or Path(__file__).resolve().parents[3] / "data" / "micemax.db")

# USD per million tokens (Anthropic list price, input/output). Unknown models use the Opus price.
PRICES = {"sonnet": (2.0, 10.0), "opus": (4.0, 20.0)}
JPY_PER_USD = 150
MANUAL_CONTRACT_JPY = 3_990_000  # Doshin EC, June 2026 [S3]: one conference, run by hand

# (id, department, role_en, role_ja, tool, link, mode, match)
# match: setup step number, or the agent names used in agent_steps rows.
LIVE_RUN = "/ops/run"
AGENTS = [
    ("reader", "setup", "Reads the conference website", "会議のウェブサイトを読む", "search", LIVE_RUN, "live", 1),
    ("scheduler", "setup", "Extracts the session schedule", "セッション日程を抽出する", "llm", LIVE_RUN, "live", 2),
    ("sorter", "setup", "Sorts must-attend and skippable sessions", "必須と任意のセッションを分ける", "llm", LIVE_RUN, "live", 3),
    ("window-finder", "setup", "Finds attendees' free time", "参加者の空き時間を見つける", "rules", LIVE_RUN, "live", 4),
    ("audience", "setup", "Estimates who attends and their interests", "参加者層と関心を推定する", "llm", LIVE_RUN, "live", 5),
    ("filter", "setup", "Checks experiences against the graph", "体験をグラフで確認する", "graph", LIVE_RUN, "live", 6),
    ("builder", "setup", "Builds experiences and specialist visits", "体験と専門視察を組み立てる", "llm", LIVE_RUN, "live", 7),
    ("ranker", "setup", "Picks the top experiences per free window", "空き時間ごとに上位の体験を選ぶ", "llm", LIVE_RUN, "live", 8),
    ("writer", "setup", "Writes the JA/EN page and email", "日英のページとメールを書く", "llm", LIVE_RUN, "live", 9),
    ("mailer", "operations", "Sends emails and reminders", "メールとリマインダーを送る", "rules", "/ops/{c}", "replay", ["mailer"]),
    ("booker", "operations", "Calls businesses to book (voice)", "事業者に電話で予約する（音声）", "voice", "/ops/{c}", "live", ["booker"]),
    ("concierge", "operations", "Answers attendee questions", "参加者の質問に答える", "llm", "/c/{c}", "live", ["concierge"]),
    ("organizer-assistant", "operations", "Answers organizer questions", "主催者の質問に答える", "llm", "/organize/{c}", "live", ["organizer-assistant", "analyst"]),
    ("replanner", "operations", "Replans when transport stops", "交通が止まったら計画を立て直す", "graph", "/ops/{c}", "live", ["replanner", "watcher", "disruption"]),
    ("group-filler", "operations", "Fills groups and nudges", "グループを埋めて声をかける", "rules", "/ops/{c}", "replay", ["group_filler"]),
    ("host-assigner", "operations", "Assigns a host to each group", "各グループに案内役を割り当てる", "rules", "/ops/{c}", "replay", ["host_matcher"]),
    ("sales", "growth", "Finds conferences and drafts outreach", "会議を見つけて営業文を書く", "llm", "/ops/sales", "live", ["sales"]),
    ("reporter", "reporting", "Weekly reports to the organizer", "主催者への週次報告", "rules", "/ops/{c}", "replay", ["reporter"]),
    ("city-report", "reporting", "Writes the city's results report", "市への成果報告を書く", "llm", "/city", "next", []),
]

HUMANS = [
    {"count": 1, "role_en": "approves sends and handles hand-offs", "role_ja": "送信を承認し、引き継ぎに対応する"},
]


def _replay_rows() -> list[dict]:
    try:
        conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        try:
            return [dict(r) for r in conn.execute(
                "SELECT conference_id, phase, step, agent, model, tokens_in, tokens_out, handed_to_human FROM agent_steps")]
        finally:
            conn.close()
    except sqlite3.Error:
        return []


def _matches(match, row: dict) -> bool:
    if isinstance(match, int):
        return row.get("phase") == "setup" and row.get("step") == match
    return row.get("agent") in match


def _cost_usd(row: dict) -> float:
    price_in, price_out = PRICES["sonnet"] if "sonnet" in (row.get("model") or "") else PRICES["opus"]
    return ((row.get("tokens_in") or 0) * price_in + (row.get("tokens_out") or 0) * price_out) / 1e6


def _demo_conference(rows: list[dict]) -> str:
    counts: dict[str, int] = {}
    for r in rows:
        counts[r["conference_id"]] = counts.get(r["conference_id"], 0) + 1
    return max(counts, key=counts.get) if counts else ""


@router.get("/api/ops/agents")
def agents() -> dict:
    replay, live = _replay_rows(), steplog.recent(limit=1000)
    demo = _demo_conference(replay)
    departments: dict[str, list[dict]] = {}
    for aid, dept, role_en, role_ja, tool, link, mode, match in AGENTS:
        mine_r = [r for r in replay if _matches(match, r)]
        mine_l = [r for r in live if _matches(match, r)]
        departments.setdefault(dept, []).append({
            "id": aid, "role_en": role_en, "role_ja": role_ja, "tool": tool,
            # Only models seen in this agent's recorded rows; none means rules or not run yet.
            "model": next((r["model"] for r in reversed(mine_r + mine_l) if r.get("model")), None),
            "link": link.format(c=demo), "mode": mode,
            "replay_runs": len(mine_r), "live_runs": len(mine_l),
            "tokens": sum((r.get("tokens_in") or 0) + (r.get("tokens_out") or 0) for r in mine_r + mine_l),
        })
    live_cost = sum(_cost_usd(r) for r in live)
    live_confs = {r["conference_id"] for r in live if r.get("tokens_in") or r.get("tokens_out")}
    per_conf_jpy = round(live_cost * JPY_PER_USD / len(live_confs)) if live_confs else None
    return {
        "departments": [{"id": d, "agents": departments[d]} for d in ("setup", "operations", "growth", "reporting")],
        "humans": HUMANS,
        "totals": {
            "agents": sum(1 for a in AGENTS if a[6] != "next"),
            "replay_steps": len(replay), "live_steps": len(live),
            "handoffs": sum(1 for r in replay + live if r.get("handed_to_human")),
            "live_tokens": sum((r.get("tokens_in") or 0) + (r.get("tokens_out") or 0) for r in live),
        },
        "cost": {
            "estimate": True, "per_conference_jpy": per_conf_jpy, "conferences_measured": len(live_confs),
            "manual_contract_jpy": MANUAL_CONTRACT_JPY, "jpy_per_usd": JPY_PER_USD,
            "usd_per_mtok": {k: {"in": v[0], "out": v[1]} for k, v in PRICES.items()},
        },
    }
