"""Rebuild data/micemax.db from schema.sql and the raw files. Safe to re-run.

Usage: .venv/bin/python data/scripts/build_db.py  (packages: data/requirements.txt)
"""
import datetime as dt
import sqlite3
from pathlib import Path

import build_graph
import city_estimate
import compute_travel
import import_copy
import import_experiences
import import_conferences
import import_photos
import import_places
import import_plans
import import_programs
import simulate

DATA = Path(__file__).resolve().parent.parent
DB = DATA / "micemax.db"


def main():
    DB.unlink(missing_ok=True)
    db = sqlite3.connect(DB)
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript((DATA / "scripts" / "schema.sql").read_text())
    raw = DATA / "raw"
    import_places.load(db, raw / "places")
    import_conferences.load(db, raw / "conferences")
    import_programs.load(db, raw / "programs", dt.date.today().isoformat())
    import_plans.load(db, raw / "plans", raw / "places")
    import_copy.load(db, raw / "copy")
    import_photos.load(db, raw / "photos", DATA / "images", dt.date.today().isoformat())
    compute_travel.load(db)
    import_experiences.load(db, raw / "experiences", raw / "copy")
    import_programs.load_headlines(db, raw / "programs")
    simulate.load(db)
    city_estimate.load(db)
    db.commit()
    for (table,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"):
        n = db.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        if n:
            print(f"{table}: {n}")
    build_graph.load(db)


if __name__ == "__main__":
    main()
