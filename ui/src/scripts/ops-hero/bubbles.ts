// Thought bubbles, the hover label and department labels, drawn as HTML over the canvas.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { HUMAN, type Text } from '../../data/ops-home';
import type { HeroNode } from './nodes';

const CSS = `
.oh-bubble { pointer-events: none; }
.oh-bubble-in {
  max-width: 16rem; padding: 0.45rem 0.7rem; border-radius: 0.6rem;
  font: 500 14px/1.35 var(--font-sans, system-ui, sans-serif); color: #e6edf7;
  background: rgba(8, 12, 22, 0.72); border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
  box-shadow: 0 0 24px -6px var(--c), inset 0 0 12px -8px var(--c);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  transform: translateY(6px) scale(0.96); opacity: 0;
  transition: opacity 0.35s ease, transform 0.35s ease; white-space: normal;
}
.oh-bubble.on .oh-bubble-in { opacity: 1; transform: none; }
.oh-bubble.off .oh-bubble-in { opacity: 0; transform: translateY(-6px); }
.oh-caret { display: inline-block; width: 0.5ch; height: 1em; margin-left: 1px; vertical-align: -2px; background: var(--c); animation: oh-blink 0.8s steps(2) infinite; }
.oh-wave { display: inline-flex; gap: 2px; align-items: center; height: 14px; margin-right: 0.45rem; vertical-align: -2px; }
.oh-wave i { width: 2px; height: 100%; background: var(--c); border-radius: 1px; animation: oh-wave 0.9s ease-in-out infinite; }
.oh-wave i:nth-child(2) { animation-delay: -0.15s } .oh-wave i:nth-child(3) { animation-delay: -0.3s }
.oh-wave i:nth-child(4) { animation-delay: -0.45s } .oh-wave i:nth-child(5) { animation-delay: -0.6s }
.oh-label { pointer-events: none; }
.oh-label-in {
  min-width: 11rem; max-width: 16rem; padding: 0.55rem 0.75rem; border-radius: 0.6rem;
  font: 400 12.5px/1.4 var(--font-sans, system-ui, sans-serif); color: #cbd5e1;
  background: rgba(5, 8, 15, 0.88); border: 1px solid color-mix(in srgb, var(--c) 70%, transparent);
  box-shadow: 0 0 30px -8px var(--c);
}
.oh-label-in b { display: block; font: 600 13px/1.3 var(--font-mono, ui-monospace, monospace); color: var(--c); margin-bottom: 0.2rem; }
.oh-label-in small { display: block; margin-top: 0.35rem; font: 500 11px/1.3 var(--font-mono, ui-monospace, monospace); color: #8796ad; text-transform: uppercase; letter-spacing: 0.06em; }
.oh-dept {
  pointer-events: none; font: 600 11px/1 var(--font-mono, ui-monospace, monospace);
  letter-spacing: 0.22em; text-transform: uppercase; color: var(--c); opacity: 0.55;
}
.oh-comet { pointer-events: none; font: 500 12px/1 var(--font-mono, ui-monospace, monospace); color: #f8fafc;
  padding: 0.3rem 0.5rem; border-radius: 0.4rem; background: rgba(8,12,22,0.6); border: 1px solid rgba(255,255,255,0.25);
  white-space: nowrap; transform: translateY(-1.6rem); }
@keyframes oh-blink { to { visibility: hidden; } }
@keyframes oh-wave { 0%, 100% { transform: scaleY(0.25); } 50% { transform: scaleY(1); } }
`;

export function injectStyles() {
  if (document.getElementById('ops-hero-style')) return;
  const s = document.createElement('style');
  s.id = 'ops-hero-style';
  s.textContent = CSS;
  document.head.append(s);
}

export const lang = (): 'en' | 'ja' => (document.documentElement.lang?.startsWith('ja') ? 'ja' : 'en');
export const pick = (t: Text) => t[lang()];

const cssColor = (c: THREE.Color) => `#${c.getHexString()}`;

interface Bubble {
  obj: CSS2DObject;
  textEl: HTMLElement;
  text: string;
  age: number;
}

const TYPE_SPEED = 38; // characters per second
const HOLD = 2.5; // seconds after typing finishes

export class Bubbles {
  private list: Bubble[] = [];
  max = 3; // at most this many on screen

  show(node: HeroNode, text: Text, opts: { color?: THREE.Color; wave?: boolean } = {}) {
    while (this.list.length >= this.max) this.remove(this.list[0]);
    const el = document.createElement('div');
    el.className = 'oh-bubble';
    el.style.setProperty('--c', cssColor(opts.color ?? node.color));
    const inner = document.createElement('div');
    inner.className = 'oh-bubble-in';
    if (opts.wave) inner.innerHTML = '<span class="oh-wave"><i></i><i></i><i></i><i></i><i></i></span>';
    const textEl = document.createElement('span');
    const caret = document.createElement('span');
    caret.className = 'oh-caret';
    inner.append(textEl, caret);
    el.append(inner);
    const obj = new CSS2DObject(el);
    obj.center.set(0.5, 1);
    obj.position.set(0, node.radius * 2.6, 0);
    node.group.add(obj);
    requestAnimationFrame(() => el.classList.add('on'));
    this.list.push({ obj, textEl, text: pick(text), age: 0 });
  }

  private remove(b: Bubble) {
    b.obj.removeFromParent();
    b.obj.element.remove();
    this.list = this.list.filter((x) => x !== b);
  }

  update(dt: number) {
    for (const b of [...this.list]) {
      b.age += dt;
      const typed = Math.min(b.text.length, Math.floor(b.age * TYPE_SPEED));
      if (b.textEl.textContent!.length !== typed) b.textEl.textContent = b.text.slice(0, typed);
      const typeDone = b.text.length / TYPE_SPEED;
      if (b.age > typeDone + 0.6) b.obj.element.querySelector('.oh-caret')?.remove();
      if (b.age > typeDone + HOLD) b.obj.element.classList.add('off');
      if (b.age > typeDone + HOLD + 0.45) this.remove(b);
    }
  }

  clear() {
    for (const b of [...this.list]) this.remove(b);
  }
}

/** The label shown while hovering a node: name, role and tool. */
export class HoverLabel {
  private obj: CSS2DObject;
  private inner: HTMLElement;
  current: HeroNode | null = null;

  constructor() {
    const el = document.createElement('div');
    el.className = 'oh-label';
    this.inner = document.createElement('div');
    this.inner.className = 'oh-label-in';
    el.append(this.inner);
    this.obj = new CSS2DObject(el);
    this.obj.center.set(-0.12, 0.5);
  }

  set(node: HeroNode | null) {
    if (node === this.current) return;
    this.current = node;
    this.obj.removeFromParent();
    if (!node) return;
    const ja = lang() === 'ja';
    const a = node.agent;
    const name = a ? a.id : ja ? HUMAN.label_ja : HUMAN.label_en;
    const role = a ? (ja ? a.role_ja : a.role_en) : ja ? HUMAN.role_ja : HUMAN.role_en;
    let meta = a ? `${ja ? 'ツール' : 'Tool'}: ${a.tool}` : ja ? '人のチーム: 1人' : 'Team size: 1';
    if (a?.mode === 'next') meta = ja ? '次に追加予定' : 'Coming next';
    this.inner.replaceChildren();
    const b = document.createElement('b');
    b.textContent = name;
    const p = document.createElement('span');
    p.textContent = role;
    const s = document.createElement('small');
    s.textContent = meta;
    this.inner.append(b, p, s);
    if (a) {
      const open = document.createElement('small');
      open.textContent = ja ? 'クリックで画面を開く' : 'Click to open';
      this.inner.append(open);
    }
    this.obj.element.style.setProperty('--c', cssColor(node.color));
    this.obj.position.set(node.radius * 2.4, 0, 0);
    node.group.add(this.obj);
  }
}

export function deptLabel(text: string, color: string, pos: THREE.Vector3): CSS2DObject {
  const el = document.createElement('div');
  el.className = 'oh-dept';
  el.style.setProperty('--c', color);
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.position.copy(pos);
  return obj;
}

export function cometLabel(text: Text): CSS2DObject {
  const el = document.createElement('div');
  el.className = 'oh-comet';
  el.textContent = pick(text);
  return new CSS2DObject(el);
}
