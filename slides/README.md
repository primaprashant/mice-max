# SLIDES

Your demo-night slides as hh-deck/1 JSON. See [schema.json](./schema.json)

## Evaluation

See [trials/evaluation.md](./trials/evaluation.md)

## Slide types

- title: title, subtitle (defaults: project name and pitch)
- problem: title, body (markdown), stat { value, label }
- demo: mode "live" or "video", url, fallback "video" or "none"
- how: title, steps (max 6), stack (max 10), body
- metrics: auto (portal numbers), items (max 4 { value, label })
- image: src (https), alt, caption
- quote: text, who
- next: title, bullets (max 5), ask
- md: title, body (markdown)
Every slide can have notes for the speaker.

## Output

Trials: as many versions as wanted, in [trials/](./trials/), one `joininter.json` file per version. Kaustubh reviews them and picks.

The portal entry [micemax](./micemax.joininter.json) stays the final choice only.

## Final output

The chosen version, copied to [micemax](./micemax.joininter.json): **max 8 slides, 3 minutes with the demo**. Saved automatically when it is valid.

## References

- Look at these skills: `/frontend-slides`, `/slides-preferences` to understand what information heirarchy to follow, and how that information is presented.
