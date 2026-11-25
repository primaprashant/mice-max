"""Build experiences: every plan as a one-stop experience, plus combos that chain several plans.

Combos come from data/raw/experiences/:
- combos.csv: id, kind, fields, extra_jpy (transport not in any stop), price_note, hero_plan, notes
- stops.csv: experience_id, n, plan_id, day, minutes, travel_mode, travel_min, price_jpy, what_ja, what_en
  Blank minutes or price_jpy fall back to the plan's own; blank travel is estimated from coordinates.
Combo copy is in data/raw/copy/experience_copy.csv and checked like plan copy.
start_from and start_until come from the stops' opens, closes and leave_by (hours.csv).
Run after plans, copy, photos and travel are loaded.
"""
import json
import sqlite3

import import_copy
from compute_travel import km

EXP_COLS = ["id", "kind", "is_combo", "stop_count", "area_id", "duration_min", "price_jpy", "price_max_jpy",
            "price_note", "party_min", "party_max", "english_ok", "needs_agreement", "fields", "months",
            "days_closed", "notes", "start_from", "start_until"]
STOP_COLS = ["experience_id", "n", "plan_id", "day", "offset_min", "minutes", "travel_mode", "travel_min",
             "price_jpy", "what_ja", "what_en"]


def insert(db, table, cols, values):
    db.execute(f"INSERT INTO {table} ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", values)


def as_int(text):
    return int(text) if text not in (None, "") else None


def mins(hhmm):
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def hhmm(n):
    return f"{n // 60:02d}:{n % 60:02d}"


def start_bounds(stops, plans):
    """Earliest and latest start ('HH:MM') so each day-1 stop is open when you get there.
    stops: (plan_id, day, offset_min, minutes). Extra nights' leave_by caps the latest start."""
    lo, hi = [], []
    for pid, day, offset, minutes in stops:
        p = plans[pid]
        if day != 1:
            continue
        if p["opens"]:
            lo.append(mins(p["opens"]) - offset)
        if p["closes"]:
            hi.append(mins(p["closes"]) - offset - (minutes or 0))
        if p["leave_by"]:
            hi.append(mins(p["leave_by"]) - offset)
    return (hhmm(max(0, max(lo))) if lo else None), (hhmm(max(0, min(hi))) if hi else None)


def estimate(a, b):
    """Walk if under 20 min (straight line x 1.3 at 80 m/min), else a rough transit time, as in compute_travel."""
    if not (a["lat"] and b["lat"]):
        return None, None
    d = km((a["lat"], a["lng"]), (b["lat"], b["lng"]))
    walk = round(d * 1000 * 1.3 / 80)
    return ("walk", max(walk, 1)) if walk <= 20 else ("transit", round(15 + 2 * d))


def singles(db, plans):
    for p in plans.values():
        insert(db, "experiences", EXP_COLS,
               [p["id"], p["kind"], 0, 1, p["area_id"]] + [p[c] for c in EXP_COLS[5:16]] + [None]
               + list(start_bounds([(p["id"], 1, 0, p["duration_min"])], plans)))
        insert(db, "experience_stops", STOP_COLS,
               [p["id"], 1, p["id"], 1, 0, p["duration_min"], None, None, p["price_jpy"], None, None])
    db.execute("""INSERT INTO experience_copy SELECT plan_id, lang, card_title, hook, description, included,
                  good_to_know, checked_by_human FROM plan_copy""")
    db.execute("""INSERT INTO experience_photos SELECT plan_id, n, plan_id, path, width, height, dominant_color,
                  focal_x, focal_y, alt_ja, alt_en, is_hero FROM plan_photos""")
    db.execute("INSERT INTO experience_tags SELECT plan_id, tag_id FROM plan_tags")
    db.execute("INSERT INTO experience_travel SELECT venue_place_id, plan_id, mode, minutes FROM plan_travel")


def combo_stops(c, stops, plans):
    """Stop rows with offsets and travel worked out."""
    rows, prev, day, offset = [], None, 1, 0
    for s in stops:
        p = plans[s["plan_id"]]
        d = as_int(s.get("day")) or 1
        mode, travel = None, as_int(s.get("travel_min"))
        if d != day:  # a new day starts at the hotel; travel only if given
            day, offset = d, 0
        elif prev and travel is None:
            mode, travel = estimate(prev, p)
        if travel is not None:
            mode = mode or s.get("travel_mode") or ("transit" if travel > 20 else "walk")
            offset += travel
        minutes = as_int(s.get("minutes")) or p["duration_min"]
        price = as_int(s.get("price_jpy")) if s.get("price_jpy") else p["price_jpy"]
        rows.append([c["id"], int(s["n"]), p["id"], d, offset, minutes, mode, travel, price,
                     s.get("what_ja"), s.get("what_en")])
        offset += minutes or 0
        prev = p
    return rows, offset


def add_combo(db, c, stops, plans):
    missing = [s["plan_id"] for s in stops if s["plan_id"] not in plans]
    if missing or not stops:
        print(f"experiences: {c['id']}: skipped, unknown stops {missing}")
        return
    rows, end = combo_stops(c, stops, plans)
    ps = [plans[s["plan_id"]] for s in stops]
    prices = [r[8] for r in rows if r[8] is not None]
    extra = as_int(c.get("extra_jpy")) or 0
    english = [p["english_ok"] for p in ps]
    months = [set(json.loads(p["months"])) for p in ps if p["months"]]
    fields = json.loads(c["fields"]) if c.get("fields") else sorted({f for p in ps for f in json.loads(p["fields"] or "[]")})
    closed = [f"{p['name_en'] or p['name_ja']}: {p['days_closed']}" for p in ps if p["days_closed"]]
    insert(db, "experiences", EXP_COLS, [
        c["id"], c["kind"], 1, len(ps), ps[0]["area_id"],
        end if c["kind"] != "extra_night" and all(r[3] == 1 for r in rows) else None,
        sum(prices) + extra if prices or extra else None, None, c.get("price_note") or None,
        max((p["party_min"] for p in ps if p["party_min"]), default=None),
        min((p["party_max"] for p in ps if p["party_max"]), default=None),
        0 if 0 in english else 1 if all(e == 1 for e in english) else None,
        max(p["needs_agreement"] for p in ps),
        json.dumps(fields) if fields else None,
        json.dumps(sorted(set.intersection(*months))) if months else None,
        "\n".join(closed) or None, c.get("notes") or None,
        *start_bounds([(r[2], r[3], r[4], r[5]) for r in rows], plans)])
    for r in rows:
        insert(db, "experience_stops", STOP_COLS, r)
    hero = c.get("hero_plan") or ps[0]["id"]
    for n, p in enumerate(ps, 1):
        photo = db.execute("""SELECT path, width, height, dominant_color, focal_x, focal_y, alt_ja, alt_en, n
                              FROM plan_photos WHERE plan_id = ? ORDER BY is_hero DESC, n LIMIT 1""", (p["id"],)).fetchone()
        if photo:
            db.execute("INSERT INTO experience_photos VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                       (c["id"], n, p["id"], *photo[:8], int(p["id"] == hero)))
    db.execute("""INSERT OR IGNORE INTO experience_tags SELECT ?, tag_id FROM plan_tags
                  WHERE plan_id IN (%s)""" % ",".join("?" * len(ps)), [c["id"]] + [p["id"] for p in ps])
    db.execute("INSERT INTO experience_travel SELECT venue_place_id, ?, mode, minutes FROM plan_travel WHERE plan_id = ?",
               (c["id"], ps[0]["id"]))


def combo_facts(db, plan_facts, combo_ids):
    """Numbers and times a combo's copy may use: its stops' fields plus its own derived values."""
    facts = {}
    for cid in combo_ids:
        nums, times = {"1"}, set()
        for (pid,) in db.execute("SELECT plan_id FROM experience_stops WHERE experience_id = ?", (cid,)):
            nums |= plan_facts[pid][0]
            times |= plan_facts[pid][1]
        rows = db.execute("SELECT * FROM experiences WHERE id = ?", (cid,)).fetchall()
        rows += db.execute("SELECT * FROM experience_stops WHERE experience_id = ?", (cid,)).fetchall()
        text = import_copy.norm(" ".join(str(v) for r in rows for v in r if v is not None))
        nums |= {import_copy.num(x) for x in import_copy.re.findall(r"\d+(?:\.\d+)?", text)}
        times |= import_copy.times(text)
        (duration,) = db.execute("SELECT duration_min FROM experiences WHERE id = ?", (cid,)).fetchone()
        if duration:
            h = duration / 60
            nums |= {f"{h:g}", str(int(h)), f"{round(h * 2) / 2:g}"}
        facts[cid] = (nums, times)
    return facts


def load_copy(db, path, combo_ids):
    rows = import_copy.read(path) if path.exists() else []
    for r in rows:
        r["plan_id"] = r["experience_id"]
    facts = combo_facts(db, import_copy.plan_facts(db), combo_ids)
    import_copy.warn_all(rows, facts)
    have = {(r["plan_id"], r["lang"]) for r in rows}
    for cid in combo_ids:
        for lang in ("ja", "en"):
            if (cid, lang) not in have:
                print(f"copy: {cid} {lang}: missing")
    for r in rows:
        if r["plan_id"] in facts and len(r["card_title"]) <= import_copy.TITLE_MAX[r["lang"]]:
            insert(db, "experience_copy", ["experience_id", "lang"] + import_copy.COLS,
                   [r["plan_id"], r["lang"]] + [r[c] or None for c in import_copy.COLS])


def load(db, folder, copy_folder):
    cur = db.cursor()
    cur.row_factory = sqlite3.Row
    plans = {r["id"]: r for r in cur.execute(
        "SELECT p.*, pl.lat, pl.lng, pl.area_id FROM plans p JOIN places pl ON pl.id = p.place_id")}
    singles(db, plans)
    stops = import_copy.read(folder / "stops.csv")
    combos = import_copy.read(folder / "combos.csv")
    for c in combos:
        add_combo(db, c, sorted((s for s in stops if s["experience_id"] == c["id"]), key=lambda s: int(s["n"])), plans)
    done = [r[0] for r in db.execute("SELECT id FROM experiences WHERE is_combo = 1")]
    load_copy(db, copy_folder / "experience_copy.csv", done)
