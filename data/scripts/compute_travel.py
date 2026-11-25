"""Fill plan_travel: minutes from each demo venue to each plan (not extra nights; those use routes).

Walk = straight line x 1.3 at 80 m/min (recon). Beyond 20 min walk, a rough transit estimate:
15 min of walking and waiting plus 2 min per km.
"""
import math


def km(a, b):
    lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def load(db):
    venues = db.execute("""SELECT DISTINCT p.id, p.lat, p.lng FROM conference_venues v
                           JOIN conferences c ON c.id = v.conference_id JOIN places p ON p.id = v.place_id
                           WHERE c.is_demo = 1 AND p.lat IS NOT NULL""").fetchall()
    plans = db.execute("""SELECT pl.id, p.lat, p.lng FROM plans pl JOIN places p ON p.id = pl.place_id
                          WHERE pl.kind != 'extra_night' AND p.lat IS NOT NULL""").fetchall()
    for vid, vlat, vlng in venues:
        for pid, lat, lng in plans:
            d = km((vlat, vlng), (lat, lng))
            walk = round(d * 1000 * 1.3 / 80)
            mode, minutes = ("walk", max(walk, 1)) if walk <= 20 else ("transit", round(15 + 2 * d))
            db.execute("INSERT INTO plan_travel VALUES (?,?,?,?)", (vid, pid, mode, minutes))
