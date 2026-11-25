"""Load data/raw/photos/batch-*.csv and data/images/<plan_id>/<n>.jpg into plan_photos.

The hero is the largest landscape photo unless data/raw/photos/heroes.csv picks one.

Photos are fetched with fetch_photo.sh (T5). Size and dominant colour are measured with ImageMagick.
Notes may hold "focal x,y" and "square" (both dropped from alt text);
notes_ja and notes say what the photo shows and feed the alt text.
"""
import csv
import re
import subprocess

LISTING_SITES = ("hotpepper.jp", "gnavi.co.jp", "gnst.jp", "tabelog.com", "jalan.net", "rakuten.co.jp", "ikyu.com",
                 "asoview.com", "veltra.com", "tripadvisor", "retty.me", "jtb.co.jp", "booking.com", "klook.com",
                 "wikimedia.org", "viator.com")


def measure(path):
    """Width, height and the most common of 4 reduced colours as #rrggbb."""
    w, h = subprocess.run(["identify", "-quiet", "-format", "%w %h", f"jpeg:{path}"],
                          capture_output=True, text=True, check=True).stdout.split()
    hist = subprocess.run(["convert", "-quiet", f"jpeg:{path}", "-scale", "64x64!", "-colors", "4", "-format", "%c",
                           "histogram:info:-"], capture_output=True, text=True, check=True).stdout
    _, colour = max((int(m[0]), m[1]) for m in re.findall(r"(\d+):.*?#([0-9A-Fa-f]{6})", hist))
    return int(w), int(h), "#" + colour.lower()


def load(db, folder, images, checked_on):
    names = {pid: (ja, en) for pid, ja, en in db.execute("SELECT id, name_ja, name_en FROM plans")}
    rows = []
    for path in sorted(folder.glob("batch-*.csv")):
        with path.open(encoding="utf-8-sig") as f:
            rows += [{k: (v or "").strip() for k, v in r.items() if k} for r in csv.DictReader(f)]
    for r in rows:
        pid, n = r["plan_id"], int(r["n"])
        file = images / pid / f"{n}.jpg"
        if pid not in names or not file.exists():
            print(f"photos: skipped {pid}/{n} (no plan or no file)")
            continue
        w, h, colour = measure(file)
        notes = r.get("notes", "")
        focal = re.search(r"focal\s*([\d.]+)\s*,\s*([\d.]+)", notes)
        shows_en = re.sub(r"[;,]?\s*(focal\s*[\d.]+\s*,\s*[\d.]+|square\b)", "", notes).strip(" ;,()")
        shows_en = shows_en[:1].upper() + shows_en[1:]
        shows_ja = r.get("notes_ja") or ""
        ja, en = names[pid]
        listing = any(s in r["source_url"] for s in LISTING_SITES)
        db.execute(
            """INSERT INTO plan_photos (plan_id, n, path, width, height, dominant_color, focal_x, focal_y, alt_ja, alt_en,
                 image_url, source_url, confidence, checked_on, extra) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (pid, n, f"data/images/{pid}/{n}.jpg", w, h, colour,
             float(focal[1]) if focal else 0.5, float(focal[2]) if focal else 0.5,
             f"{ja}：{shows_ja}" if shows_ja else ja, ": ".join(x for x in (en, shows_en) if x) or ja,
             r.get("image_url") or None, r["source_url"], "reported" if listing else "checked", checked_on,
             '{"has_text": 1}' if r.get("has_text") == "1" else None),
        )
    # One hero per plan: the largest landscape photo, else the largest.
    db.execute("""UPDATE plan_photos SET is_hero = 1 WHERE rowid IN (
                    SELECT (SELECT rowid FROM plan_photos p WHERE p.plan_id = q.plan_id
                            ORDER BY width > height DESC, width * height DESC, n LIMIT 1)
                    FROM (SELECT DISTINCT plan_id FROM plan_photos) q)""")
    # Hand-picked heroes override the rule (heroes.csv: plan_id, n, reason).
    if (folder / "heroes.csv").exists():
        with (folder / "heroes.csv").open(encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                db.execute("UPDATE plan_photos SET is_hero = 0 WHERE plan_id = ?", (r["plan_id"],))
                db.execute("UPDATE plan_photos SET is_hero = 1 WHERE plan_id = ? AND n = ?", (r["plan_id"], int(r["n"])))
    missing = [pid for pid in names if not db.execute("SELECT 1 FROM plan_photos WHERE plan_id = ?", (pid,)).fetchone()]
    if missing:
        print(f"photos: {len(missing)} plans without photos (see data/raw/photos/NOTES.md)")
