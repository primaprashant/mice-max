// One big header per beat, words rising in one after another. Numbers in gold; the ¥170M rolls up from 33.
import { prog, ease, lerp } from './lib.js';

let beats = [];

export async function buildHeaders(root) {
  const tl = await fetch('../shared/timeline.json').then(r => r.json());
  await document.fonts.load('800 108px Geist', 'MiceMax ¥0123456789');
  beats = tl.beats.map(b => {
    const el = document.createElement('div');
    el.className = 'header' + (b.id === 'logo' ? ' logo' : '');
    const words = b.text.split(' ').map((w, i, a) => {
      const s = document.createElement('span');
      s.textContent = w + (i < a.length - 1 ? ' ' : '');
      if (/[0-9¥]/.test(w)) s.classList.add('gold');
      el.appendChild(s);
      return s;
    });
    root.appendChild(el);
    const roll = b.id === 'money' ? words.find(s => s.textContent.startsWith('¥170M')) : null;
    if (roll) { roll.style.minWidth = roll.getBoundingClientRect().width + 'px'; roll.classList.add('num'); }
    return { ...b, el, words, roll };
  });
}

export function renderHeaders(t) {
  for (const b of beats) {
    const on = t >= b.start - 0.05 && t < b.end + 0.05;
    b.el.style.display = on ? '' : 'none';
    if (!on) continue;
    const last = b.id === 'logo';
    const out = last ? 0 : ease.in(prog(t, b.end - 0.28, b.end));
    const t0 = b.start + (last ? 0.45 : 0.05);
    b.words.forEach((s, i) => {
      const p = ease.out(prog(t, t0 + i * 0.05, t0 + i * 0.05 + 0.45));
      const y = (1 - p) * 46 - out * 30;
      s.style.opacity = (p * (1 - out)).toFixed(3);
      s.style.transform = `translateY(${y.toFixed(1)}px)`;
      s.style.filter = p < 1 || out > 0 ? `blur(${((1 - p) * 10 + out * 8).toFixed(1)}px)` : 'none';
    });
    if (b.roll) {
      const v = Math.round(lerp(33, 170, ease.inOut(prog(t, b.start + 0.5, b.start + 2.3))));
      b.roll.textContent = `¥${v}M `;
    }
  }
}
