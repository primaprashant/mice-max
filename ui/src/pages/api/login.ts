import type { APIRoute } from "astro";
import { ATTENDEE_COOKIE, CONSENT_COOKIE, DEMO_ATTENDEE_ID } from "../../data/attendee";

export const prerender = false;

// One login for all three views; the tab on the form picks the redirect.
const REDIRECTS: Record<string, string> = {
  attendee: "/c/jadm32",
  organizer: "/organize",
  city: "/city",
};

export const POST: APIRoute = async ({ cookies, redirect, request }) => {
  const form = await request.formData();
  // The password is never checked. Consent is required for the attendee role
  // (the form enforces it; store the flag when it is given).
  if (form.get("consent")) {
    cookies.set(CONSENT_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  cookies.set(ATTENDEE_COOKIE, DEMO_ATTENDEE_ID, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  return redirect(REDIRECTS[String(form.get("role"))] ?? REDIRECTS.attendee!);
};
