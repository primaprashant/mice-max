/** Button sounds island: tactile click feedback on the interactive
 * elements named in SOUND_MAP, from the MIT-licensed button-sounds
 * package (Josh Comeau; files self-hosted in /sounds/btn).
 * Sounds play at ~35% volume per the package author's guidance, and a
 * mute toggle (sfx-muted in localStorage) silences everything for the
 * session. wireUp handles press/release with random samples; press-only
 * triggers use the lower-level press() for one-shot moments. */
import { load, press, release, setPath, wireUp, type SoundName } from "button-sounds";

const VOLUME = 0.35;
const MUTE_KEY = "sfx-muted";
const PATH = "/sounds/btn";

/** Which sound each interactive element plays, by data attribute. */
const SOUND_MAP: Record<string, SoundName> = {
  // Role tabs, calendar day tabs: soft mechanical switch.
  "sfx-tab": "uhk-soft",
  // Pagination, language toggle: slightly brighter click.
  "sfx-page": "hi75-soft",
  // Filter chips: gentle low-profile key.
  "sfx-chip": "halo-soft",
  // Conference card or any generic link click.
  "sfx-card": "asus-kbd-soft",
  // Book / join an experience; cancel or unbook.
  "sfx-book": "guitar-toggle-on",
  "sfx-unbook": "guitar-toggle-off",
  // Extra-night booking: thematically warm.
  "sfx-warm": "heated-blanket",
  // Checkout submit: snappy, deliberate.
  "sfx-submit": "ps4-snappy",
  // Run agents: snappy press, confirmation double after finish.
  "sfx-run": "ps4-snappy",
  "sfx-done": "ps4-double",
  // Organizer approve / remove a suggestion.
  "sfx-approve": "lock-closed",
  "sfx-remove": "lock-open",
  // Language toggle: synthesized, clearly non-mechanical.
  "sfx-lang": "synth-on",
  // Errors and rejections.
  "sfx-error": "treadmill-sharp",
  // Secondary, muted controls.
  "sfx-soft": "low-thumps",
};

class SfxToggle extends HTMLElement {
  connectedCallback() {
    this.sync();
    this.addEventListener("click", () => {
      const muted = localStorage.getItem(MUTE_KEY) === "1";
      localStorage.setItem(MUTE_KEY, muted ? "0" : "1");
      // Unmuting plays a soft confirm, so the user hears it worked.
      if (muted) press(SOUND_MAP["sfx-lang"]!, { volume: VOLUME });
      this.sync();
    });
  }

  private sync() {
    const muted = localStorage.getItem(MUTE_KEY) === "1";
    this.setAttribute("aria-pressed", muted ? "false" : "true");
    this.setAttribute("title", muted ? "Sound off" : "Sound on");
    this.querySelectorAll("i").forEach((icon) => {
      icon.className = muted ? "ph ph-speaker-slash" : "ph ph-speaker-high";
    });
  }
}

let wired = false;

function init() {
  if (wired) return;
  wired = true;
  setPath(PATH);
  const muted = () => localStorage.getItem(MUTE_KEY) === "1";
  const opts = { volume: VOLUME };

  for (const [attr, name] of Object.entries(SOUND_MAP)) {
    load(name);
    for (const el of document.querySelectorAll<HTMLElement>(`[data-${attr}]`)) {
      if (attr === "sfx-lang") {
        // Toggle pairs: press on the pointer down, release on up.
        el.addEventListener("pointerdown", () => {
          if (!muted()) press(name, opts);
        });
        continue;
      }
      wireUp(el, name, { ...opts, pitchVariation: 0.05 });
    }
  }

  // The mute toggle itself never plays through wireUp.
  for (const t of document.querySelectorAll("sfx-toggle")) customElements.upgrade(t);
}

customElements.define("sfx-toggle", SfxToggle);

// Astro hoists scripts as modules; run once the DOM is parseable.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export { release, press };
