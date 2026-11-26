/** Shared suggestion-card collection for the attendee calendar and the
 * organizer view: one day's cards, de-duplicated across windows, plus the
 * tag-chip derivation both pages render identically. */
import { experienceTags } from "./index";
import type { Experience, ExperienceCopy, Tag, Window as FreeWindow } from "./types";

export interface SuggestionCard {
  experience: Experience;
  copy: NonNullable<ExperienceCopy>;
  win: FreeWindow;
  tags: Tag[];
  /** Organizer stats, present only when requested. */
  shown?: number;
  joined?: number;
}

export function suggestionCardsForDay(
  windows: FreeWindow[],
  suggestionsByWindow: Map<string, { experience: Experience; copy: NonNullable<ExperienceCopy>; shown?: number; joined?: number }[]>,
): SuggestionCard[] {
  const seen = new Set<string>();
  const cards: SuggestionCard[] = [];
  for (const w of windows) {
    for (const s of suggestionsByWindow.get(w.id) ?? []) {
      if (seen.has(s.experience.id)) continue;
      seen.add(s.experience.id);
      cards.push({ ...s, win: w, tags: experienceTags(s.experience.id) });
    }
  }
  return cards;
}

/** The union of the cards' tags, most used first, capped at 8. */
export function filterTagsForCards(cards: SuggestionCard[], tagCatalog: Tag[], cap = 8): Tag[] {
  const count = new Map<string, number>();
  for (const c of cards) for (const tg of c.tags) count.set(tg.id, (count.get(tg.id) ?? 0) + 1);
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map(([id]) => tagCatalog.find((tg) => tg.id === id))
    .filter((tg): tg is Tag => Boolean(tg));
}
