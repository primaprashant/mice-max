"""Live booking call: the browser talks to a public ElevenLabs agent; this reads the call back and extracts the booking.

GET  /api/voice/{conference_id}         public agent ID and role-sheet facts (from voice_agent.json)
POST /api/voice/{conference_id}/result  {conversation_id?} -> transcript + booking; records booker steps
The agent itself is created by data/scripts/make_voice_agent.py.
"""
import json
import time
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from . import steplog
from .llm import chat_json, env

router = APIRouter()
CONFIG = Path(__file__).with_name("voice_agent.json")
API = "https://api.elevenlabs.io/v1/convai/conversations"

SYSTEM = """You read a phone call transcript where MiceMax's AI booking agent called a hotel or restaurant.
The staff side was played by a person for a demo. Extract what was actually agreed; never fill gaps from the brief.
Return JSON: {"confirmed": true/false, "date": "YYYY-MM-DD or null", "time": "HH:MM or null",
 "party": number or null, "names": ["..."], "notes_en": "one short line", "notes_ja": "one short line in Japanese",
 "summary_en": "one line", "summary_ja": "one line in Japanese"}"""


def agent(conference_id: str) -> dict:
    cfg = json.loads(CONFIG.read_text()).get(conference_id) if CONFIG.exists() else None
    if not cfg:
        raise HTTPException(404, "no voice agent for this conference")
    return cfg


@router.get("/api/voice/{conference_id}")
def info(conference_id: str) -> dict:
    return agent(conference_id)


class ResultIn(BaseModel):
    conversation_id: Optional[str] = None


def _eleven(path: str, **params) -> dict:
    key = env("ELEVEN_KEY")
    if not key:
        raise HTTPException(503, "ELEVEN_KEY not set")
    r = httpx.get(f"{API}{path}", params=params, headers={"xi-api-key": key}, timeout=30)
    r.raise_for_status()
    return r.json()


def _conversation(agent_id: str, conversation_id: Optional[str]) -> tuple[dict, int]:
    """Latest (or given) conversation; waits briefly while ElevenLabs finishes processing."""
    t = time.time()
    if not conversation_id:
        items = _eleven("", agent_id=agent_id, page_size=1)["conversations"]
        if not items:
            raise HTTPException(404, "no calls yet")
        conversation_id = items[0]["conversation_id"]
    for _ in range(8):
        conv = _eleven(f"/{conversation_id}")
        if conv.get("status") in ("done", "failed") or conv.get("transcript"):
            break
        time.sleep(2)
    return conv, int((time.time() - t) * 1000)


@router.post("/api/voice/{conference_id}/result")
def result(conference_id: str, body: ResultIn) -> dict:
    cfg = agent(conference_id)
    conv, ms = _conversation(cfg["agent_id"], body.conversation_id)
    lines = [{"speaker": "agent" if m["role"] == "agent" else "staff", "text": m["message"]}
             for m in conv.get("transcript") or [] if m.get("message")]
    steplog.record(conference_id, "booker", "Read the live booking call", "ライブ予約通話を取得",
                   f"Fetched call {conv['conversation_id']} from ElevenLabs: {len(lines)} turns.",
                   f"ElevenLabsから通話 {conv['conversation_id']} を取得：{len(lines)}発話。",
                   tool="voice", meta={"model": "elevenlabs-convai", "ms": ms}, simulated=True,
                   output={"conversation_id": conv["conversation_id"], "status": conv.get("status"), "lines": lines})
    if not lines:
        raise HTTPException(409, "call has no transcript yet")
    text = "\n".join(f"{l['speaker']}: {l['text']}" for l in lines)
    booking, meta = chat_json(SYSTEM, f"Booking goal: {cfg['goal_en']}\n\nTranscript:\n{text}")
    ok = bool(booking.get("confirmed"))
    steplog.record(conference_id, "booker", "Extract the booking from the call", "通話から予約内容を抽出",
                   booking.get("summary_en") or ("Booking confirmed." if ok else "Booking not confirmed."),
                   booking.get("summary_ja") or ("予約確定。" if ok else "予約は未確定。"),
                   tool="llm", meta=meta, handed_to_human=not ok, simulated=True, output=booking)
    return {"conversation_id": conv["conversation_id"], "status": conv.get("status"), "lines": lines,
            "booking": booking}
