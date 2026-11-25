/** Logs one plan_shown row per suggestion card the calendar renders, once
 * per browser session. The event-log rule: log experiences shown but not
 * picked. Cards inside hidden day panels do not count as shown. */
import { logEvent } from "./event-log";

const SESSION_KEY = "micemax_suggest_logged";

const cards = document.querySelectorAll<HTMLElement>("[data-suggest]");
if (sessionStorage.getItem(SESSION_KEY) !== "1") {
  sessionStorage.setItem(SESSION_KEY, "1");
  // Only visible panels count as shown.
  const shown = [...cards].filter((el) => el.offsetParent !== null);
  for (const card of shown) {
    logEvent("plan_shown", {
      experienceId: card.dataset.suggest,
      windowId: card.dataset.suggestWindow,
    });
  }
}
