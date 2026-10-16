#!/usr/bin/env node
/**
 * Generates docs/thumbnail.svg, the project thumbnail (3:2, 1500 x 1000).
 *
 * The artwork is the product itself: a 24 hour Rhythm Ring built with the same
 * geometry code the app uses, a lit window at its centre, and a heartbeat line
 * running through it. Render to PNG with scripts/render-thumbnail.js.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEGMENTS, minuteToAngle, polar, segmentPath } from '../public/js/ring-math.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const W = 1500;
const H = 1000;
const CX = 1030;
const CY = 505;

const R = { face: 150, todayIn: 166, todayOut: 214, usualIn: 226, usualOut: 272, tick: 292 };

/** A believable usual day: quiet night, wake at 7:15, three meal peaks, wind-down by 9 pm. */
function usualIntensity(i) {
  const minute = i * 30 + 15;
  if (minute < 7 * 60 || minute > 21 * 60) return 0;
  const peak = (m, w) => Math.exp(-(((minute - m) / w) ** 2));
  return Math.min(1, 0.28 + 0.75 * Math.max(peak(8 * 60, 60), peak(12.5 * 60, 70), peak(18 * 60, 70)));
}

/** Where today has got to. 14:20 reads as "mid-afternoon, going well". */
const NOW_MIN = 14 * 60 + 20;
const todayActive = (i) => i * 30 < NOW_MIN && usualIntensity(i) > 0.3 && (i * 7) % 5 !== 0;

const parts = [];
const add = (s) => parts.push(s);

add(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Hearthbeat: does today look like a usual day? A 24 hour ring with a heartbeat line through a lit window. No video, no audio, no snapshots.">`);
add(`<defs>
  <radialGradient id="bg" cx="68%" cy="50%" r="80%">
    <stop offset="0" stop-color="#2a1d12"/><stop offset="0.55" stop-color="#17100a"/><stop offset="1" stop-color="#0c0805"/>
  </radialGradient>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="#ffb347" stop-opacity="0.55"/><stop offset="0.5" stop-color="#e8912d" stop-opacity="0.16"/><stop offset="1" stop-color="#e8912d" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="beat" x1="0" x2="1">
    <stop offset="0" stop-color="#ffb347" stop-opacity="0"/><stop offset="0.25" stop-color="#ffb347"/><stop offset="0.75" stop-color="#ffd9a1"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/>
  </linearGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
</defs>`);
add(`<rect width="${W}" height="${H}" fill="url(#bg)"/>`);

// Warm specks, like a lit window seen through dust.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (let i = 0; i < 70; i += 1) {
  add(`<circle cx="${(rnd() * W).toFixed(0)}" cy="${(rnd() * H).toFixed(0)}" r="${(0.8 + rnd() * 2).toFixed(1)}" fill="#ffd9a1" opacity="${(0.05 + rnd() * 0.18).toFixed(2)}"/>`);
}

// Everything that makes up the ring is one group, scaled and nudged right to leave room for the words.
add(`<g transform="translate(1110 505) scale(0.92) translate(-${CX} -${CY})">`);
// Halo behind the ring.
add(`<circle cx="${CX}" cy="${CY}" r="420" fill="url(#glow)"/>`);

// Usual-day band (outer) and today band (inner).
for (let i = 0; i < SEGMENTS; i += 1) {
  const a0 = minuteToAngle(i * 30);
  const a1 = minuteToAngle((i + 1) * 30);
  const u = usualIntensity(i);
  if (u > 0) {
    add(`<path d="${segmentPath(CX, CY, R.usualIn, R.usualOut, a0, a1, 0.012)}" fill="#e8912d" opacity="${(0.2 + 0.8 * u).toFixed(2)}"/>`);
  } else {
    add(`<path d="${segmentPath(CX, CY, R.usualIn, R.usualOut, a0, a1, 0.012)}" fill="#54442f" opacity="0.5"/>`);
  }
  if (i * 30 < NOW_MIN) {
    if (todayActive(i)) {
      add(`<path d="${segmentPath(CX, CY, R.todayIn, R.todayOut, a0, a1, 0.012)}" fill="#5cc4a8"/>`);
    } else {
      add(`<path d="${segmentPath(CX, CY, R.todayIn, R.todayOut, a0, a1, 0.012)}" fill="#54442f" opacity="0.55"/>`);
    }
  } else {
    add(`<path d="${segmentPath(CX, CY, R.todayIn, R.todayOut, a0, a1, 0.012)}" fill="none" stroke="#6b5a42" stroke-width="2" stroke-dasharray="3 6"/>`);
  }
}

// Ticks and labels.
for (let hr = 0; hr < 24; hr += 3) {
  const a = minuteToAngle(hr * 60);
  const p1 = polar(CX, CY, R.usualOut + 10, a);
  const p2 = polar(CX, CY, R.tick + 6, a);
  add(`<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="#7a6648" stroke-width="3"/>`);
}
// The lit house at the centre.
add(`<circle cx="${CX}" cy="${CY}" r="${R.face}" fill="#1d150e" stroke="#3a2f23" stroke-width="3"/>`);
add(`<circle cx="${CX}" cy="${CY + 18}" r="118" fill="url(#glow)" filter="url(#soft)"/>`);
const hx = CX;
const hy = CY;
add(`<path d="M${hx - 78} ${hy + 4} L${hx} ${hy - 62} L${hx + 78} ${hy + 4} L${hx + 78} ${hy + 76} L${hx - 78} ${hy + 76} Z" fill="#2a1d12" stroke="#f6d9a8" stroke-width="5" stroke-linejoin="round"/>`);
add(`<rect x="${hx - 48}" y="${hy + 14}" width="40" height="40" rx="5" fill="#ffc15e"/>`);
add(`<path d="M${hx - 28} ${hy + 14}V${hy + 54}M${hx - 48} ${hy + 34}H${hx - 8}" stroke="#7a3f06" stroke-width="3"/>`);
add(`<rect x="${hx + 12}" y="${hy + 24}" width="36" height="52" rx="5" fill="#3a2a1a" stroke="#f6d9a8" stroke-width="3"/>`);
add(`<circle cx="${hx + 40}" cy="${hy + 52}" r="3.5" fill="#ffc15e"/>`);

// Heartbeat line straight through the ring.
const by = CY + 6;
const x0 = 700;
const x1 = 1500;
const beat = [
  [x0, by], [760, by], [800, by], [828, by - 18], [850, by + 14], [880, by - 6], [920, by],
  [CX - 150, by], [CX - 108, by], [CX - 84, by - 26], [CX - 58, by + 58], [CX - 24, by - 170], [CX + 12, by + 120],
  [CX + 38, by - 34], [CX + 66, by], [CX + 150, by], [1240, by], [1275, by - 22], [1300, by + 16], [1326, by - 8], [1352, by], [x1, by],
];
const path = beat.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
add(`<path d="${path}" fill="none" stroke="#ffb347" stroke-width="16" stroke-linejoin="round" stroke-linecap="round" opacity="0.35" filter="url(#soft)"/>`);
add(`<path d="${path}" fill="none" stroke="url(#beat)" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>`);

// Hour labels sit above the line, with a dark outline so the line never cuts through them.
for (const [hr, label] of [[0, '12 AM'], [6, '6 AM'], [12, '12 PM'], [18, '6 PM']]) {
  const p = polar(CX, CY, R.tick + 38, minuteToAngle(hr * 60));
  add(`<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" fill="#d8c7ad" stroke="#17100a" stroke-width="9" paint-order="stroke" font-family="Segoe UI, system-ui, sans-serif" font-size="26" font-weight="650" text-anchor="middle" dominant-baseline="middle">${label}</text>`);
}

// Now marker: a small bright dot on the usual band and a doorbell glow earlier in the day.
const nowP = polar(CX, CY, R.usualOut + 24, minuteToAngle(NOW_MIN));
add(`<circle cx="${nowP.x.toFixed(1)}" cy="${nowP.y.toFixed(1)}" r="13" fill="#fff7e8"/>`);
const bell = polar(CX, CY, R.usualOut + 24, minuteToAngle(9 * 60 + 55));
add(`<circle cx="${bell.x.toFixed(1)}" cy="${bell.y.toFixed(1)}" r="9" fill="#ffd9a1"/>`);

add('</g>');

// Words.
const serif = "Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif";
const sans = "Segoe UI, system-ui, -apple-system, sans-serif";
add(`<text x="96" y="236" fill="#f4ebdd" font-family="${serif}" font-size="150" font-weight="700" letter-spacing="-2">Hearthbeat</text>`);
add(`<text x="100" y="352" fill="#ffd9a1" font-family="${serif}" font-size="62" font-weight="500">Does today look like</text>`);
add(`<text x="100" y="424" fill="#ffd9a1" font-family="${serif}" font-size="62" font-weight="500" font-style="italic">a usual day?</text>`);
add(`<text x="100" y="512" fill="#bcab96" font-family="${sans}" font-size="30">A calm answer for families, from</text>`);
add(`<text x="100" y="552" fill="#bcab96" font-family="${sans}" font-size="30">when a doorbell or camera noticed movement.</text>`);

// Three "never" chips.
const chips = [['No video', 100], ['No audio', 340], ['No snapshots', 570]];
for (const [label, x] of chips) {
  const w = label === 'No snapshots' ? 258 : 206;
  add(`<rect x="${x}" y="640" width="${w}" height="72" rx="36" fill="#241a11" stroke="#5a4630" stroke-width="2"/>`);
  add(`<circle cx="${x + 38}" cy="676" r="17" fill="none" stroke="#f08a73" stroke-width="4"/>`);
  add(`<path d="M${x + 27} ${676 + 11} L${x + 49} ${676 - 11}" stroke="#f08a73" stroke-width="4" stroke-linecap="round"/>`);
  add(`<text x="${x + 68}" y="687" fill="#f4ebdd" font-family="${sans}" font-size="30" font-weight="650">${label}</text>`);
}

add(`<text x="100" y="860" fill="#e8912d" font-family="${sans}" font-size="26" font-weight="700" letter-spacing="3">THE PERSON BEING CARED FOR HOLDS THE OFF SWITCH</text>`);
add(`<text x="100" y="900" fill="#8f7e69" font-family="${sans}" font-size="24">Pause, see who looked, delete everything. Always.</text>`);

add('</svg>');

mkdirSync(resolve(root, 'docs'), { recursive: true });
writeFileSync(resolve(root, 'docs/thumbnail.svg'), parts.join('\n') + '\n');
console.log('wrote docs/thumbnail.svg');
