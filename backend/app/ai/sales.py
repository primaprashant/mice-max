"""Live sales agent: rank upcoming conferences with rules, then draft outreach to organizers with an LLM.

Drafts only; a person approves before anything is sent. Nothing is sent from here."""
import json
import re
import sqlite3
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from . import llm, steplog

router = APIRouter()

DB = Path(__file__).resolve().parents[3] / "data" / "micemax.db"


def _rows(sql: str, params: tuple = ()) -> list[dict]:
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


def _org(text: Optional[str]) -> Optional[str]:
    """Organization only: drop parenthetical notes, which can hold people's names."""
    return re.sub(r"\s*[(（].*?[)）]", "", text).strip() or None if text else None


def score(c: dict, today: date) -> tuple[int, list[dict]]:
    """Deterministic rules score (0-100) with the reasons behind each point."""
    pts, why = 0, []

    def add(p: int, en: str, ja: str) -> None:
        nonlocal pts
        pts += p
        why.append({"points": p, "en": en, "ja": ja})

    n = c["attendees"]
    if n:
        p = 30 if n >= 3000 else 22 if n >= 1000 else 14 if n >= 500 else 6
        add(p, f"{n:,} attendees ({c['attendees_kind']})", f"参加者 {n:,} 人（{ {'actual': '実績', 'expected': '見込み', 'estimate': '推定'}.get(c['attendees_kind'], '')}）")
    else:
        add(0, "Attendee count unknown", "参加者数は不明")

    start, end = date.fromisoformat(c["start_date"]), date.fromisoformat(c["end_date"])
    days = (end - start).days + 1
    add(15 if days >= 3 else 10 if days == 2 else 4, f"{days}-day meeting", f"会期 {days} 日間")

    lead = (start - today).days
    if 60 <= lead <= 270:
        add(15, f"Starts in {lead} days: time to plan with the organizer", f"開催まで {lead} 日：主催者と準備する時間がある")
    else:
        add(5, f"Starts in {lead} days", f"開催まで {lead} 日")

    if start.month in (12, 1, 2):
        add(10, "Winter season: snow experiences", "冬季：雪の体験ができる")
    elif start.month in (6, 7, 8, 9):
        add(10, "Summer season: peak outdoor experiences", "夏季：屋外体験の最盛期")
    else:
        add(4, "Shoulder season", "端境期")

    if c["end_weekday"] in ("Thu", "Fri", "Sat"):
        add(15, f"Ends on {c['end_weekday']}: an extra night runs into the weekend",
            f"{ {'Thu': '木', 'Fri': '金', 'Sat': '土'}[c['end_weekday']]}曜に終了：+1泊が週末につながる")
    if c["scope"] in ("national", "international"):
        add(8, f"{c['scope'].capitalize()} meeting: most attendees travel in",
            "全国規模：参加者の多くが道外から来る" if c["scope"] == "national" else "国際会議：海外から参加者が来る")
    if (c["scope"] == "national" and (n or 0) >= 500) or (c["scope"] == "international" and (n or 0) >= 100):
        add(7, "Size fits the city's +1 night program criteria", "札幌市「+1泊」事業の規模条件に合う")
    return min(pts, 100), why


def pipeline(today: Optional[date] = None) -> list[dict]:
    today = today or date.today()
    rows = _rows(
        "SELECT * FROM conferences WHERE start_date > ? AND start_date <= ? ORDER BY start_date",
        (today.isoformat(), (today + timedelta(days=365)).isoformat()))
    out = []
    for c in rows:
        s, why = score(c, today)
        out.append({
            "id": c["id"], "name_en": c["name_en"], "name_ja": c["name_ja"] or c["name_en"],
            "start_date": c["start_date"], "end_date": c["end_date"], "field": c["field"],
            "scope": c["scope"], "attendees": c["attendees"], "attendees_kind": c["attendees_kind"],
            "organizer": _org(c["organizer"]), "pco": _org(c["pco"]), "website_url": c["website_url"],
            "score": s, "reasons": why})
    out.sort(key=lambda r: (-r["score"], r["start_date"]))
    return out


@router.get("/api/sales/pipeline")
def get_pipeline() -> dict:
    rows = pipeline()
    return {"today": date.today().isoformat(), "count": len(rows), "conferences": rows}


def _fits(c: dict) -> list[dict]:
    """Our experiences that fit this conference: extra nights first, then specialist visits in its field."""
    month = int(c["start_date"][5:7])
    rows = _rows(
        "SELECT e.id, e.kind, e.fields, e.months, e.price_jpy, en.card_title AS en, ja.card_title AS ja "
        "FROM experiences e JOIN experience_copy en ON en.experience_id = e.id AND en.lang = 'en' "
        "JOIN experience_copy ja ON ja.experience_id = e.id AND ja.lang = 'ja' "
        "WHERE e.kind IN ('extra_night', 'specialist', 'evening')")
    picks = []
    for kind in ("extra_night", "specialist", "evening"):
        for r in rows:
            if r["kind"] != kind or (r["months"] and month not in json.loads(r["months"])):
                continue
            if kind == "specialist" and c["field"] not in json.loads(r["fields"] or "[]"):
                continue
            picks.append({k: r[k] for k in ("kind", "en", "ja", "price_jpy")})
            if sum(p["kind"] == kind for p in picks) >= 2:
                break
    return picks


SYSTEM = """You are the sales agent of MiceMax, a Sapporo company run by AI agents. MiceMax reads a conference's
website, finds attendees' free time between sessions, and offers local experiences that fit: an extra night
first, then short activities and evenings, then specialist visits. Organizers get a ready attendee page in
Japanese and English at no cost to them. Context: in 2026 Sapporo City paid about 3.99M yen for a "+1 night"
stay program covering ONE conference, run by hand; MiceMax aims to do this for every conference.

Write a short, polite first outreach email to the conference's organizing secretariat, in Japanese (primary,
business keigo) and English. Address the organization or secretariat, never a named person. Use only the facts
given; do not invent numbers, prices, partners or results. Mention 1-3 of the listed experiences by name if any
are given. Ask for a 15-minute call. Introduce us as "a Sapporo company run by AI agents" (JA: 札幌の、AIエージェントが運営する会社). Sign as "MiceMax". Keep each body under 180 words (Japanese under 400 chars).

JSON keys: subject_ja, body_ja, subject_en, body_en, why_en, why_ja (one sentence each: why this conference),
confidence (0-1: how well this conference fits our offer)."""


class DraftIn(BaseModel):
    conference_id: str
    lang: Optional[str] = None


@router.post("/api/sales/draft")
def draft(body: DraftIn) -> dict:
    c = next((r for r in pipeline() if r["id"] == body.conference_id), None)
    if not c:
        raise HTTPException(404, "conference not in the pipeline")
    venues = _rows("SELECT p.name_en, p.name_ja FROM conference_venues v JOIN places p ON p.id = v.place_id "
                   "WHERE v.conference_id = ?", (c["id"],))
    fits = _fits(c)
    facts = {k: c[k] for k in ("name_en", "name_ja", "start_date", "end_date", "field", "scope",
                               "attendees", "attendees_kind", "organizer", "pco", "website_url")}
    facts["venues"] = venues
    facts["our_experiences_that_fit"] = fits
    facts["rules_score"] = {"score": c["score"], "reasons": [r["en"] for r in c["reasons"]]}
    for attempt in (1, 2):  # one retry: an occasional reply is not valid JSON
        try:
            out, meta = llm.chat_json(SYSTEM, json.dumps(facts, ensure_ascii=False), max_tokens=3000)
            break
        except Exception as e:
            if attempt == 2:
                raise HTTPException(502, f"LLM call failed: {e}")
    conf = out.get("confidence")
    name_en, name_ja = c["name_en"], c["name_ja"]
    step = steplog.record(
        c["id"], "sales", f"Drafted outreach to the organizer of {name_en}", f"{name_ja} の主催者への営業メールを作成",
        out.get("why_en", ""), out.get("why_ja", ""), phase="before", tool="llm", meta=meta,
        confidence=conf if isinstance(conf, (int, float)) else None, handed_to_human=True,
        output={"subject_en": out.get("subject_en"), "subject_ja": out.get("subject_ja")})
    return {"conference_id": c["id"], "draft": out, "fits": fits, "meta": meta, "step_id": step["id"]}

