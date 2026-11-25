# Project guidelines

Apply these guidelines in every agent session.

- **Keep it simple.** This is a small project with zero users and no one depending on it. Build the simplest solution for the current scope. Avoid enterprise architecture, speculative abstractions, complicated setup, and exhaustive edge-case handling. Accept minor edge-case gaps when they meaningfully simplify the code or design.
- **Delegate when useful.** Use sub-agents for suitable, separable work, especially research, web searches, and builds or checks with noisy output. Ask for concise findings and relevant file references so the main agent preserves context for larger tasks. Skip delegation when coordination would cost more than it saves.
- **Ask for human decisions.** Use the available question tool when meaningful trade-offs, preferences, or unclear scope need human input. Ask as often as needed, in small batches, including during implementation. Resolve routine details independently; do not invent unnecessary decisions for the user.
- **Be concise.** Keep responses, docs, comments, specs, plans, plan updates, and verification notes short, direct, and free of jargon. Include only what helps someone understand, decide, implement, or verify. Avoid repetition and unnecessary documents.
- **Design with intent.** Never join UI items with separator characters (`·`, `•`, `—`, `|`); they read as careless, generated design. Use layout instead: alignment, spacing, columns or separate lines. Never mark status (failed, partial, ok) with colored dots or similar markers.
- **Make the project easy for agents to navigate.** Use clear names, logical grouping, and reasonably short files and functions. Follow progressive disclosure: keep entry-point docs brief and link to focused details that agents can read when needed. Make relevant code and documentation easy to find without loading everything into context.

# Project overview

MiceMax helps people visiting Hokkaido for business events (MICE) spend more locally: it reads a conference's website, finds attendees' free time and offers experiences that fit (extra night first, then short activities, then specialist visits). Built for a 2-day hackathon in Sapporo. Organizer, attendee and city views share one conference link.

## Files

- `docs/README.md`: entry point, five-line summary, glossary, reading order.
- `docs/03-hackathon-scope.md`: what to build and not build, tech choices, and "Rules for agents building this". Read before writing code.
- `docs/05-decisions-and-open-questions.md`: decisions (D1, D2, ...) and open questions (Q1, Q2, ...). Update it when a decision changes.
- `docs/07-data-plan.md`: data the demo needs (real, written, simulated), where it is stored (SQLite master copy) and tasks T0–T9 to build it.
- `docs/08-outreach-plan.md`: real outreach during the hackathon (interviews, businesses, organizers, city) and how it shows in the demo.
- `docs/01-evidence.md`, `02-vision.md`, `04-long-term-plan.md`, `06-sources.md`: background, vision, business plan, sources [S1]...
- `docs/charts/`: chart PNGs and `make_charts.py` that draws them.
- `docs/prompts/inventory-research.md`: prompt for building the activity and venue list.
