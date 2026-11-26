// Render a direction to MP4 or stills, frame by frame.
//   node shared/render.mjs sketchbook                      -> out/sketchbook.mp4 (1080p60)
//   node shared/render.mjs sketchbook --stills 1,5.5,9     -> out/sketchbook-stills/t05.50.png ...
//   options: --fps 30  --from 4 --to 8  --scale 0.5  --out file.mp4
//   --jobs 8   render 8 chunks in parallel pages, then join them (use on many-core machines)
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'ffmpeg-static';
import { serve } from './serve.mjs';

const args = process.argv.slice(2);
const dir = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const tl = JSON.parse(fs.readFileSync(new URL('./timeline.json', import.meta.url)));
const fps = +opt('fps', tl.fps), from = +opt('from', 0), to = +opt('to', tl.duration), scale = +opt('scale', 1);
const outDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../out');
fs.mkdirSync(outDir, { recursive: true });

const server = await serve();
const browsers = [];

// One browser per job: they would otherwise share a single GPU process.
async function openPage() {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  browsers.push(browser);
  const page = await browser.newPage({ viewport: { width: tl.width, height: tl.height }, deviceScaleFactor: scale });
  page.on('console', m => m.type() === 'error' && console.error('[page]', m.text()));
  page.on('pageerror', e => console.error('[page]', e.message));
  await page.goto(`http://localhost:${server.address().port}/${dir}/?render`);
  await page.waitForFunction(() => window.ready !== undefined);
  await page.evaluate(() => window.ready);
  await page.evaluate(() => document.fonts.ready);
  return async t => { await page.evaluate(t => window.renderAt(t), t); return page.screenshot({ type: 'png' }); };
}

// Render frames [i0, i1) to an MP4 file.
async function renderRange(i0, i1, out, log) {
  const shot = await openPage();
  const ff = spawn(ffmpeg, ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-vf', `scale=${Math.round(tl.width * scale)}:-2`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'ignore'] });
  for (let i = i0; i < i1; i++) {
    const buf = await shot(from + i / fps);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    log(i - i0 + 1);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}

if (opt('stills')) {
  const sd = path.join(outDir, `${dir}-stills`);
  fs.mkdirSync(sd, { recursive: true });
  const shot = await openPage();
  for (const t of opt('stills').split(',').map(Number)) {
    const f = path.join(sd, `t${t.toFixed(2).padStart(5, '0')}.png`);
    fs.writeFileSync(f, await shot(t));
    console.log(f);
  }
} else {
  const out = opt('out', path.join(outDir, `${dir}.mp4`));
  const n = Math.round((to - from) * fps), jobs = Math.max(1, +opt('jobs', 1)), t0 = Date.now();
  const done = new Array(jobs).fill(0);
  const log = j => k => { done[j] = k; const d = done.reduce((a, b) => a + b, 0);
    if (d % 30 === 0) process.stdout.write(`\r${d}/${n} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s`); };
  if (jobs === 1) {
    await renderRange(0, n, out, log(0));
  } else {
    const size = Math.ceil(n / jobs);
    const parts = [...Array(jobs).keys()].map(j => path.join(outDir, `${dir}.part${j}.mp4`));
    await Promise.all(parts.map((p, j) => renderRange(j * size, Math.min(n, (j + 1) * size), p, log(j))));
    const list = path.join(outDir, `${dir}.parts.txt`);
    fs.writeFileSync(list, parts.map(p => `file '${p}'`).join('\n'));
    await new Promise(r => spawn(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy',
      '-movflags', '+faststart', out], { stdio: 'ignore' }).on('close', r));
    for (const p of [...parts, list]) fs.rmSync(p);
  }
  console.log(`\n${out} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await Promise.all(browsers.map(b => b.close()));
server.close();
