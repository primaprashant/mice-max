"""Load data/raw/programs/<conference_id>/ into sessions, windows and conferences.attendee_mix.

Each folder holds sessions.csv, windows.csv and mix.json (see T3 in docs/07-data-plan.md), plus headlines.csv:
the one experience per kind the demo opens live (loaded by load_headlines after experiences).
Session buildings are matched to places by Japanese or English name; unmatched names stay in extra.
"""
import csv
import json


def rows(path):
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig") as f:
        return [{k: (v or "").strip() or None for k, v in r.items() if k} for r in csv.DictReader(f)]


def place_lookup(db):
    names = {}
    for pid, ja, en in db.execute("SELECT id, name_ja, name_en FROM places"):
        names[ja] = names[en] = pid
    return names


def load(db, folder, checked_on):
    places = place_lookup(db)
    for conf in sorted(p for p in folder.iterdir() if p.is_dir()):
        cid = conf.name
        if not db.execute("SELECT 1 FROM conferences WHERE id = ?", (cid,)).fetchone():
            print(f"programs: no conference {cid}, skipped")
            continue
        for i, r in enumerate(rows(conf / "sessions.csv"), 1):
            extra = {k: r[k] for k in ("orig_day", "notes", "building") if r.get(k)}
            db.execute(
                """INSERT INTO sessions (id, conference_id, basis, day, start_time, end_time, code, title_ja, title_en,
                     type, track, room, place_id, fee_jpy, source_url, confidence, checked_on, extra)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (f"{cid}-s{i:03d}", cid, r["basis"], r["day"], r["start_time"], r["end_time"], r.get("code"),
                 r.get("title_ja"), r.get("title_en"), r["type"], r.get("track"), r.get("room"),
                 places.get(r.get("building")), r.get("fee_jpy"), r["source_url"], r.get("confidence") or "unsure",
                 checked_on, json.dumps(extra, ensure_ascii=False)),
            )
        for i, r in enumerate(rows(conf / "windows.csv"), 1):
            db.execute(
                """INSERT INTO windows (id, conference_id, day, start_time, end_time, kind, name_ja, name_en,
                     overlaps_program, overlap_note, plan_kinds)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (f"{cid}-w{i:02d}", cid, r["day"], r["start_time"], r["end_time"], r["kind"], r["name_ja"],
                 r["name_en"], int(r.get("overlaps_program") or 0), r.get("overlap_note"), r.get("plan_kinds")),
            )
        mix = conf / "mix.json"
        if mix.exists():
            db.execute("UPDATE conferences SET attendee_mix = ? WHERE id = ?", (mix.read_text(), cid))


def load_headlines(db, folder):
    """headlines.csv per conference: kind, experience_id, window_id, start_time, people_min, people_max, note.
    Run after experiences are built."""
    for path in sorted(folder.glob("*/headlines.csv")):
        cid = path.parent.name
        for r in rows(path):
            db.execute("""INSERT INTO headlines (conference_id, kind, experience_id, window_id, start_time,
                            people_min, people_max, note) VALUES (?,?,?,?,?,?,?,?)""",
                       (cid, r["kind"], r["experience_id"], r["window_id"], r["start_time"], int(r["people_min"]),
                        int(r["people_max"]), r.get("note")))
