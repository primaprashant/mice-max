"""Live agent-step log: every live AI action records one row here (same shape as agent_steps).

Kept in memory (lost on restart; fine for the demo) and copied to Neon's agent_steps
best-effort when DATABASE_URL is set. Read with recent()."""
import json
import os
import threading
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any, Optional

_LOG: deque[dict] = deque(maxlen=1000)
_LOCK = threading.Lock()


def record(conference_id: str, agent: str, title_en: str, title_ja: str, summary_en: str, summary_ja: str,
           *, phase: str = "during", step: Optional[int] = None, tool: str = "llm", meta: Optional[dict] = None,
           confidence: Optional[float] = None, handed_to_human: bool = False, output: Any = None,
           simulated: bool = False) -> dict:
    """Append one live step. meta is the dict returned by llm.chat (model, ms, tokens)."""
    meta = meta or {}
    row = {
        "id": f"live-{uuid.uuid4().hex[:12]}", "conference_id": conference_id, "phase": phase,
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"), "step": step, "agent": agent,
        "title_ja": title_ja, "title_en": title_en, "tool": tool, "model": meta.get("model"), "mode": "live",
        "ms": meta.get("ms"), "tokens_in": meta.get("tokens_in"), "tokens_out": meta.get("tokens_out"),
        "confidence": confidence, "handed_to_human": int(handed_to_human), "summary_ja": summary_ja,
        "summary_en": summary_en, "output": output, "artifact": None, "simulated": int(simulated),
    }
    with _LOCK:
        _LOG.append(row)
    threading.Thread(target=_to_neon, args=(dict(row),), daemon=True).start()
    return row


def recent(conference_id: Optional[str] = None, after: Optional[str] = None, limit: int = 200) -> list[dict]:
    """Newest last. after is an ISO ts; only rows strictly newer are returned."""
    with _LOCK:
        rows = [r for r in _LOG if (not conference_id or r["conference_id"] == conference_id)
                and (not after or r["ts"] > after)]
    return rows[-limit:]


def _to_neon(row: dict) -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        return
    try:
        from psycopg import connect
        cols = list(row)
        vals = [json.dumps(row[c], ensure_ascii=False) if c == "output" and row[c] is not None else row[c] for c in cols]
        with connect(url, connect_timeout=5) as conn, conn.cursor() as cur:
            cur.execute(f"INSERT INTO agent_steps ({','.join(cols)}) VALUES ({','.join(['%s'] * len(cols))})", vals)
    except Exception:
        pass  # best-effort; the in-memory log is the source for the demo
