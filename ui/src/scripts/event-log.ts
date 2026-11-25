/** The one client that talks to the backend. Appends rows to the event log
 * through POST /api/events on the FastAPI backend, which owns the Neon
 * credentials. Fire-and-forget: logging must never block the UI. */

const API_BASE = import.meta.env.PUBLIC_API_BASE ?? "";
const CONFERENCE = {
  eve: "jadm32",
  xn: "jadm32",
  short: "jadm32",
  spec: "jadm32",
  combo: "jadm32",
} as const;

function guessConference(experienceId: string): string {
  // Experience ids start with a kind prefix; both demo conferences share the
  // list, so any id maps to the demo conference for the demo. Replace with a
  // data attribute when the two-conference assumption breaks.
  return CONFERENCE[experienceId.slice(0, 5) as keyof typeof CONFERENCE] ?? "jadm32";
}

export async function logEvent(
  eventType: string,
  opts: {
    experienceId?: string;
    windowId?: string;
    conferenceId?: string;
    partySize?: number;
    priceJpy?: number | null;
    channel?: string;
  } = {}
) {
  try {
    await fetch(`${API_BASE}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conference_id: opts.conferenceId ?? guessConference(opts.experienceId ?? ""),
        event_type: eventType,
        experience_id: opts.experienceId,
        window_id: opts.windowId,
        party_size: opts.partySize,
        price_jpy: opts.priceJpy ?? null,
        channel: opts.channel ?? "site",
      }),
      keepalive: true,
    });
  } catch {
    // Logging is best-effort in the demo. The backend also fails closed
    // (503) without DATABASE_URL; both cases must never block the UI.
  }
}
