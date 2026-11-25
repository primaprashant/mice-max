# Recon: places, seasons, city events (2026-11-25)

Fares are adult one-way, after the 2025 fare rises (JR Apr 2025, Jotetsu Dec 2025). Check again before the demo.

## 1. Climate normals (JMA 平年値 1991-2020, Sapporo 47412)

- Main view: https://www.data.jma.go.jp/stats/etrn/view/nml_sfc_ym.php?prec_no=14&block_no=47412&year=&month=&day=&view=p1
  - Has mean temp, mean max, mean min, precip mm, snowfall cm, max snow depth, snow days, sunshine hours. 12 rows, HTML table. Copy by hand or scrape.
- `view=a1` adds days with >=1 mm and >=10 mm precip. `view=a4` is the snow detail view.
- Finer tables exist (10-day `nml_sfc_10d.php`, 5-day, daily `nml_sfc_d.php`). Monthly is enough for us.
- No data for Otaru, Niseko and other areas pulled yet. JMA has AMeDAS points (Otaru, Kutchan, Noboribetsu...). For now Sapporo can stand in, with a note that Niseko/Jozankei are colder and snowier.

| Month | High | Low | Mean | Precip mm | Days >=1mm | Snowfall cm | Max snow depth cm | Snow days | Sun h |
|---|---|---|---|---|---|---|---|---|---|
| Jan | -0.4 | -6.4 | -3.2 | 108.4 | 18.3 | 137 | 76 | 29.1 | 90 |
| Feb | 0.4 | -6.2 | -2.7 | 91.9 | 16.0 | 116 | 95 | 25.3 | 104 |
| Apr | 11.7 | 3.4 | 7.3 | 54.6 | 9.6 | 6 | 22 | 10.1 | 176 |
| Jun | 21.8 | 13.4 | 17.0 | 60.4 | 7.5 | - | - | 0 | 180 |
| Aug | 26.4 | 19.1 | 22.3 | 126.8 | 9.5 | - | - | 0 | 168 |
| Sep | 22.8 | 14.8 | 18.6 | 142.2 | 10.2 | - | - | 0 | 159 |
| Oct | 16.4 | 8.0 | 12.1 | 109.9 | 11.6 | 1 | 1 | 1.9 | 146 |
| Nov | 8.7 | 1.6 | 5.2 | 113.8 | 14.6 | 30 | 15 | 15.6 | 99 |
| Dec | 2.0 | -4.0 | -0.9 | 114.5 | 16.0 | 113 | 47 | 27.9 | 83 |

(Other months: Mar 4.5/-2.4, May 17.9/9.0, Jul 25.4/17.9.)
"What to wear" and "seasonal highlights" are not in any source. We write these ourselves, one line per month.

## 2. Sunrise / sunset (NAOJ 暦計算室)

- Per-day table, one HTML page per month, 2027 already published:
  `https://eco.mtk.nao.ac.jp/koyomi/dni/2027/s00MM.html` (00 = Sapporo, MM = 01..12). 2026 is under `/dni/2026/`.
- Columns: day, sunrise, azimuth, transit, altitude, sunset, azimuth. JST. Point is 43.0667 N, 141.35 E.
- Samples (2027): Jun 1 3:58/19:07, Jun 15 3:55/19:16, Jun 30 3:58/19:18. Sep 1 4:58/18:11, Sep 15 5:13/17:46, Sep 30 5:30/17:19. Dec 1 6:45/16:01, Dec 15 6:58/16:00, Dec 31 7:06/16:09.
- One value per month is too rough: sunset moves about 50 min across September. Options:
  - store per-day (365 rows, scrape 12 pages), or
  - compute it in code (e.g. Python `astral`, offline, matches NAOJ within ~1 min). Simplest.
- The other areas (Otaru, Niseko) are within a few minutes of Sapporo. Fine to use Sapporo for all.

## 3. Travel from Sapporo Station

| To | Mode | Time | Fare | Notes |
|---|---|---|---|---|
| New Chitose Airport | JR Rapid Airport | 37-40 min | 1,230 | about every 12 min. uSeat +1,000 (800 ticketless) |
| Otaru | JR rapid / local | 32-36 / ~50 min | 800 | last Otaru->Sapporo 23:08 (arr 23:53). Highway bus 730 |
| Yoichi | JR via Otaru | ~80 min | 1,380 | Otaru-Yoichi local 25 min, 470 |
| Jozankei | Jotetsu Kappa Liner (reserved) | ~60 min | 1,700 (web 1,460) | last out 16:00, last back leaves 17:06 (arr 18:19). Plain local bus 1,000, ~75-90 min |
| Noboribetsu Onsen | JR Ltd Exp Suzuran/Hokuto + bus | 75-80 min + 15 min bus | 4,890 reserved seat (2,530 fare + 2,360 express) | about 1 train an hour. Donan highway bus ~2 h, ~2,500 |
| Lake Toya Onsen | Donan Bus (reserved) | ~2 h 45 min | 3,700 | 4 a day out 7:40/11:30/14:10/16:10. Last back 17:10 (arr 19:50). No IC card |
| Niseko | Chuo Bus Highway Niseko | ~3 h | 2,820 | summer: 8:35/10:35/13:35. Winter timetable not checked. JR local via Otaru/Kutchan ~2 h 40, 2,530 |

Sources: JR fare PDFs https://www.jrhokkaido.co.jp/fare/pdf/01.pdf, 02.pdf. Timetables: https://jrhokkaidonorikae.com/ ; last-train lookups via ekitan.com (e.g. https://ekitan.com/transit/last/sf-94/st-200). Kappa Liner https://www.jotetsu.co.jp/bus/kappa_liner/ . Donan https://www.donanbus.co.jp/map/sap_toyako/ . Chuo Bus https://www.chuo-bus.co.jp/highway/?t=26&ope=list&o=1 .
Day pass: JR "一日散歩きっぷ" 2,730 (Otaru/Yoichi day trips). S-kippu was dropped Mar 2026.

## 4. Convention Center to the centre

- Sapporo Convention Center is about 10 min walk from Higashi-Sapporo (T12, Tozai line). Exact walk not checked.
- Higashi-Sapporo -> Odori (T09): 6 min, 250. Then Susukino is 1 stop on Namboku (or ~10 min walk from Odori).
- Last train weekdays: Odori -> Shin-Sapporo direction 0:15, Higashi-Sapporo -> Odori 0:13. Weekend not checked.
- Station-to-station times: https://www.city.sapporo.jp/st/subway/jikan_kyori/jikan_kyori.html (official, all lines).

## 5. City events (Dec 2026 - Nov 2027)

Best official list: https://www.sapporo.travel/en/event/event-list/ (has a month filter, e.g. `?cssn[]=m-08`). It shows "late May" style text until dates are set. Each festival also has its own site.

| Event | Where | 2026-27 dates | Status |
|---|---|---|---|
| White Illumination | Odori, Ekimae-dori, Minami 1-jo, Akarenga, Sapporo Sta. south | 2026-11-20 to 2027-03-14, 16:30-22:00. Odori ends 12-25, Ekimae-dori 02-11 | confirmed |
| Munich Christmas Market | Odori 2-chome | 2026-11-20 to 12-25, 11:00-21:00 | confirmed |
| FIS Ski Jumping World Cup | Okurayama | 2027-01-23 to 24 | confirmed (Wikipedia) |
| Snow Festival (77th) | Odori, Susukino, Tsudome | 2027-02-04 to 02-11. Odori lit to 22:00, Susukino to 23:00 | confirmed (snowfes.com) |
| Lilac Festival | Odori 5-7 chome, Kawashimo | late May 2027 (2026: 05-20 to 05-31) | not out, usually set in spring |
| YOSAKOI Soran (36th) | Odori and city stages | 2027-06-09 to 06-13 | confirmed (yosakoi-soran.jp) |
| Hokkaido Shrine Festival | Hokkaido Jingu, Nakajima Park | 2027-06-14 to 06-16 | fixed every year |
| Summer Festival / Odori Beer Garden | Odori 5-11 chome | late Jul to mid Aug (2026: 07-23 to 08-18, 12:00-21:00) | set around May |
| Hokkaido Marathon | Odori | late Aug 2027 | not out |
| Autumn Fest | Odori 4-8, 10, 11 chome | 2027-09-10 to 10-02 (planned), 10:00-20:30 in 2026 | planned (official site) |
| White Illumination / Xmas market 2027 | Odori | late Nov 2027 | not out, pattern: ~Nov 20 start |

Nearby: Otaru Snow Light Path ~2027-02-05 to 02-12 (tour site, unconfirmed). Chitose-Shikotsu Ice Festival, Feb.
For the demo, unconfirmed dates can use last year's pattern, marked as "expected".

## 6. Lat/lng and walking time

- Lat/lng: hand-enter from Google Maps or OpenStreetMap, or look up with the free GSI geocoder (no key):
  `https://msearch.gsi.go.jp/address-search/AddressSearch?q=<address>`. Nominatim (OSM) also works for place names.
- Walking minutes: compute offline. Straight-line distance (haversine) x 1.3 for Sapporo's grid, at 80 m/min (Japanese real-estate standard). Good enough inside the centre.
- Trains, buses and last departures: hand-enter (about 10 routes). No free offline routing API for JR/bus. Google/NAVITIME APIs are paid or need keys.

## Schema suggestions

- places: id, name_en, name_ja, kind (venue/hotel/station/airport/area), lat, lng.
- routes: from_place, to_place, mode, minutes, fare_yen, last_departure (time), reservation_needed, note, source_url. Walking: compute, don't store.
- seasons: month, high_c, low_c, precip_days, snowfall_cm, snow_depth_cm, wear (text), highlights (text). Sunrise/sunset: compute by date, or a separate sun table (date, sunrise, sunset).
- city_events: name_en, name_ja, place_id, start_date, end_date, hours, status (confirmed/planned/expected), source_url.
