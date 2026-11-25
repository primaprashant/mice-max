"""Build data/micemax.rl, the local RelateDB graph, from data/micemax.db. Runs last in build_db.py.

Nodes keep their SQLite id (node key on every label). JSON-list columns become lists, dates stay ISO text,
lat/lng becomes a point. Sessions, the click log, copy, photos and source URLs stay in SQLite and Neon.
FITS uses simulate.py's own fit rules for a whole window, ignoring any one person's free time.

Nodes: Conference, Window, Experience, Plan, Place (venues, areas, plan sites), Tag, Field, Attendee (simulated).
Relationships:
  (Conference)-[:HAS_WINDOW]->(Window)            (Conference)-[:HELD_AT {is_main}]->(Place)
  (Conference)-[:PREVIOUS_EDITION]->(Conference)  (Conference)-[:IN_FIELD {detail}]->(Field)
  (Conference)-[:SIMILAR_TO {score}]->(Conference)   top 3 by field, size, season and end weekday
  (Experience)-[:HAS_STOP {n, day, offset_min, minutes}]->(Plan)-[:AT]->(Place)-[:IN_AREA]->(Place)
  (Experience)-[:SUITS_FIELD]->(Field)            (Experience)-[:TAGGED]->(Tag)
  (Experience)-[:FITS {travel_min}]->(Window)     (Experience)-[:HEADLINE_FOR {kind, start_time, people_min, people_max}]->(Window)
  (Attendee)-[:ATTENDS]->(Conference)             (Attendee)-[:JOINED {window_id, party_size, booked, cancelled}]->(Experience)
"""
import json
import shutil
from collections import defaultdict
from pathlib import Path

import relate

import simulate as sim

DATA = Path(__file__).resolve().parent.parent
GRAPH = DATA / "micemax.rl"
BATCH = 5000          # rows per statement; far under RelateDB's 64 MiB per commit
SIMILAR_TOP = 3       # SIMILAR_TO edges kept per conference

NODES = {  # label: (SQL, JSON-list columns)
    "Conference": ("""SELECT id, series, edition, name_ja, name_en, start_date, end_date, end_weekday, field,
                      field_detail, scope, attendees, attendees_kind, overseas_attendees, countries, is_demo,
                      program_status FROM conferences""", []),
    "Window": ("""SELECT id, conference_id, day, start_time, end_time, kind, name_ja, name_en, overlaps_program,
                  overlap_note, plan_kinds FROM windows""", ["plan_kinds"]),
    "Experience": ("""SELECT id, kind, is_combo, stop_count, area_id, duration_min, start_from, start_until,
                      price_jpy, price_max_jpy, party_min, party_max, english_ok, needs_agreement, fields, months,
                      days_closed FROM experiences""", ["fields", "months"]),
    "Plan": ("""SELECT id, kind, name_ja, name_en, place_id, duration_min, price_jpy, price_max_jpy, price_basis,
                party_min, party_max, opens, closes, leave_by, days_closed, months, booking_method, payment,
                english_ok, fields, needs_agreement FROM plans""", ["months", "payment", "fields"]),
    "Place": ("SELECT id, name_ja, name_en, kind, area_id, address, lat, lng FROM places", []),
    "Tag": ("SELECT id, label_ja, label_en, icon FROM tags", []),
    "Attendee": ("""SELECT id, conference_id, name_ja, name_en, role, career_stage, home_prefecture, home_country,
                    language, party, arrive_ts, depart_planned_ts, interests, budget_band, tracks, lives_in_city,
                    reached, simulated FROM attendees""", ["interests", "tracks"]),
}


def field_id(v):
    return (v or "").strip().replace(" ", "_")  # same normalisation as simulate.load_conference


def rows(db, sql, lists=()):
    cur = db.execute(sql)
    cols = [d[0] for d in cur.description]
    out = []
    for r in cur:
        d = dict(zip(cols, r))
        for c in lists:
            d[c] = json.loads(d[c]) if d[c] else None
            d[c] = d[c] or None  # empty list → no property
        out.append(d)
    return out


def similar(confs):
    """Score 0..1: same field 0.4 (+0.2 same detail), size ratio 0.2, same season 0.1, both end Fri/Sat or not 0.1."""
    season = {c["id"]: next(k for k, (m, _) in sim.SEASON.items() if int(c["start_date"][5:7]) in m) for c in confs}
    weekend = {c["id"]: c["end_weekday"] in sim.XN_END_DAY for c in confs}
    out = []
    for a in confs:
        scored = []
        for b in confs:
            if a["id"] == b["id"]:
                continue
            s = 0.4 * (bool(a["field"]) and a["field"] == b["field"])
            s += 0.2 * (bool(a["field_detail"]) and a["field_detail"] == b["field_detail"])
            if a["attendees"] and b["attendees"]:
                s += 0.2 * min(a["attendees"], b["attendees"]) / max(a["attendees"], b["attendees"])
            s += 0.1 * (season[a["id"]] == season[b["id"]]) + 0.1 * (weekend[a["id"]] == weekend[b["id"]])
            scored.append((round(s, 2), b["id"]))
        scored.sort(key=lambda x: (-x[0], x[1]))
        out += [{"a": a["id"], "b": bid, "score": s} for s, bid in scored[:SIMILAR_TOP] if s > 0]
    return out


def fits(db):
    """(experience, window, travel_min) for every pair simulate.fits accepts with the whole window free."""
    out = []
    for (cid,) in db.execute("SELECT DISTINCT conference_id FROM windows ORDER BY 1").fetchall():
        C = sim.load_conference(db, cid)
        for w in C["windows"]:
            free = 9999 if w["kind"] == "extra_night" else (w["end"] - w["start"]).total_seconds() / 60
            out += [{"a": e["id"], "b": w["id"], "travel_min": e["travel"]}
                    for e in C["exps"] if sim.fits(None, e, w, free, C)]
    return out


def joins(db):
    """One JOINED per attendee, experience and window, from the event log."""
    seen = defaultdict(lambda: {"party_size": None, "booked": False, "cancelled": False})
    for aid, eid, wid, typ, size in db.execute("""SELECT attendee_id, experience_id, window_id, event_type, party_size
            FROM events WHERE event_type IN ('plan_joined','plan_booked','plan_cancelled') ORDER BY ts, event_id"""):
        if typ == "plan_joined":
            seen[aid, eid, wid]["party_size"] = size
        elif (aid, eid, wid) in seen:
            seen[aid, eid, wid]["booked" if typ == "plan_booked" else "cancelled"] = True
    return [{"a": a, "b": e, "window_id": w, **v} for (a, e, w), v in seen.items() if v["party_size"]]


def relationships(db, confs):
    q = lambda sql: [dict(zip(("a", "b"), r)) for r in db.execute(sql)]
    in_field = [{"a": c["id"], "b": field_id(c[k]), "detail": k == "field_detail"}
                for c in confs for k in ("field", "field_detail") if field_id(c[k])]
    suits = [{"a": eid, "b": field_id(f)} for eid, fs in db.execute("SELECT id, fields FROM experiences WHERE fields IS NOT NULL")
             for f in json.loads(fs) if field_id(f)]
    return {  # type: (from label, to label, rows with a, b and properties)
        "HAS_WINDOW": ("Conference", "Window", q("SELECT conference_id, id FROM windows")),
        "HELD_AT": ("Conference", "Place", [dict(a=a, b=b, is_main=m) for a, b, m in
                                            db.execute("SELECT conference_id, place_id, is_main FROM conference_venues")]),
        "PREVIOUS_EDITION": ("Conference", "Conference",
                             q("SELECT id, previous_id FROM conferences WHERE previous_id IS NOT NULL")),
        "IN_FIELD": ("Conference", "Field", in_field),
        "SUITS_FIELD": ("Experience", "Field", suits),
        "HAS_STOP": ("Experience", "Plan", [dict(a=a, b=b, n=n, day=d, offset_min=o, minutes=m) for a, b, n, d, o, m in
                                            db.execute("""SELECT experience_id, plan_id, n, day, offset_min, minutes
                                                          FROM experience_stops""")]),
        "AT": ("Plan", "Place", q("SELECT id, place_id FROM plans")),
        "IN_AREA": ("Place", "Place", q("SELECT id, area_id FROM places WHERE area_id IS NOT NULL AND area_id != id")),
        "TAGGED": ("Experience", "Tag", q("SELECT experience_id, tag_id FROM experience_tags")),
        "FITS": ("Experience", "Window", fits(db)),
        "ATTENDS": ("Attendee", "Conference", q("SELECT id, conference_id FROM attendees")),
        "JOINED": ("Attendee", "Experience", joins(db)),
        "SIMILAR_TO": ("Conference", "Conference", similar(confs)),
        "HEADLINE_FOR": ("Experience", "Window", [dict(a=e, b=w, kind=k, start_time=s, people_min=lo, people_max=hi)
                                                  for e, w, k, s, lo, hi in db.execute(
                "SELECT experience_id, window_id, kind, start_time, people_min, people_max FROM headlines")]),
    }


def batches(xs):
    for i in range(0, len(xs), BATCH):
        yield xs[i:i + BATCH]


def counts(conn):
    nodes = {r["label"]: r["n"] for r in conn.execute(
        "MATCH (n) UNWIND labels(n) AS label RETURN label, count(*) AS n ORDER BY label").fetchall()}
    rels = {r["type"]: r["n"] for r in conn.execute(
        "MATCH ()-[r]->() RETURN type(r) AS type, count(*) AS n ORDER BY type").fetchall()}
    return nodes, rels


def load(db):
    for p in GRAPH.parent.glob(GRAPH.name + "*"):  # the store and any side files
        shutil.rmtree(p) if p.is_dir() else p.unlink()
    nodes = {label: rows(db, sql, lists) for label, (sql, lists) in NODES.items()}
    fields = {field_id(c[k]) for c in nodes["Conference"] for k in ("field", "field_detail")}
    fields |= {field_id(f) for e in nodes["Experience"] for f in e["fields"] or []}
    nodes["Field"] = [{"id": f} for f in sorted(fields - {""})]
    rels = relationships(db, nodes["Conference"])
    with relate.connect(str(GRAPH)) as conn:
        for label in nodes:
            conn.execute(f"CREATE CONSTRAINT {label.lower()}_id IF NOT EXISTS FOR (n:{label}) REQUIRE n.id IS NODE KEY")
        for label, data in nodes.items():
            for chunk in batches(data):
                for d in chunk:
                    if label == "Place" and d["lat"] is not None:
                        d["location"] = relate.Point(4326, d["lng"], d["lat"])
                    d.pop("lat", None), d.pop("lng", None)
                    for k in [k for k, v in d.items() if v is None]:
                        del d[k]
                conn.execute(f"UNWIND $rows AS r CREATE (n:{label}) SET n = r", {"rows": chunk})
        for typ, (la, lb, data) in rels.items():
            for chunk in batches(data):
                props = [{k: v for k, v in r.items() if k not in ("a", "b") and v is not None} for r in chunk]
                conn.execute(f"""UNWIND $rows AS r MATCH (a:{la} {{id: r.a}}), (b:{lb} {{id: r.b}})
                                 CREATE (a)-[x:{typ}]->(b) SET x = r.props""",
                             {"rows": [{"a": r["a"], "b": r["b"], "props": p} for r, p in zip(chunk, props)]})
        n, r = counts(conn)
    want = {t: len(d) for t, (_, _, d) in rels.items()}
    lost = {t: (want[t], r.get(t, 0)) for t in want if want[t] != r.get(t, 0)}
    print("graph nodes: " + ", ".join(f"{k} {v}" for k, v in n.items()))
    print("graph relationships: " + ", ".join(f"{k} {v}" for k, v in r.items()))
    if lost:
        print(f"graph: relationships with a missing end node (wanted, got): {lost}")
