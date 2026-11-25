/** Streams the recorded call audio from data/media/calls/<id>.mp3.
 * The file stays in data/, like the photos the build copies into public/. */
export const prerender = false;

import type { APIRoute } from "astro";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Resolved from the repo layout (ui → mice-max/data); the built bundle lives
 * deeper, so walk up with a real path resolver until the directory exists. */
const AUDIO_DIR = "data/media/calls";
const DEFAULT_DIR = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    const candidate = resolve(dir, AUDIO_DIR);
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  return resolve(dir, AUDIO_DIR);
})();

export const GET: APIRoute = async ({ params }) => {
  const conference = String(params.conference ?? "");
  if (!/^[a-z0-9]+$/.test(conference)) {
    return new Response("bad conference id", { status: 400 });
  }
  try {
    const mp3 = await readFile(`${DEFAULT_DIR}/${conference}.mp3`);
    return new Response(new Uint8Array(mp3), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
};
