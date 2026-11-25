# T1 brief: Sapporo conference list

Shared by all T1 research agents. Context: [docs/07-data-plan.md](../../../docs/07-data-plan.md) (T1), sources found in recon: [../recon/conference-lists.md](../recon/conference-lists.md).

**Scope:** business events held in Sapporo (incl. Hokkaido University, Makomanai, etc.) with start date **2025-12-01 to 2027-11-30**. Conferences, congresses, society meetings (national, international, and regional/branch meetings), association conventions, trade exhibitions for professionals. Not consumer events, concerts, sports, exams or job fairs. Every event with a public page counts; no cap.

**Search in Japanese and English, always,** 10+ Japanese terms: 学術集会, 学術大会, 総会, 年次大会, 学会, 国際会議, 全国大会, 開催予定, 札幌 開催, 札幌コンベンションセンター, 第◯回 … 札幌, and English: "Sapporo 2026 conference", "Sapporo 2027 symposium". Read Japanese pages directly. Never invent an event, date or number.

**Output:** a CSV in `data/raw/conferences/`, UTF-8, header exactly:

```
name_ja,name_en,name_en_ours,series,edition,start_date,end_date,venues,field,field_detail,scope,is_public,attendees,attendees_kind,overseas_attendees,countries,organizer,pco,website_url,program_status,source_url,confidence,notes
```

- `name_en_ours`: 1 if there is no official English name and you wrote one.
- `series`: short lowercase id for the society or series (e.g. `jos`, `icep`); `edition`: number (第131回 → 131).
- Dates `YYYY-MM-DD`. Use the fiscal year carefully (lists often run April–March).
- `venues`: official venue names in Japanese, separated by `;`.
- `field`: one of medicine, health (nursing, pharmacy, dentistry, rehab, co-medical), science, engineering, it, agriculture, environment_energy, social_science, humanities, education, business, other. `field_detail`: e.g. ophthalmology.
- `scope`: international / national / regional (地方会, 支部, Hokkaido-only).
- `is_public`: 1 open, 0 members only, empty if unknown.
- `attendees`: total, with `attendees_kind` = actual (past, reported), expected (organizer's own forecast). Leave empty if not published. Note the number's source in `notes` if it differs from `source_url`.
- `program_status`: full_online / partial / pdf_only / login_required / not_yet (check the event site if you open it).
- `confidence`: checked (official organizer or city page), reported (listing or third-party page), unsure.
- Quote any field containing a comma.

Also write a 5-line gaps note at the bottom of your return message, not in a file.
