"""MiceMax backend: one FastAPI app.

Reads the committed SQLite master copy for catalog data (read-only).
Writes the event log to Neon when DATABASE_URL is set; without it, writes
fail closed with 503 and the UI treats booking as best-effort.

Env vars: DATABASE_URL (optional), CORS_ORIGINS (comma-separated allowed
origins; unset means same-origin only, set "*" for local development),
MICEMAX_DB (optional SQLite path override).
"""
import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Optional, get_args

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from psycopg import Error as PsycopgError
from psycopg import connect as psycopg_connect

DB_PATH = Path(
    os.environ.get("MICEMAX_DB")
    or Path(__file__).resolve().parents[2] / "data" / "micemax.db"
)

app = FastAPI(title="MiceMax API", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    # Unset means same-origin only (the deployment design requires the deployed
    # backend to restrict origins). Set CORS_ORIGINS="*" for local development.
    allow_origins=[
        o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

from .ai import chat, control, disruption, feed, ingest, sales, voice  # noqa: E402

for _m in (feed, ingest, chat, disruption, voice, sales, control):
    app.include_router(_m.router)


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def q(sql: str, params: tuple = ()) -> list[sqlite3.Row]:
    with closing_conn() as conn:
        return conn.execute(sql, params).fetchall()


def q1(sql: str, params: tuple = ()) -> Optional[sqlite3.Row]:
    rows = q(sql, params)
    return rows[0] if rows else None


@contextmanager
def closing_conn():
    conn = db()
    try:
        yield conn
    finally:
        conn.close()


def rows_json(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(r) for r in rows]


def parse_json_cols(row: dict[str, Any], cols: tuple[str, ...]) -> dict[str, Any]:
    for c in cols:
        if isinstance(row.get(c), str):
            try:
                row[c] = json.loads(row[c])
            except (ValueError, TypeError):
                pass
    return row


def conference_row(row: Optional[sqlite3.Row]) -> Optional[dict[str, Any]]:
    if row is None:
        return None
    out = dict(row)
    venue = q1(
        """SELECT v.place_id AS main_venue_place_id
           FROM conference_venues v WHERE v.conference_id = ? AND v.is_main = 1""",
        (out["id"],),
    )
    out["main_venue_place_id"] = venue["main_venue_place_id"] if venue else None
    return out


# --- Neon write path ---------------------------------------------------------

def neon_write(sql: str, params: tuple) -> None:
    """Append to Neon. Raises RuntimeError when DATABASE_URL is unset."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL not set; event log writes disabled")
    with psycopg_connect(url) as conn, conn.cursor() as cur:
        cur.execute(sql, params)


# --- models ------------------------------------------------------------------

class EventIn(BaseModel):
    conference_id: str
    event_type: Literal[
        "email_opened", "page_visited", "plan_shown", "plan_opened",
        "plan_saved", "plan_joined", "plan_booked", "plan_cancelled",
        "plan_removed_by_organizer",
    ]
    attendee_id: Optional[str] = None
    experience_id: Optional[str] = None
    window_id: Optional[str] = None
    channel: Optional[Literal["email", "qr", "site"]] = None
    party_size: Optional[int] = Field(default=None, ge=1, le=20)
    price_jpy: Optional[int] = Field(default=None, ge=0)


EVENT_TYPES = frozenset(get_args(EventIn.model_fields["event_type"].annotation))


# --- health ------------------------------------------------------------------

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# --- catalog reads (SQLite) ---------------------------------------------------

@app.get("/api/conferences")
def conferences() -> list[dict[str, Any]]:
    # Same set as the UI: conferences flagged is_demo in the data.
    rows = q(
        """SELECT c.*, v.place_id AS main_venue_place_id
           FROM conferences c
           LEFT JOIN conference_venues v ON v.conference_id = c.id AND v.is_main = 1
           WHERE c.is_demo = 1
           ORDER BY c.id""",
    )
    return rows_json(rows)


@app.get("/api/conferences/{cid}/sessions")
def sessions(cid: str) -> list[dict[str, Any]]:
    return rows_json(q(
        "SELECT * FROM sessions WHERE conference_id = ? ORDER BY day, start_time", (cid,)
    ))


@app.get("/api/conferences/{cid}/windows")
def windows(cid: str) -> list[dict[str, Any]]:
    return rows_json(q(
        "SELECT * FROM windows WHERE conference_id = ? ORDER BY day, start_time", (cid,)
    ))


@app.get("/api/conferences/{cid}/experiences")
def experiences(cid: str) -> list[dict[str, Any]]:
    # Same set as the UI's experiencesForConference: the experiences the
    # simulated log shows at this conference.
    rows = q(
        """SELECT DISTINCT e.* FROM experiences e
           JOIN events ev ON ev.experience_id = e.id
           WHERE ev.conference_id = ?
           ORDER BY e.id""",
        (cid,),
    )
    return rows_json(parse_json_cols(dict(r), ("fields",)) for r in rows)


@app.get("/api/experiences/{eid}")
def experience(eid: str) -> dict[str, Any]:
    row = q1("SELECT * FROM experiences WHERE id = ?", (eid,))
    if row is None:
        raise HTTPException(404, "experience not found")
    out = parse_json_cols(dict(row), ("fields",))
    out["copy"] = {"ja": copy_of(eid, "ja"), "en": copy_of(eid, "en")}
    out["photos"] = rows_json(q(
        "SELECT * FROM experience_photos WHERE experience_id = ? ORDER BY n", (eid,)
    ))
    out["stops"] = rows_json(q(
        "SELECT * FROM experience_stops WHERE experience_id = ? ORDER BY n", (eid,)
    ))
    out["tags"] = rows_json(q(
        """SELECT t.* FROM tags t
           JOIN experience_tags et ON et.tag_id = t.id
           WHERE et.experience_id = ?""",
        (eid,),
    ))
    return out


def copy_of(eid: str, lang: str) -> Optional[dict[str, Any]]:
    row = q1(
        "SELECT * FROM experience_copy WHERE experience_id = ? AND lang = ?", (eid, lang)
    )
    return dict(row) if row else None


@app.get("/api/experiences/{eid}/attendees")
def experience_attendees(
    eid: str, limit: int = Query(default=12, ge=1, le=100)
) -> list[dict[str, Any]]:
    return rows_json(q(
        """SELECT a.* FROM events ev
           JOIN attendees a ON a.id = ev.attendee_id
           WHERE ev.experience_id = ? AND ev.event_type = 'plan_joined'
           GROUP BY a.id ORDER BY MAX(ev.ts) DESC LIMIT ?""",
        (eid, limit),
    ))


@app.get("/api/experiences/{eid}/counts")
def experience_counts(eid: str) -> dict[str, Any]:
    rows = q(
        """SELECT conference_id, COUNT(*) AS c FROM events
           WHERE experience_id = ? AND event_type = 'plan_joined'
           GROUP BY conference_id""",
        (eid,),
    )
    return {r["conference_id"]: r["c"] for r in rows}


@app.get("/api/experiences/{eid}/travel")
def experience_travel(eid: str, venue: Optional[str] = None) -> list[dict[str, Any]]:
    if venue:
        rows = q(
            """SELECT mode, minutes FROM experience_travel
               WHERE experience_id = ? AND venue_place_id = ?""",
            (eid, venue),
        )
        return rows_json(rows)
    return rows_json(q(
        "SELECT mode, minutes FROM experience_travel WHERE experience_id = ?", (eid,)
    ))


@app.get("/api/headlines/{cid}")
def headlines(cid: str) -> list[dict[str, Any]]:
    return rows_json(q(
        "SELECT * FROM headlines WHERE conference_id = ?", (cid,)
    ))


@app.get("/api/attendees/{aid}")
def attendee(aid: str) -> dict[str, Any]:
    row = q1("SELECT * FROM attendees WHERE id = ?", (aid,))
    if row is None:
        raise HTTPException(404, "attendee not found")
    return parse_json_cols(dict(row), ("interests", "tracks"))


@app.get("/api/city")
def city() -> dict[str, Any]:
    estimates = rows_json(q("SELECT * FROM city_estimates ORDER BY start_date"))
    scales = {r["conference_id"]: r["scale"] for r in q(
        "SELECT conference_id, scale FROM simulation_runs"
    )}
    reach_rows = q(
        """SELECT conference_id,
                  SUM(reached) AS reached, COUNT(*) AS total
           FROM attendees GROUP BY conference_id"""
    )
    spend_rows = q(
        """SELECT e.kind AS kind, p.name_en AS area, p.name_ja AS area_ja,
                  ev.price_jpy AS jpy
           FROM events ev
           JOIN experiences e ON e.id = ev.experience_id
           LEFT JOIN places p ON p.id = e.area_id
           WHERE ev.event_type = 'plan_booked'"""
    )
    return {
        "estimates": estimates,
        "scales": scales,
        "reach": rows_json(reach_rows),
        "spend": rows_json(spend_rows),
    }


# --- organizer ---------------------------------------------------------------

@app.get("/api/organize/{cid}")
def organize(cid: str) -> dict[str, Any]:
    conf = conference_row(q1("SELECT * FROM conferences WHERE id = ?", (cid,)))
    if conf is None:
        raise HTTPException(404, "conference not found")
    sessions_ = rows_json(q(
        "SELECT * FROM sessions WHERE conference_id = ? ORDER BY day, start_time", (cid,)
    ))
    windows_ = rows_json(q(
        "SELECT * FROM windows WHERE conference_id = ? ORDER BY day, start_time", (cid,)
    ))
    stats = {r["window_id"]: dict(r) for r in q(
        """SELECT window_id,
                  COUNT(*) AS shown,
                  SUM(CASE WHEN event_type IN ('plan_joined','plan_booked') THEN 1 ELSE 0 END) AS joined
           FROM events WHERE window_id IS NOT NULL AND conference_id = ?
           GROUP BY window_id""",
        (cid,),
    )}
    return {
        "conference": conf,
        "sessions": sessions_,
        "windows": windows_,
        "window_stats": stats,
    }


# --- event log writes (Neon) ---------------------------------------------------

@app.post("/api/events", status_code=204)
def append_event(body: EventIn) -> Response:
    if q1("SELECT 1 FROM conferences WHERE id = ?", (body.conference_id,)) is None:
        raise HTTPException(400, "unknown conference_id")
    if body.experience_id and q1(
        "SELECT 1 FROM experiences WHERE id = ?", (body.experience_id,)
    ) is None:
        raise HTTPException(400, "unknown experience_id")
    if body.window_id and q1(
        "SELECT 1 FROM windows WHERE id = ?", (body.window_id,)
    ) is None:
        raise HTTPException(400, "unknown window_id")
    if body.attendee_id and q1(
        "SELECT 1 FROM attendees WHERE id = ?", (body.attendee_id,)
    ) is None:
        raise HTTPException(400, "unknown attendee_id")
    try:
        neon_write(
            """INSERT INTO events (event_id, ts, conference_id, attendee_id,
                                   experience_id, window_id, event_type, channel,
                                   party_size, price_jpy, simulated)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                str(uuid.uuid4()),
                datetime.now(timezone.utc).isoformat(),
                body.conference_id,
                body.attendee_id,
                body.experience_id,
                body.window_id,
                body.event_type,
                body.channel,
                body.party_size,
                body.price_jpy,
                0,
            ),
        )
    except RuntimeError:
        raise HTTPException(503, "event log unavailable")
    except psycopg.Error:
        # Any database failure (connection, timeout, constraint) fails closed:
        # the UI treats event logging as best-effort and ignores the status.
        raise HTTPException(503, "event log unavailable")
    return Response(status_code=204)
