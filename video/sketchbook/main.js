// Sketchbook Sapporo: entry point. Draws each frame into two 2D canvases, then composites on paper.
import { C, D, push, pop, hand, textWidth, prog, ease, clamp } from './ink.js';
import { makeCompositor } from './paper.js';
import { loadMaps, introMap } from './map.js';
import { street, streetCam, counter } from './street.js';
import { office } from './office.js';
import { city } from './city.js';
import { scale } from './scale.js';
import { loadLogo, logo } from './logo.js';

const mk = () => Object.assign(document.createElement('canvas'), { width: 1920, height: 1080 });
const ink = mk(), fill = mk();
D.I = ink.getContext('2d', { willReadFrequently: true }); D.F = fill.getContext('2d', { willReadFrequently: true });
let TL, composite;

function header(t) {
  for (const b of TL.beats) {
    if (b.id === 'logo') continue;
    const tin = b.start + (b.id === 'arrive' ? 0.2 : 0.06);
    if (t < tin || t > b.end) continue;
    const pin = prog(t, tin, tin + 0.3 + b.text.length * 0.011);
    const out = ease(prog(t, b.end - 0.22, b.end));
    const size = Math.min(132, 1680 * 100 / textWidth(b.text, 100));
    push(0, -out * 24, 1, 0, 1 - out);
    hand(b.text, 960, 175, size, pin, { seed: b.start * 10 });
    pop();
  }
}

function frame(t) {
  D.t = t; D.bf = Math.floor(t * 12);
  for (const c of [D.I, D.F]) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 1920, 1080); c.globalAlpha = 1; }
  D.sc = 1; D.alpha = 1;
  const sc = streetCam(Math.min(t, 15));
  const down = ease(prog(t, 14.65, 15.3)), side = ease(prog(t, 21.7, 22.3));
  D.pan = [sc[0] * 0.9 + 1920 * side, sc[1] * 0.9 + 820 * down];

  if (t < 1.75) {
    const m = introMap(t);
    if (t > 1.0) {
      const zmul = m.K / (175 * 1.25 * 30);
      const ax = 960 + (m.sap[0] - m.mx) * m.K, ay = m.sy + (m.sap[1] - m.my) * m.K;
      push(0, 0, 1, 0, prog(t, 1.05, 1.45)); street(t, zmul, ax, ay); pop();
    }
  } else if (t < 15.35) {
    push(0, -820 * down); street(t); counter(t); pop();
  }
  if (t > 14.6 && t < 22.35) { push(-1920 * side, 820 * (1 - down)); office(t); pop(); }
  if (t > 21.65 && t < 25.5) { push(1920 * (1 - side), 0); city(t); pop(); }
  if (t >= 25.5 && t < 29.0) scale(t);
  if (t >= 28.5) logo(t);
  header(t);
  composite(D.pan, D.bf);
}

window.ready = (async () => {
  const font = new FontFace('Caveat', 'url(../shared/fonts/Caveat.ttf)', { weight: '400 700' });
  document.fonts.add(await font.load());
  TL = await fetch('../shared/timeline.json').then(r => r.json());
  await Promise.all([loadMaps(), loadLogo()]);
  composite = makeCompositor(document.getElementById('gl'), ink, fill);
})();
window.renderAt = t => frame(t);

if (!location.search.includes('render')) {
  const fit = () => { const s = Math.min(innerWidth / 1920, innerHeight / 1080); document.getElementById('gl').style.transform = `scale(${s})`; };
  addEventListener('resize', fit); fit();
  window.ready.then(() => {
    const t0 = performance.now();
    const loop = () => { frame(((performance.now() - t0) / 1000) % TL.duration); requestAnimationFrame(loop); };
    loop();
  });
}
