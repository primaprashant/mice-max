"""One LLM call through OrcaRouter (OpenAI-compatible), returning parsed JSON. Used by make_*.py, never by builds."""
import json
import os
import time
import urllib.request

import env

URL = "https://api.orcarouter.ai/v1/chat/completions"
MODEL = "anthropic/claude-opus-5.5"


def chat_json(system, user):
    """Returns (parsed JSON, meta with model, ms and tokens)."""
    env.load("ORCAROUTER_KEY")
    body = {"model": MODEL, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": 0.4}
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={
        "Authorization": "Bearer " + os.environ["ORCAROUTER_KEY"], "Content-Type": "application/json"})
    t = time.time()
    res = json.load(urllib.request.urlopen(req, timeout=300))
    text = res["choices"][0]["message"]["content"].strip()
    text = text[text.index("{"): text.rindex("}") + 1]  # drop any code fence around the JSON
    u = res.get("usage") or {}
    return json.loads(text), {"model": res.get("model", MODEL), "ms": int((time.time() - t) * 1000),
                              "tokens_in": u.get("prompt_tokens"), "tokens_out": u.get("completion_tokens")}
