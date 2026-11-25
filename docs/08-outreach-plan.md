# MiceMax: outreach during the hackathon (36 hours)

The demo should show we are already doing this, not just building it: real people asked, real replies, real businesses on board. Each action also tests an open question (Q1–Q8 in [05-decisions-and-open-questions.md](05-decisions-and-open-questions.md)).

## What the demo shows

- **Field notes** in the city view: number contacted, replied and interviewed; 3–5 real quotes (only with permission); the results of each question next to the assumption it tests, e.g. "Would stay an extra night for an experience like this: 7 of 12 asked (small sample)".
- **Partner badge** on experiences whose business said "yes, list us". Their own photos and an owner's tip ("Ask for the tatami room, seats 10") make the best experience pages.
- **One live test:** a real experience offered to this hackathon's participants, with real sign-ups in the event log, labelled real.
- **Replies** on one slide: screenshots with names hidden unless we have permission.

## Who to contact

| # | Who | Ask | How | Tests | Goal |
|---|---|---|---|---|---|
| O1 | Hackathon participants from outside Hokkaido | 5-minute interview (guide below) | In person, today | Q1, Q2, Q8 | 10 interviews |
| O2 | Hackathon participants | Live test: one real evening experience (e.g. ramen and bar walk in Susukino, or Genghis Khan dinner) posted in the event chat with a sign-up link | Event chat, with the organizers' OK | Q1, Q2 | Real sign-ups |
| O3 | Hackathon organizers, sponsors, mentors | 10 minutes of feedback; "who should we talk to?"; intros to city, bureau, PCO people | In person | Q3, Q4 | 3 chats, 1 intro |
| O4 | Japanese professionals in our network | 15-minute call or chat (guide below) | Message, call | Q1, Q8 | 3–5 interviews |
| O5 | Restaurants and izakaya near the Convention Center, Odori, Susukino | Group bookings from conference attendees? Fee? Can we list you, with your photos? | Walk in, 14:00–17:00 (before dinner service) | Q6 | 6–10 visits, 2–3 yes |
| O6 | Extra-night providers: Jozankei ryokan, Otaru and Yoichi tours, wineries | Same, plus a conference-attendee plan or rate | Phone, then email | Q6 | 5 calls, 1–2 yes |
| O7 | The two demo conferences' secretariats (事務局) | "We built a free attendee page for your conference. Would you share it?" | Email with the page link once it works | Q2, Q3 | 2 sent |
| O8 | PCOs: Nihon Convention Service, JTB Communication Design, Convention Linkage, local Sapporo PCOs | 15 minutes of feedback | Email, contact form, LinkedIn | Q3 | 5 sent |
| O9 | Sapporo City MICE section, Sapporo Convention Bureau, Doshin EC (ran the 2026 "+1 night" program [S3]) | How did the 2026 program go? Will it run in FY2027? What would make software useful? | Phone, then email | Q4 | 3 contacted, 1 chat |

Phone during office hours (about 9:00–17:00 on weekdays) and send emails early: replies take time.

## Order

1. **Hours 0–2:** research contacts (O5–O9), draft and send emails and forms (O7 waits for the page). Ask the organizers about the live test (O2).
2. **Hours 2–8:** interviews at the hackathon (O1, O3) between build sessions. Messages to our network (O4).
3. **Next office hours:** phone O6 and O9. Walk-ins O5 in the afternoon.
4. **Evening:** run the live test (O2).
5. **Hour ~30:** send O7 the working attendee page. Follow up on everything unanswered.

## Questions to ask

**Attendees (O1, O4):**
1. Your last conference away from home: where, how many nights, when did you arrive and leave?
2. Did you have free time? What did you do with it, and with whom?
3. Have you ever stayed an extra night after a conference? What stopped you or made you? (work, approval, family, cost)
4. Look at these two experiences. Would either make you stay one more night in Hokkaido?
5. How did you pick dinner last time? (colleagues, Tabelog, hotel, nothing)
6. How long before the conference do you book flights?

**Businesses (O5, O6):**
1. Do conference attendees come here? Which nights are quiet?
2. Would you take groups of 4–10 booked a few days ahead?
3. How do you take bookings now, and what fees do you pay?
4. Would a fee of about 10% (or ¥200–440 per guest [S19]) work?
5. May we list you in our demo, with your photos?

**City, bureau, PCOs, organizers (O3, O7–O9):**
1. Do attendees ask you what to do in Sapporo? What do you tell them?
2. Are evenings usually free, or full of receptions?
3. Would you share a link like this in the registration email? What would stop you?
4. (City) How did the 2026 "+1 night" program go, and what did it measure?
5. Who else should we talk to?

## Data steps

- **T10. Contact list** (research agent, ~1 h, run first): name, type (O1–O9), area, public phone, email or contact form, best person or department, source URL. Public business contacts only. Bilingual search, as in [07-data-plan.md](07-data-plan.md).
- **T11. Materials** (AI drafts, fluent speaker checks, ~1 h): Japanese and English versions of the email templates (O6–O9), a phone script, a one-page explainer with screenshots, the interview guides above, the live-test post (O2), and a consent line ("May we quote you, with or without your name?").
- **T12. Record everything** in SQLite, same day:
  - `contacts`: organizations only.
  - `outreach`: contact, date, channel, ask, status (sent / replied / talked / yes / no), reply summary, quote, `can_show_name`.
  - `interviews`: role, home prefecture, answers, quotes, `can_quote`. No names.
  - `plans.partner_status`: contacted / interested / listed.
  - Live-test sign-ups go into `events` with `simulated = 0`.
- **Privacy:** the repo is public. Raw notes with personal names stay in `data/private/` (git-ignored). Only anonymized rows go in the database.
