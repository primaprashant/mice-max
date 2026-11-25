/** Attendee-session helpers. The demo stores the attendee in a cookie;
 * no password is checked (the docs say so). Names never reach the event log. */
import type { AstroCookies } from "astro";

export const ATTENDEE_COOKIE = "micemax_attendee";
export const CONSENT_COOKIE = "micemax_consent";

/** The demo's logged-in attendee. The login form only takes a name; we map it
 * to one simulated attendee so the calendar shows that person's plans. */
export const DEMO_ATTENDEE_ID = "jadm32-a0081"; // 高田 海斗 / Kaito Takada, physician

export function getLang(cookies: AstroCookies): "ja" | "en" {
  return cookies.get("lang")?.value === "ja" ? "ja" : "en";
}
