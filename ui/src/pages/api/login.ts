import type { APIRoute } from "astro";
import { ATTENDEE_COOKIE, CONSENT_COOKIE, DEMO_ATTENDEE_ID } from "../../data/attendee";

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect, request }) => {
  const form = await request.formData();
  // The password is never checked. Consent is required by the form; store it.
  if (form.get("consent")) {
    cookies.set(CONSENT_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  cookies.set(ATTENDEE_COOKIE, DEMO_ATTENDEE_ID, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  return redirect("/c/jadm32");
};
