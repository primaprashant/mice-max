# Plan copy style

Reader: a busy doctor or engineer at a conference in Sapporo with a free evening or a spare hour. They want to decide in seconds.

## What to answer

What it is, how long, the all-in cost, alone or group, English, cash or card, booking, when they'd be back. Answer the likely objection (Japanese only, 2 people minimum, closed Tuesdays) before they ask.

## Fields

| Field | JA | EN |
|---|---|---|
| `card_title` | ≤ 16 characters | ≤ 40 characters |
| `hook` | one line, ≤ 30 characters | one line, ≤ 70 characters |
| `description` | 2–3 short sentences | 2–3 short sentences |
| `included` | short phrase: what the price covers | same |
| `good_to_know` | 2–4 items, one per line | same |

- Title: name the thing plainly. No slogans. Never cut a word.
- Hook: the main reason to go plus one practical fact (price, time, no booking).
- `included`: empty when there is no price (proposals).

## Rules

- Use only facts from the plan's fields (columns, tags, `notes`, `extra`). Invent nothing: no views, tastes, atmosphere or "popular with" unless a field says so.
- Utility, not sales. No hype (絶品, 最高, 至福, 大人気, must-try, unforgettable, hidden gem, amazing). No `!` or `！`.
- Write JA and EN separately from the facts. Neither is a translation of the other.
- Nothing tied to one conference or venue: no dates, no "Saturday 3/20", no walk time from a venue, no conference names. The app adds those.
- Never join items with `·` `•` `—` `|`. Use separate lines or a comma.
- Prices: JA `5,300円`, EN `¥5,300`. Say "from" (から) when there is a higher variant. Free: 無料 / Free.
- Times 24-hour: `23:00`. Durations: 約2時間 / about 2 hours, 45分 / 45 min.
- English: say "English OK" only if `english_ok` = 1 or `tour_language` has `en`. If the tour is Japanese only, say so.
- Payment: only what `payment` lists. Don't claim "cash only" or "no cash" unless a field says so.
- "Fine alone" only when nothing suggests a minimum (walk-in or admission, per-person price). If `party_min` is 2, say so.
- Extra nights: the price is per person with 2 sharing; say what it covers (stay, meals, transport, activity, taxes) from `notes`. Prices vary by date, so use "from".
- Specialist visits with `needs_agreement` = 1: say plainly it is not a public tour and needs a special arrangement. Don't promise it will happen.
- Write numbers so the checker can verify them: digits from the fields, not rounded or converted (2時間 for 120 min is fine).

## Good and bad

| Bad | Good | Why |
|---|---|---|
| 至福のジンギスカン体験！ | 味付けジンギスカンの食べ飲み放題。5,300円から | Hype and `！` vs fact and price |
| Unforgettable Otaru night with stunning canal views | Canal-side onsen hotel night with glass blowing. From ¥17,440 | Invented views vs what you get |
| Sapporo Breweries Hokkaido Brewery: Sapporo Classic Ta | Sapporo Breweries Hokkaido Brewery tour | Cut mid-word vs plain name that fits |
| English · Card · Booking | English OK<br>Card or QR<br>Closed Tuesdays | Separators vs one item per line |

## Check

`python3 data/scripts/import_copy.py <file.csv>` prints length, style and number warnings against the plans in `data/micemax.db`. Fix every warning.
