// Mounts the 3D agent network on #ops-hero. Pauses off-screen and in hidden tabs,
// renders one still frame for reduced motion, and falls back to a grid of links without WebGL.
import { AGENTS, DEPTS, HUMAN } from '../../data/ops-home';
import { Hero } from './scene';

function webglOk(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function fallback(el: HTMLElement) {
  const ja = document.documentElement.lang?.startsWith('ja');
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:flex-end;padding:9rem 1.5rem 11rem;overflow:auto';
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:1.5rem;max-width:44rem;width:100%';
  for (const d of DEPTS) {
    const col = document.createElement('div');
    const h = document.createElement('p');
    h.textContent = ja ? d.ja : d.en;
    h.style.cssText = `color:${d.color};font:600 11px/1 var(--font-mono,monospace);letter-spacing:.2em;text-transform:uppercase;margin-bottom:.6rem`;
    col.append(h);
    for (const a of AGENTS.filter((x) => x.dept === d.id)) {
      const link = document.createElement('a');
      link.href = a.link;
      link.textContent = ja ? a.role_ja : a.role_en;
      link.title = a.id;
      link.style.cssText = `display:block;padding:.3rem 0;color:#cbd5e1;font-size:13px;text-decoration:none;border-left:2px solid ${d.color};padding-left:.6rem;margin-bottom:.25rem${a.mode === 'next' ? ';opacity:.5' : ''}`;
      col.append(link);
    }
    grid.append(col);
  }
  const human = document.createElement('p');
  human.textContent = `${ja ? HUMAN.label_ja : HUMAN.label_en}: ${ja ? HUMAN.role_ja : HUMAN.role_en}`;
  human.style.cssText = 'grid-column:1/-1;color:#ffe2b8;font-size:13px';
  grid.append(human);
  wrap.append(grid);
  el.append(wrap);
}

export function mountOpsHero(el: HTMLElement) {
  if (el.dataset.mounted) return;
  el.dataset.mounted = '1';
  if (!webglOk()) return fallback(el);

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let hero: Hero;
  try {
    hero = new Hero(el, still);
  } catch (err) {
    console.warn('ops-hero: WebGL setup failed', err);
    el.replaceChildren();
    return fallback(el);
  }

  if (still) {
    hero.renderStill();
    new ResizeObserver(() => hero.resize()).observe(el);
    return;
  }

  let onScreen = true;
  const sync = () => (onScreen && !document.hidden ? hero.start() : hero.stop());
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    sync();
  }).observe(el);
  document.addEventListener('visibilitychange', sync);
  new ResizeObserver(() => hero.resize()).observe(el);
  sync();
}

const el = document.getElementById('ops-hero');
if (el) mountOpsHero(el);
