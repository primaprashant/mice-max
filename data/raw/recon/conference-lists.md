# Recon: Sapporo conference lists (checked 2026-11-25)

There is no single list. Upcoming events come from 4 sources: city, SCC calendar, UMIN, bizevent-navi. Past actual numbers come from JNTO.

## Upcoming (future events)

### 1. Sapporo city "主なコンベンション" (city MICE page)
- https://www.city.sapporo.jp/keizai/kanko/aboutmice.html, an HTML table. Updated 2026-06-16.
- Columns: name (JA), field (分野), dates (no year), venue(s). No attendee counts, organizer or link.
- 23 rows for FY2026 (Apr 2026 to Mar 2027). Only "major" events: ICCA international meetings, large academic societies, events the city supports. Nothing for FY2027 yet.
- The field is given in broad categories: 医学, 科学・技術・自然, 産業, 航空宇宙, スポーツ, その他.
- The same page has yearly totals. 2025: 466 meetings, 109,311 participants, 6,706 overseas, 24 ICCA. 2024: 443, 89,211, 3,509, 24. Counts only cover meetings whose onsite numbers are known.
```
| 第8回日本在宅医療連合学会大会 | 医学 | 7月4日（土曜日）～7月5日（日曜日） | 札幌コンベンションセンター |
| 第11回国際セラミックス会議 | 科学・技術・自然 | 9月6日（日曜日）～9月11日（金曜日） | 札幌コンベンションセンター |
| 第46回医療情報学連合大会 | 医学 | 11月12日（木曜日）～11月15日（日曜日） | 札幌コンベンションセンター |
| 第32回日本災害医学会総会・学術集会 | 医学 | 3月17日～3月20日 | 札幌コンベンションセンター |
```

### 2. Sapporo Convention Center calendar (SCC)
- https://www.sora-scc.jp/event/ and `?month=YYYY-MM`. Detail pages are at `/event/detail/?e=NN`.
- Lists about 20 events for Nov 2026 to Mar 2027 (about 4 months ahead). There is no past archive.
- List fields: date, name, organizer (主催者), 来場区分 (一般 = public / 関係者のみ = stakeholders only).
- Detail page fields: contact, event URL, sponsors (後援), notes, PDF. No hall, attendee count or field.
- Includes many non-MICE events: trade seminars and local training sessions.
```
2026年11月25日 北海道スマート農業SUMMIT2026 / 主催者：一般社団法人スマート農業共同体 / マイナビ農業 / 来場区分： 一般
2026年11月26日 地域連携推進会議 / 主催者：株式会社GUILDGROUP / 来場区分： 関係者のみ
2026年12月04日 A-Styleフォーラム "ARCHITREND KAI"が開く建築の新しい景色！in札幌 / 主催者：福井コンピュータアーキテクト株式会社 / 来場区分： 一般
```

### 3. UMIN 学術集会一覧 (medical academic meetings, Japan-wide)
- https://center6.umin.ac.jp/gakkai/meeting/2026/index.htm, with `/2027/` and `/2028/`. One HTML table per fiscal year.
- Columns: UMIN ID, dates (with year), society, meeting name, prefecture (北海道 only, no city), venue, president, president's employer.
- FY2026 has 526 rows (54 in Hokkaido). FY2027 has 169 rows (8 in Hokkaido) and keeps filling. FY2028 is nearly empty. Lookahead is about 1.5 years.
- Includes local chapter meetings (地方会, 支部例会). City must be inferred from the venue. Field must be inferred from the society name. No attendee numbers.
```
A00001-00082 | 2027年05月13日～2027年05月15日 | 日本化学療法学会 | 第101回日本感染症学会総会・学術講演会 第75回日本化学療法学会総会 合同学会 | 北海道 | 札幌コンベンションセンター | 髙橋 聡・時松 一成 | 札幌医科大学…
A02396-00006 | 2027年06月17日～2027年06月18日 | 日本スポーツ整形外科学会 | 日本スポーツ整形外科学会2027（JSOA2027） | 北海道 | 札幌コンベンションセンター | 佐藤 和毅 | 慶應義塾大学…
A00040-00095 | 2027年07月15日～2027年07月16日 | 日本整形外科学会 | 第60回日本整形外科学会骨・軟部腫瘍学術集会 | 北海道 | 札幌コンベンションセンター | 平賀 博明 | NHO北海道がんセンター
```

### 4. bizevent-navi.com (Hokkaido page, aggregator)
- https://bizevent-navi.com/areas/hokkaido/ is HTML. WebFetch gets 403; curl with a browser user agent works.
- 26 events for 2026 to 2027. Fields: name, status (開催予定), dates, venue(s), field with subfield (e.g. 医学・医療（眼科）), type (学会・学術総会 / 展示会), official site link.
- This is the only upcoming source that gives the field explicitly and covers non-medical events.
```
第131回日本眼科学会総会 | 開催予定 | 2027/04/15 〜 2027/04/18 | 北海道（グランドメルキュール札幌大通公園・札幌プリンスホテル国際館パミール ほか）| 医学・医療（眼科）| 学会・学術総会
第113回日本消化器病学会総会 | 開催予定 | 2027/05/06 〜 2027/05/08 | 北海道（京王プラザホテル札幌、グランドメルキュール札幌大通公園）| 医学・医療（内科系）| 学会・学術総会
第15回日本感染管理ネットワーク学会学術集会 | 開催予定 | 2027/05/21 〜 2027/05/22 | 北海道（札幌コンベンションセンター）| 医学・医療（公衆衛生）| 学会・学術総会
```

### 5. Smaller upcoming sources
- **Nikkei Medical calendar**, Hokkaido page: https://medical.nikkeibp.co.jp/inc/all/gakkai/calendar/hokkaido.html. 14 rows, 2026-11 to 2027-10. Gives dates, name and ward (e.g. 札幌市白石区). No venue. Also: m3 kenkyuukai.jp, igaku-shoin.co.jp/society.
- **Hokkaido University 学会等開催情報**: https://www.hokudai.ac.jp/pr/events/gakkai/. FY2026 only, 47 rows, covering its own halls (学術交流会館). It is the only list with an expected **参加人数** per event. Example:
  `11.1 | 第66回日本臨床化学会年次学術集会 | 【学術交流会館】全館 | 300 | 一般社団法人 日本臨床化学会 年会事務局 …`
- **MLIT Hokkaido Bureau, 5-year plan (FY2026–2030)**: https://www.mlit.go.jp/hkb/content/002013281.pdf. Covers government-linked international meetings only, 9 rows. Gives name, organizer, dates, city, summary and expected onsite attendance (会場での参加人数). Example:
  `7 R9 | Arctic Science Summit Week 2027(ASSW2027) | IASC、日本学術会議… | 令和9年4月11日～20日 | 函館市 | … | 900名程度（オンライン300名程度）`
  `9 R12 | 第24回世界神経放射線学連盟シンポジウム SNR XXIV 2030 | 日本神経放射線学会 | 令和12年6月or7月 | 札幌市 | … | 1,200名程度`
  FY2025 actuals are in 002013280.pdf (e.g. `第34回光子電子原子衝突国際会議 ICPEAC | 令和7年7月29日～8月5日 | 札幌市 | 562名`).
- **PCO sites** (c-linkage.co.jp, convention.co.jp, congre.co.jp): they host the official sites for each meeting. These give dates, venues, presidents and the 運営事務局 (the PCO). They usually give no attendee count. Expected numbers tend to appear only in sponsor prospectuses (趣意書, 協賛募集要項 PDFs).
- **Hotels** (Keio Plaza, Grand Mercure = former Royton, Prince): no public event calendars found.
- **Sapporo Convention Bureau**: https://www.conventionsapporo.jp/j/ returns 403. The English page /conferences/ lists only 5 past showcase events with attendees and countries (e.g. `URSI GASS 2023 | 2023-08-19–26 | SCC | 1,434 | 49 countries`). It has no upcoming list.

## Past (actual numbers)

### 6. JNTO 国際会議カレンダー (searchable, best for past actuals)
- `https://mice.jnto.go.jp/news/event.html?city=札幌市&form_year=2024&form_month=1&to_year=2024&to_month=12&page=N`. HTML, 10 rows per page.
- Columns: dates, name, field (分野), venue(s), prefecture/city, total attendees (参加人数).
- Covers international meetings (JNTO definition) only. Sapporo has about 520 rows for 2015–2024 and about 35 for 2024. **No 2025 data yet.**
```
2024年11月06日 - 11月09日 | 第8回アジア太平洋作業療法学会 | 医学 | 札幌コンベンションセンター | 北海道 / 札幌市 | 1,837
2024年10月29日 - 10月31日 | 第83回日本公衆衛生学会総会 | 医学 | 札幌コンベンションセンター、札幌市産業振興センター | 北海道 / 札幌市 | 3,600
2024年11月15日 - 11月17日 | 日本国際政治学会2024年度全国大会(JAIR) | 政治・経済・法律 | 札幌コンベンションセンター | 北海道 / 札幌市 | 624
```

### 7. JNTO 統計 資料編3 (per-event PDF, gives overseas counts)
- https://mice.jnto.go.jp/assets/doc/survey-statistical-data/cv_tokei_2024_shiryohen3.pdf, 41 pages, about 32 Sapporo rows. Index: https://mice.jnto.go.jp/document/statistics.html
- Columns: dates, name, venue, prefecture, city, number of countries, **foreign attendees**, domestic attendees, total, ICCA flag. No field column (field is on the calendar above).
```
4/14～4/18 第9回アジア太平洋藻類学会議 北海道大学 北海道 札幌市 20 178 73 251 ●
7/12 第9回全球エネルギー水循環プロジェクト国際会議(2024札幌) 京王プラザホテル札幌 北海道 札幌市 46 534 749 1,283 ●
3/22～3/24 第1回国際がん免疫シンポジウム ホテルライフォート札幌 北海道 札幌市 5 10 110 120
```

### 8. Sapporo city slides for MLIT
- https://www.mlit.go.jp/hkb/content/002013287.pdf (July 2026). Gives yearly ICCA and JNTO counts and major past meetings with overseas numbers. Example:
  `2025年10月 東洋東南アジアライオンズフォーラム 約10,500人 (3,600人)`
- It also notes a new exhibition hall, 札幌産業展示場 at Fukuzumi (about 15,000 m²), opening **Sep 2027**.

## Answers to the brief
- **Attendee numbers per event.** Actual numbers are published for international meetings only (JNTO, 2015–2024). Some event sites post totals afterwards, for example the 46th 医療情報学連合大会: onsite 2,832, online-only 924. Expected numbers are rare: they appear only on Hokudai, in the MLIT plan, and in sponsor prospectuses. The city's own 466 domestic meetings per year are not listed individually anywhere.
- **Field.** Given by the city table, JNTO and bizevent-navi. UMIN, SCC and Nikkei do not give it; it must be inferred from the society name.
- **Gaps.** No source covers Dec 2025–Nov 2027 alone. City and SCC look ahead less than 6 months, UMIN about 1.5 years for medicine only, and FY2027 lists are not out yet. There is no 2025 per-event data. Organizer and PCO need each event's site.
- **Schema ideas.**
  - Store `venues` as a list (the city's major meetings often use 2–5 venues).
  - Split onsite and online attendance.
  - Add `attendees_kind` (expected / actual) and `attendees_source`.
  - Add `foreign_countries` (JNTO).
  - Add `is_public` (SCC 来場区分).
  - Add `meeting_level` to mark national vs local chapter (地方会).
  - Add `icca_flag`.
  - Use fiscal year (Apr–Mar) when matching to city lists.
