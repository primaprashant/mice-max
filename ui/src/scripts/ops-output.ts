/** Ops step cards: fill the output <pre> from the JSON embedded in a
 * <script type="application/json"> tag when the card first opens, so the
 * server ships each card's JSON once, compact, and never pretty-prints it
 * for cards nobody opens. */
function fill(details: HTMLDetailsElement) {
  const pre = details.querySelector<HTMLElement>("[data-ops-pre]");
  const json = details.querySelector<HTMLScriptElement>("script[data-ops-output]");
  if (!pre || !json) return;
  try {
    pre.querySelector("code")!.textContent = JSON.stringify(JSON.parse(json.textContent ?? "{}"), null, 1);
  } catch {
    pre.querySelector("code")!.textContent = json.textContent ?? "";
  }
  pre.classList.remove("hidden");
  json.remove();
}

for (const details of document.querySelectorAll<HTMLDetailsElement>("details[data-ops-details]")) {
  if (details.open) fill(details);
  else details.addEventListener("toggle", () => fill(details), { once: true });
}
