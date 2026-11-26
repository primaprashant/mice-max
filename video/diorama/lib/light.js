// Time of day: soft daylight, warm evening for the free-time beats, day again up high, dusk for the pull-out.
import * as THREE from 'three';
import { smooth } from './util.js';

const PAL = {
  day:     { top: '#8cc3f0', bottom: '#fdf3e6', glow: '#ffffff', sun: '#fff0d8', sunI: 3.1, sky: '#dcecff', ground: '#b4bfa8', hemiI: 1.0, fog: '#e6eff5', sunH: 1.4 },
  grey:    { top: '#a7b3c2', bottom: '#e6e7e8', glow: '#ffffff', sun: '#eef0f2', sunI: 1.5, sky: '#dfe5ec', ground: '#a3a9a6', hemiI: 1.15, fog: '#dfe3e8', sunH: 1.6 },
  evening: { top: '#3c4c9c', bottom: '#ffa77a', glow: '#ff9466', sun: '#ffb37c', sunI: 2.3, sky: '#7c8dd0', ground: '#5f5a72', hemiI: 0.85, fog: '#cdb3c2', sunH: 0.55 },
  dusk:    { top: '#33468e', bottom: '#ffb38c', glow: '#ff9a70', sun: '#ffd2a8', sunI: 2.4, sky: '#aab4e6', ground: '#8a87a0', hemiI: 1.1, fog: '#c9b4c4', sunH: 0.9 },
};
// [time, palette]; blends smoothly between consecutive keys.
const KEYS = [[0, 'day'], [4.3, 'day'], [5.4, 'grey'], [7.5, 'grey'], [9.4, 'evening'], [14.6, 'evening'], [16.2, 'day'], [25.4, 'day'], [26.7, 'dusk'], [30, 'dusk']];

const cache = {};
const col = h => (cache[h] ??= new THREE.Color(h));
export function palette(t) {
  let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= t) i++;
  const [ta, a] = KEYS[i], [tb, b] = KEYS[i + 1], k = smooth(ta, tb, t), A = PAL[a], B = PAL[b], o = {};
  for (const key in A) o[key] = typeof A[key] === 'number' ? A[key] + (B[key] - A[key]) * k : col(A[key]).clone().lerp(col(B[key]), k);
  return o;
}
