"""Simulate attendees, the sessions they attend and their event log for each demo conference (T8).

Reads conferences, sessions, windows and experiences from SQLite and name/place lists from data/raw/sim/.
Writes attendees, session_attendance, events and simulation_runs, all with simulated = 1.
Fixed seed, so a rebuild gives the same rows. Runs last in build_db.py, then prints a short check.
"""
import csv
import datetime as dt
import json
import math
import random
import re
from collections import Counter, defaultdict
from pathlib import Path

SIM = Path(__file__).resolve().parent.parent / "raw" / "sim"

# ---------- Constants (each one an Assumption unless it cites a source) ----------
SEED = "micemax-t8"
MAX_ATTENDEES = 1000          # Assumption: simulate at most this many; simulation_runs.scale gives the real size
OUTSIDE_CITY = 0.60           # Assumption: Middle scenario, share travelling from outside the city
REACH = 0.30                  # Assumption: Middle scenario, share of travellers the organizer's link reaches
CITY_PREFECTURE = "Hokkaido"  # Assumption: every demo conference is in Sapporo
REST_OF_PREFECTURE = 0.20     # Assumption: share of domestic travellers from elsewhere in Hokkaido
OVERSEAS_DEFAULT = {"international": 0.20, "national": 0.01, "regional": 0.0}  # Assumption: when nothing is published
FAMILY_FIRST_JA = {"TW", "CN", "HK", "KR"}  # Assumption: Japanese sites write these names family name first
PARTY = {False: {"solo": 0.55, "colleagues": 0.35, "companion": 0.10},   # Assumption: domestic
         True: {"solo": 0.45, "colleagues": 0.40, "companion": 0.15}}    # Assumption: overseas
INTERESTS = {"food": 0.9, "drinks": 0.5, "onsen": 0.5, "nature": 0.4, "culture": 0.4, "shopping": 0.3,
             "running": 0.15}  # Assumption: how often each interest is picked
INTEREST_TAGS = {"food": {"seafood", "genghis_khan", "local_food", "izakaya", "fine_dining", "market"},
                 "drinks": {"drinks", "izakaya", "late_night"}, "onsen": {"onsen"},
                 "nature": {"nature", "view", "snow", "walking"}, "culture": {"culture", "hands_on", "lab_tour"},
                 "shopping": {"market", "coffee"}, "running": {"running", "walking"}}
PRICE_OK = {"short": {"low": 2000, "mid": 5000, "high": 12000},         # Assumption: price each budget band
            "evening": {"low": 4000, "mid": 7000, "high": 15000},       # accepts without hesitating, per person
            "specialist": {"low": 2000, "mid": 5000, "high": 10000},
            "extra_night": {"low": 18000, "mid": 30000, "high": 60000}}
DEFAULT_MIN = {"short": 60, "evening": 120, "specialist": 90}  # Assumption: when an experience has no duration
DEFAULT_TRAVEL = 40           # Assumption: minutes from the venue when travel is unknown
SEASON = {"winter": ({12, 1, 2, 3}, {"snow": 1.6, "onsen": 1.3}),        # Assumption: D22 season driver
          "summer": ({6, 7, 8, 9}, {"nature": 1.3, "view": 1.3, "running": 1.2, "drinks": 1.2}),
          "spring": ({4, 5, 10, 11}, {"nature": 1.2, "view": 1.2})}
SESSION_P = {"plenary": 0.7, "social": 0.6, "poster": 0.35, "sponsor": 0.4, "other": 0.12, "excursion": 0.1}
FOLLOWED_P, OTHER_TALK_P = 0.8, 0.08  # Assumption: chance of attending a talk in a followed topic / any other talk
XN_BASE = 0.025               # Assumption: domestic attendee, conference ending midweek, books an extra night
XN_END_DAY = {"Fri": 2.0, "Sat": 2.0}  # Assumption (D22): ending Friday or Saturday about doubles it
XN_LONG_WEEKEND = 1.3         # Assumption: the next Monday is a holiday
XN_OVERSEAS = 6.0             # Kyoto: foreign attendees add leisure nights about 6x as often [S9]
XN_COMPANION = 1.5            # Assumption
XN_BUDGET = {"low": 0.6, "mid": 1.0, "high": 1.4}  # Assumption
XN_MAX = 0.5
ACT_BASE = 0.35               # Assumption: share of reached people who go to at least one activity
ACT_MORE = (0.8, 0.6, 0.4, 0.2)  # Assumption: chance of a second, third and fourth activity
SPECIALIST_P = 0.10          # Assumption: of reached professionals; about 1.5% of all attendees (URSI 2023: 2.2% [S11])
SOCIAL = 0.25                 # Assumption: each person already going adds 25% appeal (counted up to 10)
CANCEL = {"extra_night": 0.06, "other": 0.10}  # Assumption
EMAIL_DAYS = [56, 28, 10, 3]  # Assumption: organizer emails, days before the start
EMAIL_OPEN = 0.55             # Assumption
SITE_VISITS = 0.6             # Assumption: average direct visits per reached person
QR_PER_DAY = 0.35             # Assumption: chance of opening the page by QR on each conference day
REG_WAVES = [(0.30, 75, 10), (0.45, 35, 10), (0.25, 10, 7)]  # Assumption: (share, days before start, spread)
SHOWN = 8                     # experiences shown per visit
OPEN_BY_RANK = [0.45, 0.35, 0.3, 0.25, 0.2, 0.15, 0.12, 0.1]  # Assumption
SHOW_NOISE = 1.4              # Assumption: how much the shown list rotates between visits (lognormal sigma)
TEMPER = 0.45                  # Assumption: choices follow score ** TEMPER, so tastes spread out
SAVE = 0.3                    # Assumption: share of opened experiences that get saved
# Japanese public holidays on Mondays, 2026-2027 (Cabinet Office calendar).
HOLIDAY_MONDAYS = {"2026-01-12", "2026-05-04", "2026-07-20", "2026-09-21", "2026-10-12", "2027-01-11",
                   "2027-03-22", "2027-05-03", "2027-07-19", "2027-09-20", "2027-10-11"}
# Money model scenarios, docs/04-long-term-plan.md. Used only for the check printout.
SCENARIOS = {"Early": (0.6, 0.1, 0.15, 5000, 0.3, 0.02, 15000), "Middle": (0.6, 0.3, 0.25, 7000, 0.4, 0.05, 20000),
             "Strong": (0.7, 0.6, 0.35, 10000, 0.5, 0.08, 25000)}
TRULY_NEW = SCENARIOS["Middle"][4]
JST = dt.timezone(dt.timedelta(hours=9))


# ---------- Small helpers ----------

def pick(rng, weights):
    """weights: {item: weight} or [(item, weight)]."""
    items = list(weights.items()) if isinstance(weights, dict) else weights
    return rng.choices([i for i, _ in items], [w for _, w in items])[0]


def at(day, hhmm):
    return dt.datetime.fromisoformat(f"{day}T{hhmm}").replace(tzinfo=JST)


def find(obj, key):
    """First value for key anywhere in nested JSON."""
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        obj = list(obj.values())
    if isinstance(obj, list):
        for v in obj:
            r = find(v, key)
            if r is not None:
                return r
    return None


def read_csv(name):
    with open(SIM / name, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def lists():
    countries = {r["country"]: r for r in read_csv("countries.csv")}
    foreign = defaultdict(lambda: {"family": [], "m": [], "f": []})
    for r in read_csv("foreign_names.csv"):
        foreign[countries[r["country"]]["iso2"]][r["sex"] or "family"].append((r["ja"], r["en"]))
    given = {"m": [], "f": []}
    for r in read_csv("jp_given_names.csv"):
        given[r["sex"]].append(((r["kanji"], r["romaji"]), int(r["weight"])))
    return {"surnames": [((r["kanji"], r["romaji"]), int(r["weight"])) for r in read_csv("jp_surnames.csv")],
            "given": given, "foreign": foreign, "countries": countries,
            "prefectures": [(r["name_en"], int(r["population_k"])) for r in read_csv("prefectures.csv")
                            if r["name_en"] != CITY_PREFECTURE],
            "careers": json.loads((SIM / "careers.json").read_text())}


# ---------- Conference inputs ----------

def load_conference(db, cid):
    db.row_factory = lambda c, r: {d[0]: v for d, v in zip(c.description, r)}
    conf = db.execute("SELECT * FROM conferences WHERE id = ?", (cid,)).fetchone()
    prev = db.execute("SELECT * FROM conferences WHERE id = ?", (conf["previous_id"],)).fetchone() or {}
    sessions = db.execute("SELECT * FROM sessions WHERE conference_id = ? ORDER BY day, start_time", (cid,)).fetchall()
    windows = db.execute("SELECT * FROM windows WHERE conference_id = ? ORDER BY day, start_time", (cid,)).fetchall()
    venue = db.execute("SELECT place_id FROM conference_venues WHERE conference_id = ? ORDER BY is_main DESC",
                       (cid,)).fetchone()["place_id"]
    exps = db.execute("""
        SELECT e.*, t.minutes AS travel,
          (SELECT group_concat(tag_id) FROM experience_tags g WHERE g.experience_id = e.id) AS tags,
          (SELECT max(p.booking_method IN ('online','phone')) FROM experience_stops s JOIN plans p ON p.id = s.plan_id
            WHERE s.experience_id = e.id) AS bookable
        FROM experiences e LEFT JOIN experience_travel t ON t.experience_id = e.id AND t.venue_place_id = ?
        ORDER BY e.id""", (venue,)).fetchall()
    db.row_factory = None
    mix = json.loads(conf["attendee_mix"] or "{}")
    roles = mix.get("roles") or []
    roles = {r["role"]: r["share"] for r in roles} if isinstance(roles, list) else roles.get("shares", {})
    if conf["overseas_attendees"] and conf["attendees"]:
        overseas = conf["overseas_attendees"] / conf["attendees"]
    elif prev.get("overseas_attendees") and prev.get("attendees"):
        overseas = prev["overseas_attendees"] / prev["attendees"]
    else:
        overseas = find(mix, "overseas_share") or OVERSEAS_DEFAULT.get(conf["scope"], 0)
    by_country = (find(mix, "overseas_by_country") or {}).get("shares")
    for e in exps:
        e["tags"] = set((e["tags"] or "").split(",")) - {""}
        e["months"] = json.loads(e["months"]) if e["months"] else None
        e["fields"] = set(json.loads(e["fields"])) if e["fields"] else set()
    for w in windows:
        w["kinds"] = json.loads(w["plan_kinds"] or "[]")
        w["start"], w["end"] = at(w["day"], w["start_time"]), at(w["day"], w["end_time"])
    fields = {(conf[k] or "").replace(" ", "_") for k in ("field", "field_detail")} - {""}
    return {"conf": conf, "sessions": sessions, "windows": windows, "exps": exps, "roles": roles or {"attendee": 1},
            "overseas": overseas, "by_country": by_country, "fields": fields}


STOPWORDS = set("""science what from with that this their after about into through today future years session report
work joint japan people medical challenges issues current status lessons role toward towards using study""".split())


def session_topics(sessions, conf_name):
    """Tracks if the program has real topic tracks, else frequent words from session titles."""
    talks = [s for s in sessions if s["type"] in ("oral", "symposium")]
    tracks = {s["track"] for s in talks if s["track"]}
    if tracks and len(talks) / len(tracks) <= 8:
        return {s["id"]: {s["track"]} if s["track"] else set() for s in sessions}
    stem = lambda w: w[:-1] if w.endswith("s") and len(w) > 4 else w
    skip = STOPWORDS | {stem(w) for w in re.findall(r"[a-z]+", conf_name.lower())}
    words = {s["id"]: {stem(w) for w in re.findall(r"[a-z][a-z-]{3,}", (s["title_en"] or "").lower())} - skip
             for s in sessions}
    df = Counter(w for s in talks for w in words[s["id"]])
    top = {w for w, n in sorted(df.items(), key=lambda x: (-x[1], x[0]))[:12] if n >= 3}
    return {sid: ws & top for sid, ws in words.items()}


# ---------- Attendees ----------

def make_name(rng, L, country, used):
    while True:
        sex = rng.choice("mf")
        if country == "JP":
            (fk, fr), (gk, gr) = pick(rng, L["surnames"]), pick(rng, L["given"][sex])
            ja, en = f"{fk} {gk}", f"{gr} {fr}"
        else:
            (fk, fr), (gk, gr) = rng.choice(L["foreign"][country]["family"]), rng.choice(L["foreign"][country][sex])
            ja = (f"{fk} {gk}" if fk[0] > "ヿ" else f"{fk}・{gk}") if country in FAMILY_FIRST_JA else f"{gk}・{fk}"
            en = f"{gr} {fr}"
        if ja not in used:
            used.add(ja)
            return ja, en


def make_attendee(rng, L, C, n, used, topic_weights):
    conf = C["conf"]
    start, end = dt.date.fromisoformat(conf["start_date"]), dt.date.fromisoformat(conf["end_date"])
    overseas = rng.random() < C["overseas"]
    local = not overseas and rng.random() < (1 - OUTSIDE_CITY) / (1 - C["overseas"])
    if overseas:
        names = C["by_country"] or {c: float(r["weight"]) for c, r in L["countries"].items()}
        country, prefecture = L["countries"][pick(rng, names)]["iso2"], None
    else:
        country = "JP"
        prefecture = CITY_PREFECTURE if local or rng.random() < REST_OF_PREFECTURE else pick(rng, L["prefectures"])
    role = pick(rng, C["roles"])
    career = L["careers"].get(role)
    stage, p = None, 0.5
    if career:
        stages = career["stages"]
        i = stages.index(pick(rng, [(s, s["share"]) for s in stages]))
        stage, p = stages[i]["stage"], i / max(len(stages) - 1, 1)
    high, low = (0.02, 0.75) if role == "student" else (0.1 + 0.4 * p + 0.1 * overseas, 0.45 - 0.35 * p)
    budget = pick(rng, {"low": low, "mid": 1 - low - high, "high": high})
    party = pick(rng, PARTY[overseas])
    interests = []
    while len(interests) < rng.choice([2, 2, 3]):
        i = pick(rng, INTERESTS)
        if i not in interests:
            interests.append(i)
    tracks = []
    while topic_weights and len(tracks) < min(rng.choice([1, 2]), len(topic_weights)):
        t = pick(rng, topic_weights)
        if t not in tracks:
            tracks.append(t)
    clock = lambda d, h0, h1: dt.datetime.combine(d, dt.time(rng.randint(h0, h1 - 1), rng.choice([0, 15, 30, 45])), JST)
    day = dt.timedelta(days=1)
    if local:
        arrive, depart = clock(start, 8, 9), clock(end, 17, 19)
    elif overseas:
        arrive = clock(start - day * rng.choice([1, 1, 1, 2]), 14, 22)
        depart = pick(rng, [(clock(end + day, 8, 14), 0.6), (clock(end, 17, 21), 0.25), (clock(end + 2 * day, 9, 15), 0.15)])
    else:
        arrive = clock(start - day, 16, 21) if rng.random() < 0.35 else clock(start, 7, 10)
        depart = pick(rng, [(clock(end - day, 17, 20), 0.2), (clock(end, 13, 17), 0.55), (clock(end, 18, 21), 0.25)])
    name_ja, name_en = make_name(rng, L, country, used)
    return {"id": f"{conf['id']}-a{n:04d}", "conference_id": conf["id"], "name_ja": name_ja, "name_en": name_en,
            "role": role, "career_stage": stage, "home_prefecture": prefecture, "home_country": country,
            "language": "en" if overseas else "ja", "party": party, "arrive": arrive, "depart": depart,
            "interests": interests, "budget_band": budget, "tracks": tracks, "lives_in_city": int(local),
            "reached": int(not local and rng.random() < REACH), "overseas": overseas}


def attend(rng, a, sessions, topics):
    """Sessions this person attends: no overlaps, followed topics first."""
    chosen, busy = [], []
    order = sorted(sessions, key=lambda s: (s["day"], s["start_time"], not (topics[s["id"]] & set(a["tracks"]))))
    for s in order:
        s0, s1 = at(s["day"], s["start_time"]), at(s["day"], s["end_time"])
        if s0 < a["arrive"] or s1 > a["depart"] or any(s0 < b1 and b0 < s1 for b0, b1 in busy):
            continue
        if s["type"] in ("oral", "symposium"):
            p = FOLLOWED_P if topics[s["id"]] & set(a["tracks"]) else OTHER_TALK_P
        else:
            p = SESSION_P.get(s["type"], 0.1)
        if rng.random() < p:
            chosen.append(s["id"])
            busy.append((s0, s1))
    return chosen, busy


def free_minutes(a, w, busy, last_day):
    """Longest free stretch in a window, in minutes. Extra nights only need the person still in town."""
    if w["kind"] == "extra_night":
        return 9999 if a["depart"].date() >= last_day and not a["lives_in_city"] else 0
    if w["start"] < a["arrive"] or w["end"] > a["depart"]:
        return 0
    t, best = w["start"], 0
    for b0, b1 in sorted(b for b in busy if b[0] < w["end"] and w["start"] < b[1]):
        best, t = max(best, (b0 - t).total_seconds() / 60), max(t, b1)
    return max(best, (w["end"] - t).total_seconds() / 60)


# ---------- Behaviour ----------

def season_of(month):
    return next(mult for months, mult in SEASON.values() if month in months)


def fits(a, e, w, free, C):
    if e["kind"] not in w["kinds"] or (e["months"] and w["start"].month not in e["months"]):
        return False
    if e["kind"] == "specialist" and not e["fields"] & C["fields"]:
        return False
    if e["kind"] == "extra_night":
        return free > 0
    return (e["duration_min"] or DEFAULT_MIN[e["kind"]]) + 2 * (e["travel"] or DEFAULT_TRAVEL) <= free


def score(a, e, appeal, going, season):
    s = appeal[e["id"]] * (1 + 0.8 * min(2, sum(bool(INTEREST_TAGS[i] & e["tags"]) for i in a["interests"])))
    limit = PRICE_OK[e["kind"]][a["budget_band"]]
    if e["price_jpy"] is not None:
        s *= 1.1 if e["price_jpy"] == 0 else math.exp(-2 * max(0, e["price_jpy"] / limit - 1))
    for tag, m in season.items():
        s *= m if tag in e["tags"] else 1
    if a["language"] == "en" and e["english_ok"] is not None:
        s *= 1.6 if e["english_ok"] else 0.5
    if e["kind"] == "specialist":
        s *= 0.5 if a["role"] in ("student", "exhibitor_staff") else 1.2
    return s * (1 + SOCIAL * (1.5 if a["party"] == "solo" else 1) * min(going[e["id"]], 10))


def party_size(rng, a, e):
    if a["party"] == "companion":
        return 2
    return rng.randint(2, 4) if a["party"] == "colleagues" and e["kind"] == "evening" else 1


def plan_visits(rng, a, C):
    """(ts, channel, decisions) for each time a reached person opens the page."""
    conf = C["conf"]
    start, end = at(conf["start_date"], "09:00"), at(conf["end_date"], "09:00")
    _, days, spread = pick(rng, [((s, d, sp), s) for s, d, sp in REG_WAVES])
    reg = start - dt.timedelta(days=max(1, rng.gauss(days, spread / 2)), hours=rng.randint(0, 12))
    visits = []
    for d in EMAIL_DAYS:
        sent = at(conf["start_date"], "10:00") - dt.timedelta(days=d)
        if sent > reg and rng.random() < EMAIL_OPEN:
            visits.append((sent + dt.timedelta(minutes=min(4320, rng.expovariate(1 / 480))), "email"))
    for _ in range(int(rng.random() < SITE_VISITS) + int(rng.random() < SITE_VISITS / 3)):
        visits.append((reg + (end - reg) * rng.random(), "site"))
    d = start
    while d <= end:
        if a["arrive"] <= d <= a["depart"] and rng.random() < QR_PER_DAY:
            visits.append((d.replace(hour=rng.randint(8, 17), minute=rng.randint(0, 59)), "qr"))
        d += dt.timedelta(days=1)
    visits = [[ts, ch, []] for ts, ch in sorted(visits) if ts < a["depart"]]
    if not visits:
        return []
    xn = XN_BASE * XN_END_DAY.get(conf["end_weekday"], 1) * XN_BUDGET[a["budget_band"]]
    xn *= (XN_OVERSEAS if a["overseas"] else 1) * (XN_COMPANION if a["party"] == "companion" else 1)
    xn *= XN_LONG_WEEKEND if C["long_weekend"] else 1
    if rng.random() < min(XN_MAX, xn):
        early = [v for v in visits if v[0] < start - dt.timedelta(days=10)]
        (early or visits)[0][2].append("extra_night")
    if a["role"] not in ("student", "exhibitor_staff") and rng.random() < SPECIALIST_P:
        visits[0][2].append("specialist")
    if rng.random() < ACT_BASE * (1.15 if a["overseas"] else 1) * (0.85 if a["budget_band"] == "low" else 1):
        late = [v for v in visits if v[0] > start - dt.timedelta(days=10)] or visits
        for _ in range(1 + sum(rng.random() < p for p in ACT_MORE)):
            (rng.choice(late) if rng.random() < 0.75 else rng.choice(visits))[2].append("activity")
    return visits


def simulate_events(rng, C, people, busy, appeal):
    conf, windows, exps = C["conf"], C["windows"], C["exps"]
    last_day = dt.date.fromisoformat(conf["end_date"])
    season = season_of(dt.date.fromisoformat(conf["start_date"]).month)
    ev, going, group, commits = [], Counter(), Counter(), []
    add = lambda ts, a, e, w, t, ch, party=None, price=None: ev.append(
        (ts, a and a["id"], e and e["id"], w and w["id"], t, ch, party, price))
    options, queue = {}, []
    for a in people:
        if not a["reached"]:
            continue
        free = {w["id"]: free_minutes(a, w, busy[a["id"]], last_day) for w in windows}
        options[a["id"]] = [(e, w) for w in windows for e in exps if fits(a, e, w, free[w["id"]], C)]
        a["taken"] = []
        queue += [(ts, a["id"], ch, dec) for ts, ch, dec in plan_visits(rng, a, C)]
    start = at(conf["start_date"], "09:00")
    offered = sorted({e["id"] for o in options.values() for e, _ in o if e["kind"] != "extra_night"})
    removed_id, removed_at = rng.choice(offered), start - dt.timedelta(days=21, hours=-6)
    by_id = {a["id"]: a for a in people}
    removal_done = False
    for ts, aid, ch, decisions in sorted(queue, key=lambda q: (q[0], q[1])):
        if ts >= removed_at and not removal_done:
            removal_done = True
            ev.append((removed_at, None, removed_id, None, "plan_removed_by_organizer", None, None, None))
            for c in commits:
                if c["e"]["id"] == removed_id and not c["cancelled"]:
                    c["cancelled"] = True
                    add(removed_at + dt.timedelta(hours=1), c["a"], c["e"], c["w"], "plan_cancelled", "site")
        a = by_id[aid]
        if ch == "email":
            add(ts, a, None, None, "email_opened", ch)
        t = ts + dt.timedelta(seconds=rng.randint(5, 90))
        add(t, a, None, None, "page_visited", ch)
        live = [(e, w) for e, w in options[aid] if w["start"] > ts + dt.timedelta(hours=1)
                and not (e["id"] == removed_id and ts >= removed_at)
                and not any(w["start"] < t1 and t0 < w["end"] for t0, t1 in a["taken"])]
        best = {}
        for e, w in live:
            s = score(a, e, appeal, going, season) * (1.5 if group[e["id"], w["id"]] else 1)
            if s > best.get(e["id"], (0,))[0]:
                best[e["id"]] = (s, e, w)
        ranked = sorted(best.values(), key=lambda x: -x[0] * rng.lognormvariate(0, SHOW_NOISE))[:SHOWN]
        opened = set()
        for rank, (s, e, w) in enumerate(ranked):
            t += dt.timedelta(seconds=rng.randint(1, 4))
            add(t, a, e, w, "plan_shown", ch)
            if rng.random() < OPEN_BY_RANK[rank]:
                opened.add(e["id"])
                add(t + dt.timedelta(seconds=rng.randint(20, 120)), a, e, w, "plan_opened", ch)
                if rng.random() < SAVE:
                    add(t + dt.timedelta(seconds=rng.randint(130, 300)), a, e, w, "plan_saved", ch)
        t += dt.timedelta(minutes=5)
        for kind in decisions:
            cands = []
            for s, e, w in best.values():
                size = party_size(rng, a, e)
                wanted = e["kind"] if e["kind"] in ("extra_night", "specialist") else "activity"
                if wanted != kind or (e["party_max"] and size > e["party_max"]):
                    continue
                if e["party_min"] and size < e["party_min"] and not group[e["id"], w["id"]]:  # solo joins a group only
                    continue
                if any(w["start"] < t1 and t0 < w["end"] for t0, t1 in a["taken"]):
                    continue
                cands.append(((e, w, size), s ** TEMPER))
            if not cands:
                continue
            e, w, size = pick(rng, cands)
            t += dt.timedelta(minutes=rng.randint(1, 6))
            if e["id"] not in opened:  # found by scrolling or search
                add(t - dt.timedelta(minutes=2), a, e, w, "plan_shown", ch)
                add(t - dt.timedelta(minutes=1), a, e, w, "plan_opened", ch)
            add(t, a, e, w, "plan_joined", ch, size, e["price_jpy"])
            if e["bookable"] and not e["needs_agreement"]:
                add(t + dt.timedelta(minutes=rng.randint(1, 4)), a, e, w, "plan_booked", ch, size, e["price_jpy"])
            a["taken"].append((w["start"], w["end"].replace(hour=23, minute=59) if e["kind"] == "extra_night" else w["end"]))
            c = {"a": a, "e": e, "w": w, "size": size, "cancelled": False}
            commits.append(c)
            if rng.random() < CANCEL["extra_night" if e["kind"] == "extra_night" else "other"]:
                c["cancelled"] = True
                gap = max(3600, (w["start"] - t).total_seconds() - 7200)
                add(t + dt.timedelta(seconds=rng.uniform(3600, gap)), a, e, w, "plan_cancelled", ch)
            else:
                going[e["id"]] += 1
                group[e["id"], w["id"]] += size
    if not removal_done:
        ev.append((removed_at, None, removed_id, None, "plan_removed_by_organizer", None, None, None))
    return ev, commits, options


# ---------- Run, write, check ----------

def run(db, L, cid):
    rng = random.Random(f"{SEED}-{cid}")
    C = load_conference(db, cid)
    conf = C["conf"]
    end = dt.date.fromisoformat(conf["end_date"])
    C["long_weekend"] = (end + dt.timedelta(days=(7 - end.weekday()) % 7 or 7)).isoformat() in HOLIDAY_MONDAYS
    n = min(conf["attendees"], MAX_ATTENDEES)
    topics = session_topics(C["sessions"], conf["name_en"] or "")
    talk_topics = Counter(t for s in C["sessions"] if s["type"] in ("oral", "symposium") for t in sorted(topics[s["id"]]))
    used, people, busy, rows = set(), [], {}, []
    for i in range(1, n + 1):
        a = make_attendee(rng, L, C, i, used, dict(talk_topics))
        ids, busy[a["id"]] = attend(rng, a, C["sessions"], topics)
        rows += [(a["id"], sid) for sid in ids]
        people.append(a)
    appeal = {e["id"]: random.Random(f"{SEED}-{e['id']}").lognormvariate(0, 0.35) for e in C["exps"]}
    ev, commits, options = simulate_events(rng, C, people, busy, appeal)

    iso = lambda t: t.isoformat(timespec="seconds")
    for a in people:
        db.execute("""INSERT INTO attendees (id, conference_id, name_ja, name_en, role, career_stage, home_prefecture,
                      home_country, language, party, arrive_ts, depart_planned_ts, interests, budget_band, tracks,
                      lives_in_city, reached, simulated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)""",
                   (a["id"], cid, a["name_ja"], a["name_en"], a["role"], a["career_stage"], a["home_prefecture"],
                    a["home_country"], a["language"], a["party"], iso(a["arrive"]), iso(a["depart"]),
                    json.dumps(a["interests"]), a["budget_band"], json.dumps(a["tracks"], ensure_ascii=False),
                    a["lives_in_city"], a["reached"]))
    db.executemany("INSERT INTO session_attendance (attendee_id, session_id, simulated) VALUES (?,?,1)", rows)
    for k, (ts, aid, eid, wid, typ, ch, party, price) in enumerate(sorted(ev, key=lambda x: x[0]), 1):
        db.execute("""INSERT INTO events (event_id, ts, conference_id, attendee_id, experience_id, window_id,
                      event_type, channel, party_size, price_jpy, simulated) VALUES (?,?,?,?,?,?,?,?,?,?,1)""",
                   (f"{cid}-e{k:06d}", iso(ts), cid, aid, eid, wid, typ, ch, party, price))
    scale = conf["attendees"] / n
    db.execute("INSERT INTO simulation_runs VALUES (?,?,?,?,?,1)", (cid, conf["attendees"], n, scale, SEED))
    return {"conf": conf, "n": n, "scale": scale, "people": people, "commits": commits, "options": options}


def money(conf_attendees, s):
    out, reach, act, spend, new, xn, xn_spend = s
    return conf_attendees * out * reach * (act * spend * new + xn * xn_spend)


def report(results):
    picks, offered = Counter(), set()
    for r in results:
        conf, people, kept = r["conf"], r["people"], [c for c in r["commits"] if not c["cancelled"]]
        reached = [a for a in people if a["reached"]]
        xn = [c for c in kept if c["e"]["kind"] == "extra_night"]
        act = [c for c in kept if c["e"]["kind"] != "extra_night"]
        xn_yen = sum((c["e"]["price_jpy"] or 0) * c["size"] for c in xn) * r["scale"]
        act_yen = sum((c["e"]["price_jpy"] or 0) * c["size"] for c in act) * r["scale"] * TRULY_NEW
        paid = {c["a"]["id"] for c in act if c["e"]["price_jpy"]}
        lo, mid, hi = (money(conf["attendees"], SCENARIOS[k]) for k in ("Early", "Middle", "Strong"))
        total = xn_yen + act_yen
        print(f"{conf['id']}: {r['n']} simulated, scale {r['scale']:.2f}, reached {len(reached)} "
              f"({len(reached) / r['n']:.0%}), active {len({c['a']['id'] for c in kept})}")
        rate = lambda ov: (len({c["a"]["id"] for c in xn if c["a"]["overseas"] == ov})
                           / max(1, sum(a["overseas"] == ov for a in reached)))
        print(f"  extra nights {len(xn)}: {len({c['a']['id'] for c in xn}) / len(reached):.1%} of reached "
              f"(domestic {rate(False):.1%}, overseas {rate(True):.1%}; model 2% to 8%), "
              f"paid activity {len(paid) / len(reached):.0%} of reached (model 15% to 35%)")
        print(f"  new money (scaled) ¥{total / 1e6:.2f}M: extra nights ¥{xn_yen / 1e6:.2f}M, "
              f"activities ¥{act_yen / 1e6:.2f}M")
        print(f"  money model for {conf['attendees']} attendees: Early ¥{lo / 1e6:.2f}M, Middle ¥{mid / 1e6:.2f}M, "
              f"Strong ¥{hi / 1e6:.2f}M: {'inside' if lo <= total <= hi else 'OUTSIDE'}")
        active = len({c["a"]["id"] for c in kept}) or 1
        top = Counter(c["e"]["id"] for c in kept).most_common(1)
        if top:
            print(f"  most picked: {top[0][0]}, {top[0][1] / active:.0%} of active people")
        picks.update(c["e"]["id"] for c in kept)
        offered |= {e["id"] for o in r["options"].values() for e, _ in o}
    never = sorted(offered - set(picks))
    kinds = Counter(i.split("-")[0] for i in never)
    print(f"experiences offered {len(offered)}, never picked {len(never)} ({dict(kinds)}): {', '.join(never)}")


def load(db):
    L = lists()
    ids = [r[0] for r in db.execute("SELECT id FROM conferences WHERE is_demo = 1 ORDER BY id")]
    report([run(db, L, cid) for cid in ids])
