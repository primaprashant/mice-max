"""T9 checks: money, city estimate, facts behind every experience, variety, labels, headlines, online copies.

Usage: .venv/bin/python data/scripts/check_t9.py    (reads data/micemax.db, data/micemax.rl, Neon and Aura).
Prints each check with pass or FAIL, and exits 1 if any fails.
"""
import csv
import json
import os
import sqlite3
import sys
from collections import Counter

import psycopg
import relate

import build_graph
import compute_travel
import env
import push_neo4j
import simulate as sim
from build_graph import DATA

SIMULATED = ["attendees", "session_attendance", "events", "simulation_runs"]
results = []


def check(name, problems, lines=()):
    results.append(not problems)
    print(f"{'pass' if not problems else 'FAIL'}  {name}")
    for line in list(lines) + [f"  problem: {p}" for p in problems[:60]]:
        print(line)
    if len(problems) > 60:
        print(f"  ... and {len(problems) - 60} more")


def kept_joins(db):
    """Joins not cancelled, with the experience's kind and price."""
    exp = {e: (k, p) for e, k, p in db.execute("SELECT id, kind, price_jpy FROM experiences")}
    conf = dict(db.execute("SELECT id, conference_id FROM attendees"))
    return [{**j, "conf": conf[j["a"]], "kind": exp[j["b"]][0], "price": exp[j["b"]][1] or 0}
            for j in build_graph.joins(db) if not j["cancelled"]]


def money(db, joins):
    lines, problems = [], []
    for cid, n, scale in db.execute("SELECT conference_id, conference_attendees, scale FROM simulation_runs ORDER BY 1"):
        js = [j for j in joins if j["conf"] == cid]
        xn = sum(j["price"] * j["party_size"] for j in js if j["kind"] == "extra_night") * scale
        act = sum(j["price"] * j["party_size"] for j in js if j["kind"] != "extra_night") * scale * sim.TRULY_NEW
        lo, hi = sim.money(n, sim.SCENARIOS["Early"]), sim.money(n, sim.SCENARIOS["Strong"])
        lines.append(f"  {cid}: ¥{(xn + act) / 1e6:.2f}M (extra nights ¥{xn / 1e6:.2f}M, activities ¥{act / 1e6:.2f}M), "
                     f"Early ¥{lo / 1e6:.2f}M to Strong ¥{hi / 1e6:.2f}M")
        if not lo <= xn + act <= hi:
            problems.append(f"{cid} outside Early to Strong")
    check("demo conferences' new money inside Early to Strong (simulated, scaled)", problems, lines)


def city(db):
    rows = db.execute("""SELECT id, events, attendees, end_weekday, season, early_jpy, middle_jpy, strong_jpy, is_estimate
                         FROM city_estimates ORDER BY id = 'other', middle_jpy DESC""").fetchall()
    total = [sum(r[i] for r in rows) for i in (5, 6, 7)]
    lines = [f"  {'':20} {'events':>6} {'attendees':>9}  {'ends':4} {'season':7} {'Early':>8} {'Middle':>8} {'Strong':>8}"]
    lines += [f"  {r[0]:20} {r[1]:6} {r[2]:9,}  {r[3] or '':4} {r[4] or '':7} {r[5] / 1e6:7.2f}M {r[6] / 1e6:7.2f}M "
              f"{r[7] / 1e6:7.2f}M" for r in rows]
    lines.append(f"  {'total (estimate)':20} {sum(r[1] for r in rows):6} {sum(r[2] for r in rows):9,}  {'':12} "
                 f"{total[0] / 1e6:7.1f}M {total[1] / 1e6:7.1f}M {total[2] / 1e6:7.1f}M")
    problems = [f"{r[0]} not labelled estimate" for r in rows if r[8] != 1]
    problems += [f"{r[0]} not Early <= Middle <= Strong" for r in rows if not r[5] <= r[6] <= r[7]]
    if sum(r[1] for r in rows) != 466 or sum(r[2] for r in rows) != 109311:
        problems.append("rows don't add up to 466 events and 109,311 attendees [S1]")
    check("city estimate, next 12 months (money formula, estimate)", problems, lines)


def mins(hhmm):
    h, m = map(int, hhmm.split(":"))
    return 60 * h + m


def facts(db):
    """Every price, time and place an experience shows comes from plans, experience_stops, places or sessions."""
    q = lambda sql: db.execute(sql).fetchall()
    problems = []
    with open(DATA / "raw" / "experiences" / "combos.csv", encoding="utf-8") as f:
        extra = {r["id"]: int(r["extra_jpy"] or 0) for r in csv.DictReader(f)}
    plans = {r[0]: r for r in q("SELECT id, price_jpy, price_max_jpy, price_variants, opens, closes, place_id FROM plans")}
    stops = {}
    for row in q("SELECT experience_id, n, plan_id, day, offset_min, minutes, travel_min, price_jpy FROM experience_stops ORDER BY 1, 2"):
        stops.setdefault(row[0], []).append(row)
    exps = q("SELECT id, is_combo, price_jpy, start_from, start_until, area_id, kind FROM experiences")
    # Price: the stops' prices plus the combo's extra transport; each stop's price is one the plan lists.
    for eid, combo, price, *_ in exps:
        st = stops[eid]
        want = sum(s[7] or 0 for s in st) + extra.get(eid, 0) if any(s[7] is not None for s in st) or extra.get(eid) else None
        if price != want:
            problems.append(f"{eid} price {price}, stops plus extra give {want}")
        for s in st:
            p = plans[s[2]]
            listed = {p[1], p[2]} | {v.get("price_jpy") for v in json.loads(p[3] or "[]")}
            top = max(x for x in listed if x is not None) if listed - {None} else None
            if s[7] is not None and s[7] not in listed and not (top and 0 <= s[7] <= top):  # part of an all-in price is ok
                problems.append(f"{eid} stop {s[1]} price {s[7]} not listed for plan {s[2]}")
    bad_events = q("""SELECT count(*) FROM events v JOIN experiences e ON e.id = v.experience_id
                      WHERE v.price_jpy IS NOT NULL AND v.price_jpy != e.price_jpy""")[0][0]
    if bad_events:
        problems.append(f"{bad_events} events with a price that isn't the experience's")
    # Time: start bounds keep every day-1 stop inside its plan's opening hours.
    for eid, _, _, start_from, start_until, _, kind in exps:
        for _, n, pid, day, offset, minutes, *_ in stops[eid]:
            opens, closes = plans[pid][4], plans[pid][5]
            if day != 1 or kind == "extra_night":
                continue
            if opens and (start_from is None or mins(start_from) + offset < mins(opens)):
                problems.append(f"{eid} stop {n} can start before {pid} opens ({opens})")
            if closes and (start_until is None or mins(start_until) + offset + (minutes or 0) > mins(closes)):
                problems.append(f"{eid} stop {n} can run past {pid} closing ({closes})")
    # Place and travel: area is the first stop's area; venue travel recomputed from places' coordinates.
    area = {pid: a or pid for pid, a in q("SELECT id, area_id FROM places")}
    has_area = {pid for pid, a in q("SELECT id, area_id FROM places") if a}
    coords = {pid: (lat, lng) for pid, lat, lng in q("SELECT id, lat, lng FROM places")}
    for eid, *_, area_id, _ in exps:
        first = plans[stops[eid][0][2]][6]
        if area_id != (area[first] if first in has_area else None) and area_id != first:
            problems.append(f"{eid} area {area_id}, first stop is in {area[first]}")
    for venue, eid, mode, minutes in q("SELECT venue_place_id, experience_id, mode, minutes FROM experience_travel"):
        d = compute_travel.km(coords[venue], coords[plans[stops[eid][0][2]][6]])
        walk = round(d * 1000 * 1.3 / 80)
        want = ("walk", max(walk, 1)) if walk <= 20 else ("transit", round(15 + 2 * d))
        if (mode, minutes) != want:
            problems.append(f"{eid} from {venue}: {mode} {minutes} min, places give {want[0]} {want[1]} min")
    routes = {(a, b): m for a, b, m in q("SELECT from_place_id, to_place_id, min(minutes) FROM routes GROUP BY 1, 2")}
    for eid, st in stops.items():
        for prev, s in zip(st, st[1:]):
            if s[3] != prev[3]:
                continue  # next day starts at the hotel
            a, b = area[plans[prev[2]][6]], area[plans[s[2]][6]]
            if s[6] is None:
                problems.append(f"{eid} stop {s[1]} has no travel time from stop {prev[1]}")
            elif (a, b) in routes and s[6] < routes[a, b] or (b, a) in routes and s[6] < routes[b, a]:
                problems.append(f"{eid} stop {s[1]} travel {s[6]} min, faster than the route {a} to {b}")
    # Windows: no clash with sessions unless marked as overlapping (D26); offered pairs and headlines fit.
    # All-day displays (simulate.DROP_IN_MIN or longer) are drop-in and don't count, as in the simulator.
    for wid, cid, day, w0, w1, overlaps, note in q("""SELECT id, conference_id, day, start_time, end_time,
                                                     overlaps_program, overlap_note FROM windows"""):
        clash = sum(mins(s1) - mins(s0) < sim.DROP_IN_MIN for s0, s1 in db.execute(
            """SELECT start_time, end_time FROM sessions WHERE conference_id = ? AND day = ? AND start_time < ?
               AND ? < end_time AND type NOT IN ('social', 'excursion')""", (cid, day, w1, w0)))
        if not overlaps and clash:
            problems.append(f"{wid} clashes with {clash} sessions but isn't marked as overlapping")
        if overlaps and not note:
            problems.append(f"{wid} overlaps the program with no note")
        days = db.execute("SELECT min(day), max(day) FROM sessions WHERE conference_id = ?", (cid,)).fetchone()
        if not days[0] <= day <= days[1]:
            problems.append(f"{wid} on {day}, outside the program days")
    fit = {(f["a"], f["b"]) for f in build_graph.fits(db)}
    joined = {(e, w) for e, w in q("SELECT DISTINCT experience_id, window_id FROM events WHERE event_type = 'plan_joined'")}
    problems += [f"{e} joined in {w}, which it doesn't fit" for e, w in sorted(joined - fit)]
    for eid, wid, start in q("SELECT experience_id, window_id, start_time FROM headlines"):
        if (eid, wid) not in fit:
            problems.append(f"headline {eid} doesn't fit {wid}")
    check("experiences: prices, times and places all come from plans, stops, places, routes and sessions", problems,
          [f"  {len(exps)} experiences, {sum(map(len, stops.values()))} stops, {len(joined)} joined pairs checked"])


TOP_SHARE_MAX = 0.5  # fail if one experience is picked by half the active people or more


def variety(db, joins):
    lines, problems = [], []
    for cid in sorted({j["conf"] for j in joins}):
        js = [j for j in joins if j["conf"] == cid]
        active = len({j["a"] for j in js})
        (top, n), = Counter(j["b"] for j in js).most_common(1)
        lines.append(f"  {cid}: most picked {top}, {n / active:.0%} of {active} active people; "
                     f"{len({j['b'] for j in js})} experiences picked")
        if n / active >= TOP_SHARE_MAX:
            problems.append(f"{cid}: {top} picked by {n / active:.0%}")
    offered = {f["a"] for f in build_graph.fits(db)}
    never = offered - {j["b"] for j in joins}
    lines.append(f"  never picked: {len(never)} of {len(offered)} offered (fine, D28)")
    check("variety: no experience everybody picks", problems, lines)


def labels(db, pg):
    lines, problems = [], []
    for t in SIMULATED:
        a = db.execute(f"SELECT count(*), sum(simulated != 1) FROM {t}").fetchone()
        b = pg.execute(f"SELECT count(*), sum(CASE WHEN simulated != 1 THEN 1 ELSE 0 END) FROM {t}").fetchone()
        lines.append(f"  {t}: {a[0]} rows, unlabelled sqlite {a[1] or 0}, neon {b[1] or 0}")
        if a[1] or b[1]:
            problems.append(f"{t} has rows without simulated = 1")
    check("everything simulated carries simulated = 1 (SQLite and Neon)", problems, lines)


def headlines(db, joins):
    lines, problems = [], []
    for cid, eid, wid, lo, hi in db.execute("""SELECT conference_id, experience_id, window_id, people_min, people_max
                                              FROM headlines ORDER BY 1, 2"""):
        ppl = sum(j["party_size"] for j in joins if j["b"] == eid and j["window_id"] == wid)
        lines.append(f"  {cid} {eid} in {wid}: {ppl} people (want {lo} to {hi})")
        if not lo <= ppl <= hi:
            problems.append(f"{eid} has {ppl} people")
    check("headlines (D29) inside their people range", problems, lines)


def online(db, pg):
    tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")]
    problems = []
    for t in tables:
        a, b = db.execute(f"SELECT count(*) FROM {t}").fetchone()[0], pg.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0]
        problems += [f"neon {t}: {b}, sqlite {a}"] if a != b else []
    with relate.connect(str(build_graph.GRAPH), read_only=True) as conn:
        local = build_graph.counts(conn)
        local_examples = [len(conn.execute(q).fetchall()) for q in push_neo4j.examples()]
    driver, database = push_neo4j.connect()
    with driver:
        remote = push_neo4j.counts(driver, database)
        remote_examples = [len(driver.execute_query(q, database_=database).records) for q in push_neo4j.examples()]
    for i, kind in enumerate(("nodes", "relationships")):
        problems += [f"aura {kind} {k}: {remote[i].get(k, 0)}, rl {v}" for k, v in local[i].items() if remote[i].get(k) != v]
        problems += [f"aura has extra {kind} {k}" for k in set(remote[i]) - set(local[i])]
    if local_examples != remote_examples:
        problems.append(f"example queries return {remote_examples} rows on Aura, {local_examples} on the .rl file")
    check("online copies match", problems, [
        f"  neon: {len(tables)} tables, {sum(db.execute(f'SELECT count(*) FROM {t}').fetchone()[0] for t in tables):,} rows",
        f"  aura: {sum(remote[0].values()):,} nodes in {len(remote[0])} labels, {sum(remote[1].values()):,} relationships "
        f"in {len(remote[1])} types",
        f"  example queries, rows on .rl and Aura: {local_examples}, {remote_examples}"])


def main():
    env.load("DATABASE_URL")
    db = sqlite3.connect(DATA / "micemax.db")
    joins = kept_joins(db)
    money(db, joins)
    city(db)
    facts(db)
    variety(db, joins)
    headlines(db, joins)
    with psycopg.connect(os.environ["DATABASE_URL"]) as pg:
        labels(db, pg)
        online(db, pg)
    print(f"\nT9: {sum(results)} of {len(results)} checks pass")
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
