"""Rebuild data/micemax.db from schema.sql and the raw files. Safe to re-run.

Usage: python3 data/scripts/build_db.py
"""
import sqlite3
from pathlib import Path

import import_conferences

DATA = Path(__file__).resolve().parent.parent
DB = DATA / "micemax.db"


def main():
    DB.unlink(missing_ok=True)
    db = sqlite3.connect(DB)
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript((DATA / "scripts" / "schema.sql").read_text())
    import_conferences.load(db, DATA / "raw" / "conferences")
    db.commit()
    for (table,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"):
        n = db.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        if n:
            print(f"{table}: {n}")


if __name__ == "__main__":
    main()
