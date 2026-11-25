"""Load data/raw/places/{places,routes,seasons,city_events}.csv. CSV headers match the table columns."""
import csv

FILES = ["places", "routes", "seasons", "city_events"]


def load(db, folder):
    for name in FILES:
        path = folder / f"{name}.csv"
        if not path.exists():
            continue
        with path.open(encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))
        if name == "places":  # parents (areas) first, so area_id references resolve
            rows.sort(key=lambda r: bool(r.get("area_id")))
        for r in rows:
            cols = [k for k in r if k]
            db.execute(f"INSERT INTO {name} ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})",
                       [(r[k] or "").strip() or None for k in cols])
