"""Load data/raw/plans/*.csv into plans, a plan_site place per plan, tags and plan_tags.

- Coordinates come from data/raw/places/geocode.csv (run geocode.py first).
- Research tags are mapped to the ~20 tags in tags.csv; unmapped ones are kept in plans.extra.
- Image URLs are kept in plans.extra for T5 (photos).
"""
import csv
import hashlib
import json
import re

PREFIX = {"short": "short", "evening": "eve", "extra_night": "xn", "specialist": "spec"}
INT_COLS = ["station_walk_min", "duration_min", "price_jpy", "price_max_jpy", "drinks_included", "party_min",
            "party_max", "private_room_max", "english_ok", "age_min", "free_shuttle", "needs_agreement"]
TEXT_COLS = ["kind", "name_ja", "name_en", "nearest_station", "price_basis", "price_variants", "price_parts",
             "price_note", "opening_hours", "days_closed", "closed_periods", "months", "booking_method", "booking_url",
             "booking_deadline", "booking_opens", "cancellation_policy", "payment", "smoking", "tour_language",
             "fields", "highlight_en", "source_url", "confidence", "checked_on", "notes"]


def read_csv(path):
    with path.open(encoding="utf-8-sig") as f:
        return [{k: (v or "").strip() for k, v in r.items() if k} for r in csv.DictReader(f)]


def as_list(text):
    if not text:
        return []
    if text.startswith("["):
        return json.loads(text)
    return [t.strip() for t in re.split(r"[,;、]", text) if t.strip()]


def as_int(text):
    m = re.search(r"-?\d+", (text or "").replace(",", ""))
    return int(m.group()) if m else None


def plan_id(r, used):
    words = re.findall(r"[a-z0-9]+", r.get("name_en", "").lower())
    slug = "-".join(words[:4]) or hashlib.sha1(r["name_ja"].encode()).hexdigest()[:8]
    base = f"{PREFIX[r['kind']]}-{slug}"
    pid, n = base, 2
    while pid in used:
        pid, n = f"{base}-{n}", n + 1
    used.add(pid)
    return pid


def area_lookup(db):
    return [(ja, en, pid) for pid, ja, en in db.execute("SELECT id, name_ja, name_en FROM places WHERE kind = 'area'")]


def find_area(areas, text):
    for ja, en, pid in areas:
        if text and (ja in text or text in ja or en.lower() in text.lower()):
            return pid
    return None


def load_tags(db, folder):
    raw_to_tag = {}
    for t in read_csv(folder / "tags.csv"):
        db.execute("INSERT INTO tags VALUES (?,?,?,?)", (t["id"], t["label_ja"], t["label_en"], t["icon"]))
        for raw in t["raw_tags"].split(","):
            raw_to_tag.setdefault(raw.strip(), set()).add(t["id"])
        raw_to_tag.setdefault(t["id"], set()).add(t["id"])
    return raw_to_tag


def load(db, folder, places_folder):
    raw_to_tag = load_tags(db, folder)
    geo = {r["address"]: r for r in read_csv(places_folder / "geocode.csv")} if (places_folder / "geocode.csv").exists() else {}
    areas = area_lookup(db)
    used, unmapped = set(), set()
    for path in sorted(folder.glob("*.csv")):
        if path.name == "tags.csv":
            continue
        for r in read_csv(path):
            pid = plan_id(r, used)
            g = geo.get(r.get("address"), {})
            db.execute(
                """INSERT INTO places (id, name_ja, name_en, kind, area_id, address, lat, lng, source_url, confidence, checked_on)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (pid, r["name_ja"], r.get("name_en") or r["name_ja"], "plan_site", find_area(areas, r.get("area")),
                 r.get("address") or None, g.get("lat") or None, g.get("lng") or None, r["source_url"],
                 r.get("confidence") or "unsure", r.get("checked_on")),
            )
            row = {k: r.get(k) or None for k in TEXT_COLS}
            row.update({k: as_int(r.get(k)) for k in INT_COLS})
            row["needs_agreement"] = row["needs_agreement"] or 0
            tags = as_list(r.get("tags"))
            unmapped |= {t for t in tags if t not in raw_to_tag}
            extra = {"area": r.get("area"), "image_urls": as_list(r.get("image_urls")),
                     "image_source_page": r.get("image_source_page"),
                     "raw_tags": [t for t in tags if t not in raw_to_tag], "raw_file": path.name}
            cols = ["id", "place_id", "extra"] + list(row)
            db.execute(f"INSERT INTO plans ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})",
                       [pid, pid, json.dumps(extra, ensure_ascii=False)] + list(row.values()))
            derived = {"non_smoking": row["smoking"] == "none", "private_room": bool(row["private_room_max"]),
                       "english_ok": row["english_ok"] == 1, "free": row["price_jpy"] == 0}
            tag_ids = {t for raw in tags for t in raw_to_tag.get(raw, ())} | {t for t, on in derived.items() if on}
            for tag in tag_ids:
                db.execute("INSERT INTO plan_tags VALUES (?,?)", (pid, tag))
    if unmapped:
        print("plans: unmapped tags:", " ".join(sorted(unmapped)))
