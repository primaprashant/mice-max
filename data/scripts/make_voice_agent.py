"""Create or update the live ElevenLabs booking agent for one conference (stream B, booking call).

Usage:
  python3 data/scripts/make_voice_agent.py <conf>      (default jadm32)

Reads the booking brief from data/raw/ops/<conf>/call.json (made by make_call.py) and writes the public
agent ID plus a short role sheet to backend/app/ai/voice_agent.json. Running it again updates the same agent.
"""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

import env

ROOT = env.ENV.parent
CONFIG = ROOT / "backend" / "app" / "ai" / "voice_agent.json"
API = "https://api.elevenlabs.io/v1/convai/agents"

PROMPT = """You are MiceMax's AI booking agent, on a phone call to {hotel_ja} ({hotel_en}).
You call on behalf of conference attendees (conference {conf}). The person you talk to is the front desk.
This is a simulated booking for a demo; the guest names are fake.

Goal: {goal_en}

Booking brief (use only these facts; never invent prices, times, phone numbers or policies):
- Date: {day}
- What to book: {goal_en}
- Party: {people} people in total. Reservations: {groups}
- Budget: room rates are already paid online ({price}); the shuttle is free. If asked about anything else costing money, say you will confirm with the guests.
- Allergies or special needs: none were given. If asked, say you will confirm with the guests and call back.
- Facts:
{facts}

How to talk:
- Speak Japanese first, in natural, polite phone keigo. Short sentences, one question at a time.
- Early on, say you are an AI assistant calling for MiceMax on behalf of the conference attendees.
- If the staff speaks English, switch to English and stay in English.
- If something is not possible (full, wrong time), ask for the nearest option in the facts above; never accept one outside them without saying you will check with the guests.
- Before ending, repeat the final details (date, time, number of people, names) and ask the staff to confirm.
- After they confirm, thank them, say goodbye and end the call.
"""


def brief_facts(cid: str) -> dict:
    call = json.loads((ROOT / "data" / "raw" / "ops" / cid / "call.json").read_text())
    b, plan = call["brief"], call["brief"]["plans"][0]
    prices = json.loads(plan["price_variants"]) if isinstance(plan["price_variants"], str) else plan["price_variants"]
    return {
        "conf": cid, "day": b["day"], "people": b["people"], "hotel_ja": plan["name_ja"], "hotel_en": plan["name_en"],
        "groups": ", ".join(f"{g['name_ja']} ({g['party_size']})" for g in b["group"]),
        "price": prices[0]["name"] + f" JPY {prices[0]['price_jpy']} per person" if prices else "not given",
        "facts": "\n".join(f"  - {f}" for f in call["facts_used"]),
        "goal_ja": call["result_ja"], "goal_en": call["result_en"],
        "voice": call["audio"]["voices"]["agent"],
    }


def body(f: dict) -> dict:
    tool = lambda name: {"type": "system", "name": name, "description": "", "params": {"system_tool_type": name}}
    first_ja = (f"お忙しいところ失礼いたします。私、MiceMaxのAIアシスタントでございます。"
                f"学会にご参加の皆様に代わってお電話いたしました。{f['hotel_ja']}様でいらっしゃいますか。")
    first_en = (f"Hello, this is the MiceMax AI assistant, calling on behalf of conference attendees. "
                f"Is this {f['hotel_en']}?")
    return {
        "name": f"MiceMax booker ({f['conf']})",
        "conversation_config": {
            "agent": {
                "first_message": first_ja, "language": "ja",
                "prompt": {"prompt": PROMPT.format(**f),
                           "built_in_tools": {"end_call": tool("end_call"),
                                              "language_detection": tool("language_detection")}},
            },
            "tts": {"voice_id": f["voice"]},
            "language_presets": {"en": {"overrides": {"agent": {"first_message": first_en}}}},
        },
        "platform_settings": {"auth": {"enable_auth": False}},
    }


def call_api(method: str, url: str, data: dict) -> dict:
    req = urllib.request.Request(url, method=method, data=json.dumps(data).encode(),
                                 headers={"xi-api-key": env.os.environ["ELEVEN_KEY"], "Content-Type": "application/json"})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=60).read() or b"{}")
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {url}: {e.code} {e.read().decode()[:800]}")


def main(cid: str = "jadm32") -> None:
    env.load("ELEVEN_KEY")
    f = brief_facts(cid)
    config = json.loads(CONFIG.read_text()) if CONFIG.exists() else {}
    agent_id = (config.get(cid) or {}).get("agent_id")
    if agent_id:
        call_api("PATCH", f"{API}/{agent_id}", body(f))
    else:
        agent_id = call_api("POST", f"{API}/create", body(f))["agent_id"]
    config[cid] = {"agent_id": agent_id, "hotel_ja": f["hotel_ja"], "hotel_en": f["hotel_en"], "day": f["day"],
                   "people": f["people"], "goal_ja": f["goal_ja"], "goal_en": f["goal_en"]}
    CONFIG.write_text(json.dumps(config, ensure_ascii=False, indent=1) + "\n")
    print(f"{cid}: agent {agent_id} -> {CONFIG.relative_to(ROOT)}")


if __name__ == "__main__":
    main(*sys.argv[1:])
