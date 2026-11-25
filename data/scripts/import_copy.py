"""Load data/raw/copy/plan_copy.csv into plan_copy and warn about weak or unverified copy.

Style rules: data/raw/copy/STYLE.md. Every number in the copy must appear in that plan's fields.
Check a draft without rebuilding: python3 data/scripts/import_copy.py <file.csv>
"""
import csv
import re
import sqlite3
import sys
import unicodedata
from pathlib import Path

COLS = ["card_title", "hook", "description", "included", "good_to_know"]
TITLE_MAX = {"ja": 16, "en": 40}
HOOK_MAX = {"ja": 30, "en": 70}
SEPARATORS = "·•—|"
HYPE = ["絶品", "最高", "至福", "大人気", "必見", "must-try", "must try", "unforgettable", "hidden gem", "amazing",
        "stunning", "breathtaking", "world-class"]


def norm(text):
    """NFKC (full-width digits to ASCII) and drop thousands commas."""
    return re.sub(r"(?<=\d),(?=\d{3})", "", unicodedata.normalize("NFKC", text or ""))


def times(text):
    """Clock times as (h, m); '22時' counts as 22:00."""
    return ({(int(h), int(m)) for h, m in re.findall(r"(\d{1,2}):(\d{2})", text)}
            | {(int(h), 0) for h in re.findall(r"(\d{1,2})時(?!間)", text)})


def plan_facts(db):
    """Per plan: (numbers, times) found anywhere in its fields and tags, plus duration in hours."""
    cur = db.cursor()
    cur.row_factory = sqlite3.Row
    tags = {}
    for pid, ja, en in db.execute(
            "SELECT pt.plan_id, t.label_ja, t.label_en FROM plan_tags pt JOIN tags t ON t.id = pt.tag_id"):
        tags.setdefault(pid, []).append(f"{ja} {en}")
    facts = {}
    for r in cur.execute("SELECT * FROM plans"):
        text = norm(" ".join(str(v) for v in tuple(r) if v is not None) + " " + " ".join(tags.get(r["id"], [])))
        nums = set(re.findall(r"\d+(?:\.\d+)?", text)) | {"1"}
        if r["duration_min"]:
            h = r["duration_min"] / 60
            nums |= {f"{h:g}", str(int(h)), f"{round(h * 2) / 2:g}"}
        facts[r["id"]] = (nums, times(text))
    return facts


def check(row, facts):
    """Warnings for one copy row."""
    pid, lang = row["plan_id"], row["lang"]
    if pid not in facts:
        return ["no such plan"]
    out = []
    if len(row["card_title"]) > TITLE_MAX[lang]:
        out.append(f"title {len(row['card_title'])} > {TITLE_MAX[lang]} chars")
    if len(row["hook"]) > HOOK_MAX[lang]:
        out.append(f"hook {len(row['hook'])} > {HOOK_MAX[lang]} chars")
    if "\n" in row["hook"]:
        out.append("hook has a line break")
    n = len([x for x in row["good_to_know"].splitlines() if x.strip()])
    if not 2 <= n <= 4:
        out.append(f"good_to_know has {n} items, want 2-4")
    text = " ".join(row[c] for c in COLS)
    out += [f"separator {c!r}" for c in SEPARATORS if c in text]
    out += ["exclamation mark"] if re.search("[!！]", text) else []
    out += [f"hype word {w!r}" for w in HYPE if w.lower() in text.lower()]
    nums, known_times = facts[pid]
    copy = norm(text)
    for t in times(copy) - known_times:
        out.append(f"time {t[0]}:{t[1]:02d} not in plan fields")
    for x in re.findall(r"\d+(?:\.\d+)?", re.sub(r"\d{1,2}:\d{2}", " ", copy)):
        if x not in nums:
            out.append(f"number {x} not in plan fields")
    return out


def read(path):
    with Path(path).open(encoding="utf-8-sig") as f:
        return [{k: (v or "").strip() for k, v in r.items() if k} for r in csv.DictReader(f)]


def warn_all(rows, facts):
    for r in rows:
        for w in check(r, facts):
            print(f"copy: {r['plan_id']} {r['lang']}: {w}")


def load(db, folder):
    rows = read(folder / "plan_copy.csv")
    facts = plan_facts(db)
    warn_all(rows, facts)
    have = {(r["plan_id"], r["lang"]) for r in rows}
    for pid in sorted(facts):
        for lang in ("ja", "en"):
            if (pid, lang) not in have:
                print(f"copy: {pid} {lang}: missing")
    for r in rows:
        if r["plan_id"] not in facts or len(r["card_title"]) > TITLE_MAX[r["lang"]]:
            continue
        db.execute("INSERT INTO plan_copy (plan_id, lang, card_title, hook, description, included, good_to_know) "
                   "VALUES (?,?,?,?,?,?,?)", [r["plan_id"], r["lang"]] + [r[c] or None for c in COLS])


if __name__ == "__main__":
    db = sqlite3.connect(Path(__file__).resolve().parent.parent / "micemax.db")
    warn_all(read(sys.argv[1]), plan_facts(db))
