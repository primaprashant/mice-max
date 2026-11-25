"""Fill experience_travel for the extra-night experiences (kind='extra_night').

plan_travel/compute_travel.py skips extra nights by design (their access is a
route, not a walk from the venue), so experience_travel had no rows for them
and the experience page showed no commute time. The minutes here come from the
recon notes in data/raw/plans/extra_night.csv (Fares: ... legs, resort shuttles
and highway buses), the same figures the price notes quote. One-way total,
transit mode throughout.
"""
import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parents[1] / "micemax.db"

MINUTES = {
    "xn-otaru-canal-front-onsen": 35,
    "xn-otaru-canal-side-onsen": 35,
    "xn-ginrinso-historic-herring-mansion": 40,
    "xn-yoichi-nikka-whisky-distillery": 80,
    "xn-jozankei-onsen-resort-hotel": 60,
    "xn-jozankei-forest-onsen-resort": 60,
    "xn-suizantei-club-jozankei-adults": 60,
    "xn-noboribetsu-dai-ichi-takimotokan": 108,
    "xn-lake-toya-onsen-resort": 150,
    "xn-the-windsor-hotel-toya": 150,
    "xn-niseko-ski-day-at": 120,
    "xn-rusutsu-ski-day-and": 105,
    "xn-kiroro-ski-in-luxury": 100,
    "xn-asahikawa-asahiyama-zoo-with": 85,
    "xn-furano-ski-day-march": 135,
}

db = sqlite3.connect(DB)
venues = [r[0] for r in db.execute("SELECT DISTINCT venue_place_id FROM plan_travel")]
n = 0
for eid, minutes in MINUTES.items():
    if not db.execute("SELECT 1 FROM experiences WHERE id = ?", (eid,)).fetchone():
        raise SystemExit(f"unknown experience: {eid}")
    for venue in venues:
        db.execute(
            "INSERT OR REPLACE INTO experience_travel VALUES (?,?,?,?)",
            (venue, eid, "transit", minutes),
        )
        n += 1
db.commit()
print(f"filled {n} rows for {len(MINUTES)} extra-night experiences from {len(venues)} venues")
