# Recon: plans inventory (8 samples)

Checked 2026-11-25. Goal: which fields from `docs/prompts/inventory-research.md` can actually be found. Empty = not found.

## Findability

| Field | Result | Where |
|---|---|---|
| name_ja, address, opening_hours, days_closed | always | official site |
| name_en | sometimes | official EN page (Nikka, Sapporo Beer); restaurants none |
| area | always | derive from address |
| lat, lng | never on page | geocode the address |
| walk_minutes_from_convention_center | never | compute; note SCC (Higashi-Sapporo) is ~4 km from Susukino, so "20 min walk" fails for all evening places; use station + minutes instead |
| nearest station + walk minutes | always | official / Gnavi pages ("すすきの駅 徒歩1分") |
| duration_minutes | tours yes, restaurants as course length (120/150 min), cafés no | official |
| price_jpy_min/max | tours, courses, hotels yes; cafés no (menu not on site) | official; hotels only on Jalan/Rakuten/Yahoo |
| price_basis | yes, but varies: per person, per room (2 名), free | official |
| group_size_max | tours and restaurants yes (per-slot capacity, room capacity) | official / Gnavi |
| seasons | rarely stated; closures stated instead (Nikka 12/23–1/7) | official |
| languages | tours yes (often "Japanese only"); restaurants no | official |
| booking_method, booking_url | always | official |
| payment | restaurants and museums yes; hotels/tours no | official / Gnavi |
| tags | partly: smoking, private room, drink-all; vegetarian never | Gnavi |
| highlight_en | written by us from JP text | official |
| image_urls | official yes for facilities/hotels; restaurants only Gnavi thumbnails | see Photos |

Drop or downgrade: `lat/lng` (geocode instead), `walk_minutes_from_convention_center` (compute), `seasons` (replace with `closed_periods`), `languages` for restaurants, `vegetarian` tag.

Extra fields seen and worth adding:
- `booking_deadline` (Nikka web: day before 11:59; Beer Museum: 9:30 same day; Kappa Liner: 17:00 day before; Snow Brand: 1 business day by phone)
- `booking_opens` (Nikka 4 weeks; Snow Brand 3 months; Kappa Liner 1 month)
- `party_size_min/max` per booking (Nikka 1–9, no 10+ split bookings; Milione shuttle not for 10+)
- `private_room` (yes/no + capacity range) and `smoking` (both sample restaurants: smoking at all seats)
- `price_variants` (courses 2,838–10,538; hotel plans; resident discounts)
- `drink_all_included`, `age_limit` (20+ for tastings), `cancellation_policy` (only on listing sites), `free_shuttle` (hotels), `tour_language` (often JA only), `local_tax_jpy` (入湯税 150, 宿泊税 300–400)

## Photos

| Source | Size found | Direct URL? |
|---|---|---|
| Sapporo Beer Museum official | hero 1680x870, no text overlay (brand signage only); others 1050x626 | yes, static `/img/` paths |
| Milione hotel official | hero slides 1800x760, clean | yes (`/img/top/main_slide_01.jpg`) |
| Morihico official | 1070x610 full-size, 1024x584 resized | yes (WordPress uploads) |
| Snow Brand official | hero 1000x450, gallery 300x223 | yes, but small |
| Nikka official | 750x825 portrait webp; Akamai blocks non-browser UA | yes with browser UA + referer |
| Jalan (hotels) | max 600x450 (`pict2L`) | yes, `cdn.jalan.jp` |
| Gnavi (restaurants) | max 547x547 square (`s_` prefix) | yes, `rimage.gnst.jp` |
| GetYourGuide | blocked (403) | no |

Summary: ≥1600px landscape only from a few official hero sliders. Restaurants and tours have no usable high-res official photos. Plan: take official hero where ≥1600px; otherwise accept ~1000px or ask businesses during outreach.

## Samples

### 1. Short: Sapporo Walking Tour (H.I.S. TIC), listing-only
- source: https://seesapporo.com/sapporo-walking-tour/ → booking https://www.getyourguide.com/sapporo-l32644/sapporo-walking-tour-t877239/
- duration 180; price from US$58 per person (GYG shows USD, not JPY); group_size_max 8; language EN; meets Sapporo Station (exact spot unclear); includes TV Tower admission + sweets stop; runs in snow (route moves underground); free cancel 24 h; booking online, reserve-now-pay-later
- not found: start time, payment, address, official operator page. confidence: reported
- Also: independent EN guide ¥5,000 per guide, up to 10 guests: https://sites.google.com/view/sapporo-sightseeing-guide/sapporo-walking-tours-with-local-english-guide

### 2. Short: 森彦 本店 (Morihico main store), specialty coffee
- source: https://www.morihico.com/shop/morihico/
- address 札幌市中央区南2条西26丁目2-18; 円山公園駅 4番出口 徒歩4分; hours 9:00–19:00 (L.O. 18:30, temporary); closed: none, New Year break; reservation 不可 (walk-in); parking 10
- highlight: renovated old wooden house café with wood stove; signature deep-roast "森の雫"
- not found: price (no menu online), seats, payment, duration, languages
- images: https://www.morihico.com/wp/wp-content/uploads/2015/06/slider-honten-img1.jpg (1070x610)

### 3. Evening: ジンギスカン邸 ラム王 すすきの本店
- source: https://lamb-king.gorp.jp/ (Gnavi-hosted "official" page); booking https://r.gnavi.co.jp/plan/jfyhhvkc0000/plan-reserve/plan/plan_list/ or tel 050-5487-6231
- address 札幌市中央区南5条西5-21-1 No.2旭観光ビル5F; すすきの駅 徒歩3分; open 24 h, no fixed holiday
- 25 seats; private rooms 3x (2–6), 1x (12–20); buyout 20–25
- courses per person: 2,838 (60 min, after 22:00) to 10,538; drink-all 90/120 min at 4,818–7,678
- payment: cards (VISA/MC/JCB/AMEX/Diners); smoking: all seats; under-20 not admitted
- not found: English menu, cancellation (Gnavi listing: 50% day before, 100% same day)
- images: Gnavi only, 547px squares, e.g. https://rimage.gnst.jp/rest/img/jfyhhvkc0000/s_0n9b.jpg

### 4. Evening: 海鮮と炭焼 ひゃくや 本邸 (seafood, all private rooms)
- source: https://h554800.gorp.jp/; booking online (Gnavi) or tel 050-5485-0837
- address 札幌市中央区南4条西4-12-1 すずらんビル別館3F; すすきの駅 2番出口 徒歩1分; 17:00–23:30 (L.O. 22:45); open daily except New Year
- 80 seats; private rooms 2–30 (horigotatsu), groups up to 30
- courses with 2.5 h drink-all: 3,800 (nabe), 4,500–5,000, 5,700, 8,000; drink-all alone from 990
- payment: cards, e-money, QR (PayPay etc.); smoking: all seats
- not found: English menu, cancellation, booking deadline, min party size

### 5. Extra night: 定山渓万世閣ホテルミリオーネ (Jozankei onsen)
- source: https://www.milione.jp/ ; prices https://www.jalan.net/yad319724/ , https://www.ryokan.or.jp/inn/04201
- address 札幌市南区定山渓温泉東3丁目; tel 0570-08-3500; check-in 15:00, out 10:00
- price: 1泊2食 10,650–31,500 pp (ryokan.or.jp); Jalan from 27,176 for 2 (13,588 pp); buffet dinner
- transport: free hotel shuttle Sapporo Sta. north exit 14:30, back 10:00, booking form after reserving, not for parties of 10+. Else Kappa Liner ¥1,700 (web ¥1,460), ~60 min, book 1 month to 17:00 day before: https://www.jotetsu.co.jp/bus/kappa_liner/
- all-in pp: 13,588 stay + 150 入湯税 + 0 shuttle ≈ ¥13,700 (or +2,920 by Kappa Liner web fare both ways ≈ ¥16,700)
- official booking engine (hotel-story.ne.jp) was in maintenance; prices only from listing sites
- images: https://www.milione.jp/img/top/main_slide_01.jpg (1800x760, room, clean)

### 6. Extra night: Yoichi Nikka distillery + stay in Otaru (ホテルノルド小樽)
- Nikka: https://www.nikka.com/distilleries/yoichi/ (visit/, access/); booking https://distillery.nikka.com/yoichi/reservation/reserve (reserva.be)
- address 余市郡余市町黒川町7丁目6; 余市駅 徒歩5分; guided tour free, ~70 min incl. 3 tastings; parties 1–9; book up to 4 weeks ahead, web until 11:59 day before; closes 16:15; closed 12/23–1/7 and 6/11; no bus parking
- Hotel Nord Otaru: listings only (no official page surfaced): breakfast twin from 14,240 for 2 (7,120 pp, ikyu/gutabi); in 15:00 out 11:00; 宿泊税 300 pp (<¥20k); 7 min walk from Otaru Sta.
- JR fares (after 2025-04 revision): 札幌→余市 1,380 (~75 min, ekitan), 余市→小樽 470, 小樽→札幌 800
- all-in pp: 1,380 + 470 + 800 + 7,120 + 300 + 0 (tour) ≈ ¥10,070
- images: Nikka official 750x825 portrait webp only

### 7. Specialist: サッポロビール博物館 試飲付きガイドツアー
- source: https://www.sapporobeer.jp/brewery/s_museum/kengaku/ ; tickets https://sapporobeer-museum.ticket.smarthello.jp/8658f3e4d8cd4f44aaa9869787bcb906
- address 札幌市東区北7条東9丁目1-1; 11:00–18:00; guided tours not on Mondays
- tour 55 min, 16 per slot, ¥2,000 adult (¥1,700 Hokkaido residents), Japanese only, 2 tastings; web booking until 9:30 same day. Monthly "THE PERFECT TOUR" ¥3,000, 70 min, 20+ only
- self-visit ¥1,000 with EN audio guide; payment: cash, card, QR, e-money
- public tour exists, so not "proposal"
- images: https://www.sapporobeer.jp/brewery/s_museum/img/index-main_img01.jpg (1680x870, clean exterior)

### 8. Specialist: 雪印メグミルク 酪農と乳の歴史館・札幌工場
- source: https://www.meg-snow.com/fun/factory/sapporo/
- address 札幌市東区苗穂町6-1-1; JR苗穂駅 徒歩15分; closed Sat/Sun/holidays/New Year
- free; A course 60 min (10/11/13/14/15:00), A+B 100 min; up to ~30 per tour; "research visits" with more detail on advance request
- booking: phone only 011-704-2329, 1 business day ahead, opens 3 months ahead; Japanese only; may join other groups; factory lines may be idle
- fits a dairy/food-science audience; public tour exists
- images: hero 1000x450; gallery 300px only

## Gaps and notes
- No guided running tour in Sapporo found (only Runtrip routes, one-off events). Treat "morning run" as a self-guided route, not a bookable item.
- Restaurant "official" sites are often Gnavi-hosted (gorp.jp, foodre.jp). Hot Pepper/Gnavi are the source of truth for courses.
- Smoking at all seats is common in Susukino izakaya; filter needed for doctors/international users.
- Hotel prices are dynamic; store "from" price + date checked + plan name, not a fixed price.
