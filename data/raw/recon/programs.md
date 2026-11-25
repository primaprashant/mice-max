# Program recon (2026-11-25)

## Status of the six candidates

| Conference | Dates 2027 (days) | Program status | Notes |
|---|---|---|---|
| 32nd JADM | Mar 18-20 (Thu-Sat), Sapporo Convention Center + 産業振興センター | not_yet | 日程表・プログラム is in the menu but has no link yet |
| 131st JOS | Apr 15-18 (Thu-Sun), Grand Mercure, Prince Hotel Pamir, 教育文化会館 | partial | HTML list of main sessions with day, time and room; no grid yet; no English program |
| 113th JSGE | May 6-8 (Thu-Sat), Keio Plaza Sapporo + Grand Mercure | partial | HTML list of titles and chairs only; no day, time or room yet |
| ICEP 2027 | May 12-15 (Wed-Sat), Grand Mercure Sapporo | not_yet | Menu has Program, Reception and Excursion, but those pages return 404; banner says "1,200+ Attendees" |
| ICCDU 2027 | Jun 28-Jul 2 (Mon-Fri), Hokkaido Univ. Conference Hall | partial | Tentative grid of morning and afternoon blocks per day, including Banquet and Free Time |
| ISCNP33/ICOB13 | Aug 29-Sep 2 (Sun-Thu), Sapporo Convention Center | partial | Time grid with session codes (PL01, KN05, IL014, SOT007), Rooms A-C and socials; no talk titles |

None of the programs needs a login. JOS also publishes abstracts through an app and an online abstract system.

## Previous editions (city, dates, attendance)

| Edition | City, dates | Attendance published | Source |
|---|---|---|---|
| 31st JADM 2026 | Niigata, 朱鷺メッセ, Mar 19-21 (Thu-Sat) | "3000名超" (third-party report only; official 御礼 gives no number) | https://irides.tohoku.ac.jp/media/files/_u/topic/file/20260319_report.pdf |
| 30th JADM 2025 | Nagoya, Mar 6-8 | "約3300名", a record (IRIDES report) | http://www.irides-pudh.med.tohoku.ac.jp/pdf/20250306_report.pdf |
| 130th JOS 2026 | Fukuoka, Apr 9-12 (Thu-Sun) | Final registrants 8,763, on-site 4,417 | JOIA PDF https://www.joia.or.jp/wp-content/uploads/2026/11/526f3b925cdff155810c6fa053425fe4-1.pdf |
| 129th JOS 2025 | Tokyo, Apr 17-20 | about 10,470 registered, about 5,800 on-site, about 300 overseas; final 10,575 | https://www.congre.com/report/20250618-mc/ and https://www.joia.or.jp/newsletter/8124/ |
| 112th JSGE 2026 | Fukui + Kanazawa, Apr 16-18 (Thu-Sat) | none found (御礼 says only "多くの皆様") | https://site2.convention.co.jp/112jsge/ |
| 111th JSGE 2025 | Tokyo, Keio Plaza, Apr 24-26 | "3,300名を超える" | https://site2.convention.co.jp/111jsge/ |
| ICEP-HBS 2026 | Hiroshima, Apr 14-18 (Tue-Sat) | Registrants 1,191 (933 domestic, 258 overseas, 18 countries); welcome reception "nearly one thousand" | https://www.jiep.or.jp/icep/docs/icep-hbs2026-report-en.pdf |
| ICCDU 2026 | St. Louis, Jul 6-10 (Mon-Fri) | none found | https://iccdu2026.wustl.edu/ |
| ISCNP32 2025 | Sydney, Aug 24-28 (Sun-Thu) | none found | RACI event page |

Attendance by category (members, residents, co-medical, industry) was not published for any of them. The most detail found:
- ICEP: domestic and overseas counts, plus number of countries.
- JOS: total, on-site and overseas.
- JADM: a rough total only.

JOIA (the eye-equipment industry body) publishes final registrants for every major ophthalmology meeting each year, back to 2015:
https://www.joia.or.jp/%e6%9c%aa%e5%88%86%e9%a1%9e/96621/

Society member mix, a proxy for the attendance mix: JADM has 6,044 members, of whom 1,522 are physicians and 4,522 are others (https://jams.med.or.jp/members-s/125.html).

The categories exist as registration fee types. JOS 131 has:
- members, physicians
- members, trainees and others (residents, graduate students, co-medical)
- non-members, physicians, company staff and others
- non-members, trainees and others
- students and junior residents (free)

## In depth 1: HTML program, 130th JOS 2026 (and 131st, same layout)

URL: https://www.congre.co.jp/130jos/program.html
- The page lists sessions by type: 特別講演, 招待講演, 代議員会指名講演, シンポジウム, 教育セミナー, 社会保険会議シンポジウム, サブスペシャリティーサンデー, International Symposium, Late Breaking Symposium and others.
- Each entry gives the session number, a "ライブ配信" flag, date and time, room, title, 座長 (chair) and 演者 (speakers).
- Rooms are "Room 1".."Room 11" plus Poster and Exhibition. The venue building appears only in the grid PDF.
- English titles exist only for international or invited sessions; the rest are Japanese only. The grid PDF tags English sessions "ENG".
- Grid (日程表): https://www.congre.co.jp/130jos/program/0407/time.pdf, one page per day with rooms as columns.
  - The PDF fonts are broken, so text extraction is garbled. Reading it needs vision or OCR.
- Reception: 全員懇親会, Fri Apr 10, starts after the poster session, at マリンメッセ B館 ホワイエ and テラス. Free. Shown only in the grid PDF.

Example rows:
```
特別講演1 | 4月11日（土）13:35～14:35 | Room 1 | 病的近視の本質を追い求めて～患者さんが教えてくれたこと～ | 座長 西田幸二 | 演者 大野京子
招待講演2 | 4月10日（金）10:40～11:40 | Room 1 | Controlling and managing the multiple faces of inflammation | 演者 Andrew D. Dick
シンポジウム1 | 4月9日（木）9:00～10:20 | Room 1 | 緑内障の未来を切り開く研究
131st: International Symposium 1 | 4月16日（金）9:00～10:20 | Room 7 | The Cutting Edge of Retinal Research: Retinal Cell Biology
```

## In depth 2: PDF-only program, 31st JADM 2026

The HTML page https://shinsen-mc.co.jp/jadm31/program.html gives only the opening and closing times of each day:
```
3/18(水) 前日 13:00-15:00 理事会 / 15:00-17:00 評議員会
3/19(木) 8:30 開会式 / 9:00 開始 / 19:15 終了 / 19:25〜 会員懇親会
3/20(金) 7:50 開始 / 19:20 終了 / 19:30-20:30 全国災害拠点病院連絡会議
3/21(土) 9:10 開始 / 16:00-16:30 閉会式 (市民公開講座 15:50-17:00, 防災イベント 10:00-14:00 アトリウム)
```

The detail is in PDFs under media/:
- daily programs: jadm31_program0319_0317.pdf, jadm31_program0320_0317.pdf and jadm31_program0321_0317.pdf
- all three days: jadm31_program_all_0317.pdf
- grid: jadm31_schedule03.pdf
- posters: jadm31_postersession0317.pdf
- sponsored seminars: jadm31_seminar.pdf
- English sessions: english_session.pdf

The daily PDFs are text, so extraction is clean. Each block has type, day and time, room with floor and hall name, chairs, and talk code:
```
■特別企画 1 | 1日目（3月19日）15：00〜16：00 | 第1会場（4F マリンホール） | 1-SS1 （新潟大学企画）産学連携で取り組む災害医療 DX
■特別企画 5 | 1日目（3月19日）09：00〜9：30 | 第5会場（3F 中会議室 301） | 1-SS5 （国際委員会企画）日本の国際医療支援 40 年の歩みとこれから
■特別企画 6 | 1日目（3月19日）18：20〜18：50 | 第5会場（3F 中会議室 301） | 1-SS6 （国際委員会企画）Closing Session
■特別企画 7 | 1日目（3月19日）15：00〜16：30 | 第7会場（展示ホール A1(特設)） | 1-SS7-1 「潜在 DMAT 隊員の実態調査」初年度経過報告
```
- Talk codes have the form `<day>-<type><n>-<talk>`, for example 1-SS7-3 and 2-PD16.
- Sessions run from 7:50 to 19:20, so there is little free daytime. Free time falls in the evenings, apart from the reception on day 1.

## In depth 3: previous edition with grid PDFs, ICEP-HBS 2026

- Archive: https://www.jiep.or.jp/archive/ICEP2026/program/program_overview/
- Overview PDF: assets/docs/pdf/overview/program_overview.pdf
- Daily PDFs: program_20260415/16/17.pdf and program_poster.pdf

The grid has rooms as columns:
- A Phonics
- B Himawari
- C Daria1
- D Daria2
- E Cosmos
- F Ran

Rows are session slots with start and end times. Session codes encode the day, weekday, room and sequence (16TC1 = 16th, Thu, Room C, slot 1). Tracks are named in the cells: AdvancedPackaging-3, Material-3, ThermalManagement-1, Glass-PKG-1, Hybrid Bonding.

Everything is in English. Rows from the grid:
```
Apr 15 (Wed) Session 1 9:00-10:40 | 15WC1 Interconnect-1 | 15WD1 Material-1 | 15WF1 Emerging Technologies-1
Apr 15 Lunch 12:35-12:55 | Luncheon Talk 12:55-13:25 | Break/Poster 13:35-14:50 | Keynote I 15:40-16:40
Apr 15 Welcome reception 18:00-20:00 (Grand Prince Hotel Hiroshima, charter bus from 17:30)
Apr 16 (Thu) Keynote III 8:30-9:15 | Session 3 9:30-11:10 ... Session 6 15:50-17:30 | Poster 17:30-19:00 + Sponsor's exhibition party
Apr 17 (Fri) Session 10 16:20-18:00 (last technical slot)
Apr 18 (Sat) Excursion Miyajima 09:00-15:00, chartered buses x3, guided shrine visit, lunch with local sake, "Free time at Omotesando Shopping Street (approx. 50 minutes)"
```
- The excursion plan (assets/docs/pdf/excursion_plan.pdf) has a minute-by-minute timetable in both Japanese and English.

## Other samples

- 112th JSGE grid: https://site2.convention.co.jp/112jsge/program/timetable.pdf
  - One page per day and city. Rooms are columns, each with facility, floor and room name, from 7:00 to 20:00.
  - Cells show the type and topic: 口演, ミニオーラル, LS1 (luncheon seminar), 理事長講演 and 本部評議員懇親会.
  - Text extraction is jumbled, so it needs vision.
  - The meeting used two cities: Fukui on days 1-2 and Kanazawa only on day 3.
  - JSGE 113 HTML labels sessions 【英語セッション】, for example ワークショップ5 "Frontiers of Translational Research in Inflammatory Bowel Disease".
- ICCDU 2026 (https://iccdu2026.wustl.edu/iccdu-2026-technical-program/) is an HTML grid by day with rooms as columns and track filters. Socials:
  - Welcome reception, Mon 17:30-19:00
  - St Louis Arch, Tue 16:30-18:00
  - Trolley and brewery tours, Wed 15:30-18:00
  - Campus walk, Thu 16:00-18:00
  - Dinner and awards, Thu 18:00-21:00
- ICCDU 2027 tentative grid:
  - Mon: afternoon only (opening and welcome reception)
  - Tue-Wed: plenary, 4 parallel sessions, luncheon and posters
  - Wed: banquet
  - Thu: afternoon is "Free Time"
  - Fri: morning only, then closing
- ISCNP33 grid:
  - Day 1 (Sun): 13:30 registration, then 18:00-18:30 welcome cocktail
  - Days 2-4: 09:00-17:40 in Rooms A-C
  - Day 3 (Tue Aug 31): banquet 18:30-21:00
  - Day 5: ends 12:30

## Schema notes

- Most sessions give type, day, start, end, room and title_ja. A JA talk code (1-SS7-3) or EN session code (16TC1) is common.
- Tracks are explicit only in the international conferences. Japanese societies group by session type and topic.
- title_en appears only in English sessions; it can be flagged with `is_english` (JSGE 【英語セッション】, JOS ENG).
- Rooms need a venue building as well, because these meetings spread over several hotels or halls (and two cities for JSGE 112).
- Socials are separate rows with fees and places. Free time is explicit only in international meetings (ICCDU "Free Time", ICEP excursion day).
- Daily program start and end times (JADM) are the easiest input for free-time windows.
