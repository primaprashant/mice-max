import type { APIRoute } from "astro";
import { ATTENDEE_COOKIE, DEMO_ATTENDEE_ID } from "../../data/attendee";

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect }) => {
  // The password is never checked.
  cookies.set(ATTENDEE_COOKIE, DEMO_ATTENDEE_ID, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  return redirect("/c/jadm32");
};
