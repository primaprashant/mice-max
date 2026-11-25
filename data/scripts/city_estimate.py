"""City view's "next 12 months" estimate (T9): the money formula (docs/04) per listed Sapporo conference.

One row per listed conference starting in the window that has an attendee number, plus one row for the
rest of the city's yearly total. Every row is an estimate (D14). Constants and money() come from simulate.py.
Drivers, as in simulate.py: ending Fri/Sat and overseas share raise the extra-night share; a domestic
conference ending Fri/Sat gets the scenario's share. Season is stored as a label and does not change money.
"""
import datetime as dt

import simulate as sim

START, END = "2026-12-01", "2027-11-30"   # the next 12 months, as of the build (Nov 2026)
CITY_EVENTS, CITY_ATTENDEES = 466, 109311  # Sapporo, 2025 (Checked [S1])
XN_REL = sim.XN_BASE / sim.SCENARIOS["Middle"][5]  # domestic, midweek ending: half the scenario's extra-night share


def season(month):
    """simulate.py's seasons; its 'spring' group also holds Oct and Nov, labelled autumn here."""
    name = next(name for name, (months, _) in sim.SEASON.items() if month in months)
    return "autumn" if name == "spring" and month >= 10 else name


def long_weekend(end_date):
    end = dt.date.fromisoformat(end_date)
    return (end + dt.timedelta(days=(7 - end.weekday()) % 7 or 7)).isoformat() in sim.HOLIDAY_MONDAYS


def with_drivers(scenario, factor):
    s = list(scenario)
    s[5] = min(sim.XN_MAX, s[5] * XN_REL * factor)
    return tuple(s)


def load(db):
    rows = db.execute("""SELECT id, name_en, name_ja, start_date, end_weekday, end_date, scope, attendees,
                         overseas_attendees FROM conferences
                         WHERE city = 'Sapporo' AND start_date BETWEEN ? AND ? AND attendees IS NOT NULL
                         ORDER BY attendees DESC, id""", (START, END)).fetchall()
    out = []
    for cid, name_en, name_ja, start, weekday, end, scope, n, overseas_n in rows:
        overseas = overseas_n / n if overseas_n else sim.OVERSEAS_DEFAULT.get(scope, 0)
        factor = sim.XN_END_DAY.get(weekday, 1) * (1 - overseas + overseas * sim.XN_OVERSEAS)
        factor *= sim.XN_LONG_WEEKEND if long_weekend(end) else 1
        money = [sim.money(n, with_drivers(sim.SCENARIOS[k], factor)) for k in ("Early", "Middle", "Strong")]
        out.append((cid, cid, name_en or name_ja, start, weekday, season(int(start[5:7])), 1, n,
                    round(overseas, 3), round(factor, 3), *map(round, money), "formula_with_drivers"))
    events, people = CITY_EVENTS - len(rows), CITY_ATTENDEES - sum(r[7] for r in rows)
    money = [sim.money(people, sim.SCENARIOS[k]) for k in ("Early", "Middle", "Strong")]
    out.append(("other", None, "Other smaller meetings", None, None, None, events, people, None, None,
                *map(round, money), "formula_plain"))
    db.executemany("INSERT INTO city_estimates VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)", out)
    total = [sum(r[i] for r in out) for i in (10, 11, 12)]
    print(f"city estimate {START} to {END} ({len(rows)} listed + other smaller meetings, "
          f"{sum(r[7] for r in out):,} attendees): Early ¥{total[0] / 1e6:.1f}M, Middle ¥{total[1] / 1e6:.1f}M, "
          f"Strong ¥{total[2] / 1e6:.1f}M (estimate)")
