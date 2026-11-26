// Beat 8: the card fills a calendar, the calendar shrinks into Sapporo, the map grows to Japan.
import { C, D, push, pop, group, stroke, seg, rectP, prog, ease, easeOut, back, lerp, clamp, hash } from './ink.js';
import { city, CARD, cardFrame, cardContents, cardProgress } from './city.js';
import { mp, place, mapPush, hokkaido, japan, cityLight } from './map.js';

const COLS = 7, ROWS = 4, CW = 196, CH = 140, GX = 960 - COLS * CW / 2, GY = 620 - ROWS * CH / 2;
const HOME = [3, 1];
const cellC = (c, r) => [GX + (c + 0.5) * CW, GY + (r + 0.5) * CH];
const MINI = 0.3;

function miniCard(x, y, s, rot) {
  push(x, y, s, rot); group(7000);
  cardFrame(true); cardContents(1, true);
  pop();
}

function calendar(t) {
  calendarGrid(t);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (c === HOME[0] && r === HOME[1]) continue;
    const d = Math.abs(c - HOME[0]) + Math.abs(r - HOME[1]);
    const k = prog(t, 25.95 + d * 0.055 + hash(c, r) * 0.04, 26.15 + d * 0.055 + hash(c, r) * 0.04);
    if (k <= 0) continue;
    const [x, y] = cellC(c, r);
    miniCard(x, y, MINI * back(k), (hash(c * 3, r) - 0.5) * 0.12);
  }
  const [hx, hy] = cellC(...HOME);
  miniCard(hx, hy, MINI, 0.0);
}

const CITIES = ['Hakodate', 'Obihiro', 'Asahikawa', 'Otaru'];
const JCITIES = ['Aomori', 'Morioka', 'Sendai', 'Niigata', 'Tokyo', 'Kanazawa', 'Shizuoka', 'Nagoya', 'Kyoto', 'Osaka', 'Okayama', 'Hiroshima', 'Matsuyama', 'Fukuoka', 'Kumamoto', 'Kagoshima'];

export function scale(t) {
  // A: the hand-made card flies into the calendar while the rest of beat 7 fades
  if (t < 26.2) {
    push(0, 0, 1, 0, 1 - prog(t, 25.5, 25.85)); city(t, true, false); pop();
  }
  const K0 = 2600, sap = place('Sapporo');
  const zb = ease(prog(t, 26.55, 27.4)), zc = ease(prog(t, 27.35, 28.45));
  let K = K0 * Math.pow(210 / K0, zb) * Math.pow(54 / 210, zc);
  const hc = mp([142.8, 43.75]), jc = mp([137.4, 37.9]);
  const pb = ease(prog(t, 26.8, 27.45));
  let mx = lerp(sap[0], hc[0], pb), my = lerp(sap[1], hc[1], pb);
  mx = lerp(mx, jc[0], zc); my = lerp(my, jc[1], zc);
  const fadeOut = 1 - prog(t, 28.5, 28.95);
  K *= 1 - 0.25 * ease(prog(t, 28.5, 29.0));
  const sy = 620;
  if (t > 26.5) {
    mapPush(mx, my, K, 960, sy, fadeOut * prog(t, 26.5, 26.85));
    japan(prog(t, 27.3, 27.95), prog(t, 27.25, 27.7));
    hokkaido(1, 0.4);
    cityLight(sap, prog(t, 27.0, 27.45), 18);
    CITIES.forEach((n, i) => cityLight(place(n), prog(t, 27.05 + i * 0.09, 27.45 + i * 0.09), 14));
    JCITIES.forEach((n, i) => cityLight(place(n), prog(t, 27.55 + i * 0.045, 27.95 + i * 0.045), 13));
    pop();
  }
  // calendar, anchored on Sapporo as the map zooms out
  if (t < 27.35) {
    const s = K / K0, sx = 960 + (sap[0] - mx) * K, ssy = sy + (sap[1] - my) * K;
    push(sx, ssy, s, 0, 1 - prog(t, 27.0, 27.3));
    push(-960, -620);
    if (t < 26.05) {
      const k = ease(prog(t, 25.5, 26.0)), [hx, hy] = cellC(...HOME);
      if (k < 1) {
        push(lerp(CARD.x, hx, k), lerp(CARD.y, hy, k), lerp(1, MINI, k), lerp(CARD.rot, 0, k));
        cardFrame(); cardContents(lerp(cardProgress(t), 1, prog(t, 25.6, 26.0)));
        pop();
      }
      if (k > 0.98) calendar(t);
      else { push(0, 0, 1, 0, prog(t, 25.6, 25.9)); calendarGrid(t); pop(); }
    } else calendar(t);
    pop(); pop();
  }
}
function calendarGrid(t) {
  group(7100);
  const g = ease(prog(t, 25.65, 26.1));
  stroke(seg(GX - 10, GY - 26, GX + COLS * CW + 10, GY - 26), { w: 7, p: g });
  for (let c = 0; c <= COLS; c++) stroke(seg(GX + c * CW, GY, GX + c * CW, GY + ROWS * CH), { w: 2.4, p: g, a: 0.8 });
  for (let r = 0; r <= ROWS; r++) stroke(seg(GX, GY + r * CH, GX + COLS * CW, GY + r * CH), { w: 2.4, p: g, a: 0.8 });
}
