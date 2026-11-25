"""Wipe and reload Neon (Postgres) from data/micemax.db: every table, same columns, keys and indexes.

Usage: .venv/bin/python data/scripts/push_neon.py    (needs DATABASE_URL in .env). Safe to re-run.
Tables are created in dependency order; foreign keys are checked at commit, so the load is one transaction.
"""
import os
import sqlite3
from pathlib import Path

import psycopg

import env

DB = Path(__file__).resolve().parent.parent / "micemax.db"
TYPES = {"TEXT": "text", "INTEGER": "bigint", "REAL": "double precision"}


def tables(db):
    names = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")]
    deps = {t: {r[2] for r in db.execute(f"PRAGMA foreign_key_list({t})")} - {t} for t in names}
    order = []
    while len(order) < len(names):  # parents before children
        order += [t for t in names if t not in order and deps[t] <= set(order)]
    return order


def create_sql(db, t):
    cols = db.execute(f"PRAGMA table_info({t})").fetchall()  # cid, name, type, notnull, default, pk
    lines = [f'"{n}" {TYPES[typ.upper()]}' + (" NOT NULL" if nn else "") + (f" DEFAULT {d}" if d is not None else "")
             for _, n, typ, nn, d, _ in cols]
    pk = [c[1] for c in sorted(cols, key=lambda c: c[5]) if c[5]]
    if pk:
        lines.append("PRIMARY KEY (" + ", ".join(f'"{c}"' for c in pk) + ")")
    fks = {}
    for fk, _, parent, col, pcol, *_ in db.execute(f"PRAGMA foreign_key_list({t})"):  # one key may span columns
        fks.setdefault((fk, parent), []).append((col, pcol or "id"))
    for (_, parent), pairs in fks.items():
        lines.append(f'FOREIGN KEY ({", ".join(c for c, _ in pairs)}) REFERENCES "{parent}" '
                     f'({", ".join(p for _, p in pairs)}) DEFERRABLE INITIALLY DEFERRED')
    return f'CREATE TABLE "{t}" (\n  ' + ",\n  ".join(lines) + "\n)"


def main():
    env.load("DATABASE_URL")
    db = sqlite3.connect(DB)
    order = tables(db)
    indexes = db.execute("SELECT tbl_name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL").fetchall()
    with psycopg.connect(os.environ["DATABASE_URL"]) as pg, pg.cursor() as cur:
        for t in reversed(order):
            cur.execute(f'DROP TABLE IF EXISTS "{t}" CASCADE')
        for t in order:
            cur.execute(create_sql(db, t))
            for _, sql in [i for i in indexes if i[0] == t]:  # before the load: no index builds on pending FK checks
                cur.execute(sql)
            cols = [r[1] for r in db.execute(f"PRAGMA table_info({t})")]
            names = ", ".join(f'"{c}"' for c in cols)
            with cur.copy(f'COPY "{t}" ({names}) FROM STDIN') as copy:
                for row in db.execute(f'SELECT * FROM "{t}"'):
                    copy.write_row(row)
        pg.commit()
        bad = []
        for t in order:
            want = db.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0]
            got = cur.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0]
            bad += [t] if want != got else []
            print(f"{t}: sqlite {want}, neon {got}{'' if want == got else '  MISMATCH'}")
    print("neon: all row counts match" if not bad else f"neon: MISMATCH in {', '.join(bad)}")


if __name__ == "__main__":
    main()
