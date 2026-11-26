"""Live Q&A chat for attendees and organizers. Answers only from this conference's data."""
from functools import lru_cache
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from . import llm, steplog

router = APIRouter()


class Msg(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatIn(BaseModel):
    conference_id: str
    mode: Literal["attendee", "organizer"] = "attendee"
    lang: Literal["en", "ja"] = "en"
    messages: list[Msg]


SYSTEM = """You are the MiceMax {role} for the conference below, in Sapporo, Hokkaido.
Answer only from the DATA. Keep it short: at most 3 sentences or 60 words. Name the best one or two options only, with yen prices and times.
Reply in {language}, unless the user writes in another language; then use theirs.
If the DATA does not answer the question, or it needs a person (refund, cancellation dispute, medical or allergy
needs, complaint, safety, anything you cannot confirm), say plainly that you have passed it to a person on the
team who will reply, and set handed_to_human true.
{extra}
Return JSON: {{"answer": "...", "handed_to_human": false, "confidence": 0.0-1.0}}

DATA
{data}"""

ORG_EXTRA = "Uptake numbers come from a simulated event log; say they are simulated when you quote them."


def _ctx_attendee(cid: str, lang: str) -> str:
    from ..main import q, q1  # late import: main imports this module
    c = q1("SELECT * FROM conferences WHERE id = ?", (cid,))
    if c is None:
        raise HTTPException(404, "conference not found")
    name = c["name_ja"] if lang == "ja" else c["name_en"]
    venue = q1("SELECT place_id FROM conference_venues WHERE conference_id = ? AND is_main = 1", (cid,))
    vid = venue["place_id"] if venue else None
    vname = q1("SELECT name_en FROM places WHERE id = ?", (vid,)) if vid else None
    out = [f"Conference: {name}, {c['start_date']} to {c['end_date']}, venue {vname['name_en'] if vname else '?'}"]

    s = q1("SELECT * FROM seasons WHERE month = ?", (int(c["start_date"][5:7]),))
    if s:
        out.append(f"Weather that month: high {s['high_c']}C, low {s['low_c']}C, snow depth {s['snow_depth_cm']} cm. "
                   f"Wear: {s['wear_ja'] if lang == 'ja' else s['wear_en']}")

    out.append("Program by day (first start, last end, sessions):")
    for r in q("""SELECT day, MIN(start_time) a, MAX(end_time) b, COUNT(*) n FROM sessions
                  WHERE conference_id = ? GROUP BY day ORDER BY day""", (cid,)):
        out.append(f"- {r['day']} {r['a']}-{r['b']} {r['n']} sessions")
    for r in q("""SELECT day, start_time, end_time, title_en, title_ja, type FROM sessions
                  WHERE conference_id = ? AND type IN ('plenary','social') ORDER BY day""", (cid,)):
        out.append(f"- {r['type']}: {r['day']} {r['start_time']}-{r['end_time']} {r['title_ja'] if lang == 'ja' else r['title_en']}")

    out.append("Free-time windows (id day time name kinds):")
    for w in q("SELECT * FROM windows WHERE conference_id = ? ORDER BY day, start_time", (cid,)):
        out.append(f"- {w['id']} {w['day']} {w['start_time']}-{w['end_time']} {w['name_ja'] if lang == 'ja' else w['name_en']} {w['plan_kinds']}")

    out.append("Experiences (kind; title; hook; price; hours; minutes; party; area; travel from venue; included; good to know):")
    rows = q("""SELECT e.*, ec.card_title, ec.hook, ec.included, ec.good_to_know, p.name_en area,
                       (SELECT GROUP_CONCAT(t.mode || ' ' || t.minutes || 'min', ', ') FROM experience_travel t
                        WHERE t.experience_id = e.id AND t.venue_place_id = ?) travel
                FROM experiences e
                LEFT JOIN experience_copy ec ON ec.experience_id = e.id AND ec.lang = ?
                LEFT JOIN places p ON p.id = e.area_id
                WHERE e.id IN (SELECT DISTINCT experience_id FROM events WHERE conference_id = ?)
                ORDER BY e.kind, e.id""", (vid, lang, cid))
    for e in rows:
        price = f"{e['price_jpy']} JPY" + (f" to {e['price_max_jpy']}" if e["price_max_jpy"] else "")
        gtk = (e["good_to_know"] or "").replace("\n", "; ")
        out.append(f"- {e['kind']}; {e['card_title']}; {e['hook']}; {price}; {e['start_from']}-{e['start_until']}; "
                   f"{e['duration_min']}; {e['party_min'] or 1}-{e['party_max'] or '?'}; {e['area']}; {e['travel'] or '?'}; "
                   f"{e['included'] or ''}; {gtk}")
    return "\n".join(out)


def _ctx_organizer(cid: str) -> str:
    from ..main import q
    out = ["Uptake (SIMULATED event log). Funnel counts by event type:"]
    for r in q("SELECT event_type, COUNT(*) n FROM events WHERE conference_id = ? GROUP BY 1 ORDER BY 2 DESC", (cid,)):
        out.append(f"- {r['event_type']}: {r['n']}")
    out.append("Joins and bookings by kind:")
    for r in q("""SELECT e.kind, SUM(ev.event_type='plan_shown') shown, SUM(ev.event_type='plan_joined') joined,
                         SUM(ev.event_type='plan_booked') booked FROM events ev JOIN experiences e ON e.id = ev.experience_id
                  WHERE ev.conference_id = ? GROUP BY 1""", (cid,)):
        out.append(f"- {r['kind']}: shown {r['shown']}, joined {r['joined']}, booked {r['booked']}")
    out.append("Per experience (title; shown; joined; booked):")
    for r in q("""SELECT ec.card_title t, SUM(ev.event_type='plan_shown') shown, SUM(ev.event_type='plan_joined') joined,
                         SUM(ev.event_type='plan_booked') booked FROM events ev
                  LEFT JOIN experience_copy ec ON ec.experience_id = ev.experience_id AND ec.lang = 'en'
                  WHERE ev.conference_id = ? GROUP BY ev.experience_id ORDER BY joined DESC""", (cid,)):
        out.append(f"- {r['t']}; {r['shown']}; {r['joined']}; {r['booked']}")
    return "\n".join(out)


@lru_cache(maxsize=16)
def context(cid: str, mode: str, lang: str) -> str:
    data = _ctx_attendee(cid, lang)
    return data + "\n" + _ctx_organizer(cid) if mode == "organizer" else data


@router.post("/api/chat")
def chat(body: ChatIn) -> dict:
    if not body.messages or body.messages[-1].role != "user":
        raise HTTPException(400, "last message must be from the user")
    org = body.mode == "organizer"
    system = SYSTEM.format(
        role="organizer assistant" if org else "attendee concierge",
        language="Japanese" if body.lang == "ja" else "English",
        extra=ORG_EXTRA if org else "", data=context(body.conference_id, body.mode, body.lang))
    history = "\n".join(f"{m.role}: {m.content}" for m in body.messages[-8:])
    for attempt in (1, 2):  # the model sometimes returns non-JSON; one retry is enough
        try:
            out, meta = llm.chat_json(system, history)
            break
        except Exception as e:
            if attempt == 2:
                raise HTTPException(502, f"llm failed: {e}") from e
    answer = str(out.get("answer", "")).strip()
    handed = bool(out.get("handed_to_human"))
    conf = float(out.get("confidence") or 0)
    question = body.messages[-1].content[:80]
    row = steplog.record(
        body.conference_id, "organizer-assistant" if org else "concierge",
        "Answered a question" if not handed else "Passed a question to a person",
        "質問に回答" if not handed else "質問を担当者に引き継ぎ",
        f"Q: {question}", f"質問: {question}",
        phase="during", tool="llm", meta=meta, confidence=conf, handed_to_human=handed,
        output={"question": body.messages[-1].content, "answer": answer, "mode": body.mode})
    return {"answer": answer, "handed_to_human": handed, "confidence": conf, "step_id": row["id"],
            "model": meta.get("model"), "ms": meta.get("ms")}
