"""Before and during rows for agent_steps, built from the simulated events (all simulated = 1).

Email waves, the organizer removing a plan, weekly uptake reports, headline groups nudged and filled,
reminders the evening before each day, and a host per group (the first person who joined it).
"""
import datetime as dt
import math
from collections import defaultdict

import simulate as sim

WEEKDAY_JA = "月火水木金土日"


def day_ja(d):
    return f"{d.month}/{d.day}（{WEEKDAY_JA[d.weekday()]}）"


def day_en(d):
    return f"{d:%a} {d.month}/{d.day}"


def pl(n, word):
    return f"{n} {word}" + ("" if n == 1 else "s")


def kept_joins(db, cid):
    """Joins not cancelled later, in time order: dicts with ts, attendee, experience, window, size, booked."""
    q = lambda t: db.execute("SELECT ts, attendee_id, experience_id, window_id, party_size FROM events "
                             "WHERE conference_id = ? AND event_type = ? ORDER BY ts", (cid, t)).fetchall()
    cancelled = {(a, e, w) for _, a, e, w, _ in q("plan_cancelled")}
    booked = {(a, e, w) for _, a, e, w, _ in q("plan_booked")}
    return [{"ts": ts, "a": a, "e": e, "w": w, "size": n, "booked": (a, e, w) in booked}
            for ts, a, e, w, n in q("plan_joined") if (a, e, w) not in cancelled]


def rows(db, cid):
    conf = db.execute("SELECT start_date, end_date FROM conferences WHERE id = ?", (cid,)).fetchone()
    start = dt.date.fromisoformat(conf[0])
    T = defaultdict(dict)
    for eid, lang, t in db.execute("SELECT experience_id, lang, card_title FROM experience_copy"):
        T[eid][lang] = t
    W = {w: (d, ja, en, kind) for w, d, ja, en, kind in
         db.execute("SELECT id, day, name_ja, name_en, kind FROM windows WHERE conference_id = ?", (cid,))}
    names = dict((a, (ja, en)) for a, ja, en in
                 db.execute("SELECT id, name_ja, name_en FROM attendees WHERE conference_id = ?", (cid,)))
    events = lambda t, a, b: db.execute("SELECT count(*), count(DISTINCT attendee_id) FROM events WHERE "
                                        "conference_id = ? AND event_type = ? AND ts >= ? AND ts < ?",
                                        (cid, t, a, b)).fetchone()
    joins = kept_joins(db, cid)
    out = []

    def row(ts, agent, tja, ten, sja, sen, output=None):
        phase = "before" if ts[:10] < conf[0] else "during"
        out.append({"conference_id": cid, "phase": phase, "ts": ts, "agent": agent, "tool": "rules",
                    "title_ja": tja, "title_en": ten, "summary_ja": sja, "summary_en": sen, "output": output,
                    "simulated": 1})

    # Email waves: opens and joins until the next wave.
    sends = [sim.at(conf[0], "10:00") - dt.timedelta(days=d) for d in sim.EMAIL_DAYS]
    for k, t in enumerate(sends):
        nxt = (sends[k + 1] if k + 1 < len(sends) else sim.at(conf[0], "10:00")).isoformat()
        opened = events("email_opened", t.isoformat(), nxt)[1]
        joined = db.execute("SELECT count(*) FROM events WHERE conference_id = ? AND event_type = 'plan_joined' "
                            "AND channel = 'email' AND ts >= ? AND ts < ?", (cid, t.isoformat(), nxt)).fetchone()[0]
        d = sim.EMAIL_DAYS[k]
        row(t.isoformat(), "mailer", f"案内メール{k + 1}/{len(sends)}", f"Email {k + 1} of {len(sends)}",
            f"開幕{d}日前に参加者へ送信。次の送信までに{opened}人が開封し、メール経由で{joined}件の参加。",
            f"Sent {d} days before the start. {pl(opened, 'person') if opened == 1 else f'{opened} people'} opened "
            f"it and {pl(joined, 'join')} came from it before the next email.", {"days_before": d, "opened": opened, "joins_from_email": joined})

    # Organizer removed a plan: everyone who had joined it is told.
    for ts, eid in db.execute("SELECT ts, experience_id FROM events WHERE conference_id = ? AND "
                              "event_type = 'plan_removed_by_organizer'", (cid,)).fetchall():
        hit = db.execute("SELECT count(*) FROM events WHERE conference_id = ? AND event_type = 'plan_cancelled' "
                         "AND experience_id = ? AND ts = ?", (cid, eid, (dt.datetime.fromisoformat(ts)
                                                                         + dt.timedelta(hours=1)).isoformat())
                         ).fetchone()[0]
        row(ts, "replanner", "主催者が体験を外した", "Organizer removed an experience",
            f"主催者が「{T[eid].get('ja', eid)}」を外した。" + (f"参加予定だった{hit}人に連絡し、ほかの体験を案内。"
                                                         if hit else "まだ参加者はいなかった。"),
            f"The organizer removed \"{T[eid].get('en', eid)}\". " + (
                f"Told {'the 1 person' if hit == 1 else f'the {hit} people'} who had joined and showed other experiences." if hit
                else "No one had joined it yet."), {"experience_id": eid, "people_told": hit})

    # Weekly uptake report to the organizer, from the first event to the start.
    first = dt.date.fromisoformat(db.execute("SELECT min(ts) FROM events WHERE conference_id = ?",
                                             (cid,)).fetchone()[0][:10])
    week, total = first + dt.timedelta(days=7 - first.weekday()), 0  # Mondays
    while week <= start:
        a, b = (week - dt.timedelta(days=7)).isoformat(), week.isoformat()
        j = events("plan_joined", a, b)[0]
        bk, cx = events("plan_booked", a, b)[0], events("plan_cancelled", a, b)[0]
        total += j
        if j or cx:
            row(f"{b}T09:00:00+09:00", "reporter", "主催者への週報", "Weekly report to the organizer",
                f"先週：参加{j}件、予約{bk}件、キャンセル{cx}件。累計の参加は{total}件。",
                f"Last week: {pl(j, 'join')}, {pl(bk, 'booking')}, {pl(cx, 'cancellation')}. "
                f"{pl(total, 'join')} so far.",
                {"week_from": a, "joins": j, "bookings": bk, "cancellations": cx, "joins_total": total})
        week += dt.timedelta(days=7)

    # Headline groups: a nudge when half full, then confirmed at people_min.
    for kind, eid, wid, lo, hi in db.execute("SELECT kind, experience_id, window_id, people_min, people_max "
                                             "FROM headlines WHERE conference_id = ? ORDER BY kind", (cid,)).fetchall():
        ppl, nudged, group = 0, False, [j for j in joins if j["e"] == eid and j["w"] == wid]
        for j in group:
            ppl += j["size"]
            if not nudged and math.ceil(lo / 2) <= ppl < lo:
                nudged = True
                savers = db.execute("""SELECT count(DISTINCT attendee_id) FROM events WHERE conference_id = ?
                    AND event_type = 'plan_saved' AND experience_id = ? AND window_id = ? AND ts <= ?""",
                                    (cid, eid, wid, j["ts"])).fetchone()[0]
                if not savers:
                    continue
                row(j["ts"], "group_filler", "グループ募集中", "Group still filling",
                    f"「{T[eid].get('ja')}」（{W[wid][1]}）は{ppl}/{lo}人。保存した{savers}人に声かけ。",
                    f"\"{T[eid].get('en')}\" ({W[wid][2]}) has {ppl} of {lo}. Nudged "
                    f"{'1 person' if savers == 1 else f'{savers} people'} who saved it.",
                    {"experience_id": eid, "window_id": wid, "people": ppl, "people_min": lo, "nudged": savers})
            if ppl >= lo:
                row(j["ts"], "group_filler", "グループ成立", "Group confirmed",
                    f"「{T[eid].get('ja')}」（{W[wid][1]}）が{ppl}人で成立（定員{hi}人）。",
                    f"\"{T[eid].get('en')}\" ({W[wid][2]}) is on with {ppl} people (up to {hi}).",
                    {"experience_id": eid, "window_id": wid, "people": ppl, "people_max": hi})
                break

    # Reminders the evening before each day, and hosts on the day.
    by_day = defaultdict(list)
    for j in joins:
        by_day[W[j["w"]][0]].append(j)
    head = {e: w for e, w in db.execute("SELECT experience_id, window_id FROM headlines WHERE conference_id = ?",
                                        (cid,))}
    for day in sorted(by_day):
        d, js = dt.date.fromisoformat(day), by_day[day]
        ppl, bk, who = sum(j["size"] for j in js), sum(j["booked"] for j in js), len({j["a"] for j in js})
        exps = len({(j["e"], j["w"]) for j in js})
        row(f"{(d - dt.timedelta(days=1)).isoformat()}T18:00:00+09:00", "mailer",
            f"{day_ja(d)}のリマインダー", f"Reminders for {day_en(d)}",
            f"翌日の体験{exps}件について参加者{who}人に送信（同行者を含め{ppl}人、うち{bk}件は店舗に予約済み）。",
            f"Sent to {pl(who, 'attendee')} about {pl(exps, 'experience')} tomorrow ({ppl} people with companions; "
            f"{bk} booked with the business).",
            {"day": day, "reminded": who, "experiences": exps, "people": ppl, "booked": bk})
        groups = defaultdict(list)
        for j in js:
            groups[j["e"], j["w"]].append(j)
        hosts = [{"experience_id": e, "window_id": w, "host_attendee_id": g[0]["a"], "host_ja": names[g[0]["a"]][0],
                  "host_en": names[g[0]["a"]][1], "people": sum(x["size"] for x in g)}
                 for (e, w), g in sorted(groups.items()) if len(g) >= 2]
        if not hosts:
            continue
        top = next((h for h in hosts if head.get(h["experience_id"]) == h["window_id"]),
                   max(hosts, key=lambda h: h["people"]))
        row(f"{day}T08:00:00+09:00", "host_matcher", f"{day_ja(d)}の幹事", f"Hosts for {day_en(d)}",
            f"{len(hosts)}グループに幹事を決定。例：「{T[top['experience_id']].get('ja')}」は{top['host_ja']}さん"
            f"（{top['people']}人）。",
            f"Hosts set for {pl(len(hosts), 'group')}. E.g. {top['host_en']} hosts \"{T[top['experience_id']].get('en')}\" "
            f"({top['people']} people).", {"day": day, "hosts": hosts})

    out.sort(key=lambda r: r["ts"])
    for n, r in enumerate(out, 1):
        r["id"] = f"{cid}-ops-{n:03d}"
    return out
