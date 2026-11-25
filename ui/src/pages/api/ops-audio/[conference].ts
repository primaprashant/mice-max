/** Serves the recorded call audio from data/media/calls/<id>.mp3 with Range
 * support, so the browser can seek without downloading the whole file.
 * The file stays in data/, like the photos the build copies into public/. */
export const prerender = false;

import type { APIRoute } from "astro";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
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

export const GET: APIRoute = async ({ params, request }) => {
  const conference = String(params.conference ?? "");
  if (!/^[a-z0-9]+$/.test(conference)) {
    return new Response("bad conference id", { status: 400 });
  }
  try {
    const path = `${DEFAULT_DIR}/${conference}.mp3`;
    const size = (await stat(path)).size;
    const base = {
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
    };
    const match = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
    if (match && (match[1] !== "" || match[2] !== "")) {
      let start: number;
      let end: number;
      if (match[1] === "") {
        // Suffix range "bytes=-N": the last N bytes.
        const n = Math.min(Number(match[2]), size);
        start = size - n;
        end = size - 1;
      } else {
        start = Number(match[1]);
        end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
      }
      if (start >= size || start > end) {
        return new Response("range not satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }
      const len = end - start + 1;
      return new Response(Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream, {
        status: 206,
        headers: {
          ...base,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(len),
        },
      });
    }
    return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, {
      headers: { ...base, "Content-Length": String(size) },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
};
