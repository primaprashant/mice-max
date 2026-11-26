// One big header per beat. Words rise in with a stagger and drift out at the end of the beat.
import { clamp, easeOut, easeIn } from './lib/util.js';

const el = document.getElementById('head');
let shown = null;

export function header(t, beats, extra) {
  const b = beats.find(b => t >= b.start && t < b.end) || beats[beats.length - 1];
  if (b.id === 'logo') { el.style.opacity = 0; return b; }
  if (shown !== b.id) {
    shown = b.id;
    el.innerHTML = b.text.split(' ').map(w => `<span>${w}</span>`).join(' ');
  }
  el.style.opacity = 1;
  const k = b.id === 'scale' ? clamp((t - 26.3) / 0.6) : 0;
  el.style.color = `rgb(${27 + 228 * k},${35 + 220 * k},${64 + 191 * k})`;
  el.style.textShadow = `0 4px 30px rgba(30, 30, 80, ${0.35 * k})`;
  const words = el.children, local = t - b.start + (b.id === 'arrive' ? 0.3 : 0), out = b.end - t;
  for (let i = 0; i < words.length; i++) {
    const k = easeOut(clamp((local - i * 0.045) / 0.5)), o = easeIn(clamp(1 - (out - 0.02) / 0.3));
    words[i].style.opacity = k * (1 - o);
    words[i].style.transform = `translateY(${(1 - k) * 46 - o * 30}px)`;
    words[i].style.filter = k < 1 || o > 0 ? `blur(${(1 - k) * 8 + o * 6}px)` : 'none';
  }
  if (extra) extra(b, words, local);
  return b;
}
