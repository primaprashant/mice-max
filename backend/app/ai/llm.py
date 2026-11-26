"""LLM calls through OrcaRouter (OpenAI-compatible). Returns parsed JSON plus timing and tokens."""
import json
import os
import time
from pathlib import Path

import httpx

URL = "https://api.orcarouter.ai/v1/chat/completions"
FAST = "anthropic/claude-sonnet-5.5"   # ~2-3 s for short replies; default
STRONG = "anthropic/claude-opus-5.5"   # slower; use for the hardest step only

_ENV = Path(__file__).resolve().parents[3] / ".env"


def env(key: str) -> str | None:
    """Read a key from os.environ, falling back to the repo's root .env (local dev)."""
    if key not in os.environ and _ENV.exists():
        for line in _ENV.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip().removeprefix("export ").strip(), v.strip().strip("'\""))
    return os.environ.get(key) or None


def chat(messages: list[dict], model: str = FAST, temperature: float = 0.3, max_tokens: int = 4000) -> tuple[str, dict]:
    """Returns (text, meta). meta has model, ms, tokens_in, tokens_out."""
    key = env("ORCAROUTER_KEY")
    if not key:
        raise RuntimeError("ORCAROUTER_KEY not set")
    t = time.time()
    r = httpx.post(URL, headers={"Authorization": f"Bearer {key}"}, timeout=180, json={
        "model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens})
    r.raise_for_status()
    res = r.json()
    u = res.get("usage") or {}
    return res["choices"][0]["message"]["content"].strip(), {
        "model": res.get("model", model), "ms": int((time.time() - t) * 1000),
        "tokens_in": u.get("prompt_tokens"), "tokens_out": u.get("completion_tokens")}


def chat_json(system: str, user: str, model: str = FAST, **kw) -> tuple[dict | list, dict]:
    """Ask for JSON; strips any code fence. Returns (parsed, meta)."""
    text, meta = chat([{"role": "system", "content": system + "\nReply with JSON only."},
                       {"role": "user", "content": user}], model=model, **kw)
    start = min((i for i in (text.find("{"), text.find("[")) if i >= 0), default=0)
    end = max(text.rfind("}"), text.rfind("]")) + 1
    return json.loads(text[start:end]), meta
