"""Load data/raw/conferences/*.csv into conferences, conference_venues and venue places.

The same event often appears in several CSVs. Rows are merged when they share a
start date (within 3 days) and similar name, or series+edition. Non-empty
values win; on conflict the better confidence wins, then enrich-*.csv rows.
"""
import csv
import datetime as dt
import hashlib
import json
import sqlite3
import re

RANK = {"checked": 0, "reported": 1, "unsure": 2}
INT_COLS = ["name_en_ours", "edition", "is_public", "attendees", "overseas_attendees", "countries"]


def read_rows(folder):
    rows = []
    for path in sorted(folder.glob("*.csv")):
        checked_on = dt.date.fromtimestamp(path.stat().st_mtime).isoformat()
        with path.open(encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                r = {k.strip(): (v or "").strip() for k, v in r.items() if k}
                if not r.get("start_date") or not r.get("source_url"):
                    continue
                r.setdefault("checked_on", checked_on)
                r["_file"] = path.name
                rows.append(r)
    return rows


def norm(name):
    return re.sub(r"[\s　・()（）「」『』,、.:：\-–]", "", name.lower())


def bigrams(name):
    n = norm(name)
    return {n[i:i + 2] for i in range(len(n) - 1)}


def similar(x, y):
    a, b = bigrams(x), bigrams(y)
    return bool(a and b) and len(a & b) / len(a | b) > 0.5


def numbers(name):
    return set(re.findall(r"\d+", name))


def same_event(a, b):
    if a.get("edition") and b.get("edition") and a["edition"] != b["edition"]:
        return False
    if a.get("series") and a.get("series") == b.get("series") and a.get("edition") == b.get("edition"):
        return True
    days = abs((dt.date.fromisoformat(a["start_date"]) - dt.date.fromisoformat(b["start_date"])).days)
    if days > 3:
        return False
    for k in ("name_ja", "name_en"):
        x, y = a.get(k, ""), b.get(k, "")
        if numbers(x) and numbers(y) and not numbers(x) & numbers(y):
            return False
        if similar(x, y):
            return True
    return False


def merge(group):
    group.sort(key=lambda r: (RANK.get(r.get("confidence"), 3), not r["_file"].startswith("enrich")))
    out = dict(group[0])
    for r in group[1:]:
        for k, v in r.items():
            if v and not out.get(k):
                out[k] = v
    out["_files"] = sorted({r["_file"] for r in group})
    return out


def dedupe(rows):
    groups = []
    for r in rows:
        for g in groups:
            if same_event(g[0], r):
                g.append(r)
                break
        else:
            groups.append([r])
    return [merge(g) for g in groups]


def make_id(r, used):
    if r.get("series") and r.get("edition"):
        base = f"{r['series']}{r['edition']}"
    elif r.get("series"):
        base = f"{r['series']}{r['start_date'][:4]}"
    else:
        words = re.findall(r"[a-z0-9]+", r.get("name_en", "").lower())
        base = "-".join(words[:4]) or "conf"
        base = f"{base}-{r['start_date'][:4]}"
    cid, n = base, 2
    while cid in used:
        cid, n = f"{base}-{n}", n + 1
    used.add(cid)
    return cid


def venue_id(name):
    return "venue-" + hashlib.sha1(name.encode()).hexdigest()[:8]


COLS = ["id", "series", "edition", "name_ja", "name_en", "name_en_ours", "start_date", "end_date", "end_weekday",
        "field", "field_detail", "scope", "is_public", "attendees", "attendees_kind", "overseas_attendees",
        "countries", "organizer", "pco", "website_url", "program_status", "source_url", "confidence",
        "checked_on", "notes", "extra"]


def conference_row(cid, r):
    row = {k: (r.get(k) or None) for k in COLS}
    row.update({k: (int(float(r[k])) if r.get(k) else None) for k in INT_COLS})
    row["id"] = cid
    row["name_en_ours"] = row["name_en_ours"] or 0
    row["end_date"] = row["end_date"] or r["start_date"]
    row["end_weekday"] = dt.date.fromisoformat(row["end_date"]).strftime("%a")
    row["confidence"] = row["confidence"] or "unsure"
    row["extra"] = json.dumps({"raw_files": r["_files"]})
    return row


def load(db, folder):
    used = set()
    for r in dedupe(read_rows(folder)):
        cid = make_id(r, used)
        try:
            row = conference_row(cid, r)
            db.execute(f"INSERT INTO conferences ({','.join(COLS)}) VALUES ({','.join('?' * len(COLS))})",
                       [row[k] for k in COLS])
        except (sqlite3.IntegrityError, ValueError) as e:
            print(f"skipped {cid}: {e}")
            continue
        for i, name in enumerate(v.strip() for v in r.get("venues", "").split(";")):
            if not name:
                continue
            pid = venue_id(name)
            db.execute(
                """INSERT OR IGNORE INTO places (id, name_ja, name_en, kind, source_url, confidence, checked_on)
                   VALUES (?,?,?,?,?,?,?)""",
                (pid, name, name, "venue", r["source_url"], "unsure", r["checked_on"]),
            )
            db.execute("INSERT OR IGNORE INTO conference_venues VALUES (?,?,?)", (cid, pid, int(i == 0)))
