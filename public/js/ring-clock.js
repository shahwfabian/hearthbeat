import { h, svg, clear } from './dom.js';
import {
  SEGMENTS,
  clockLabel,
  minuteToAngle,
  pointerToMinute,
  polar,
  segmentLabel,
  segmentOf,
  segmentPath,
  usuallyText,
} from './ring-math.js';

const C = 220; // centre of the 440 x 440 viewBox
const R = {
  face: 96,
  todayIn: 104,
  todayOut: 134,
  usualIn: 142,
  usualOut: 170,
  tickIn: 174,
  tickOut: 181,
  door: 189,
  label: 204,
};

/**
 * The Rhythm Ring: a 24 hour clock. The outer band is the person's usual day,
 * learned from two weeks of history. The inner band is today so far.
 * Point at it, or use the arrow keys, to read any half hour in words.
 *
 * Usage:
 *   const ring = createRing();
 *   container.append(ring.element);
 *   ring.update({ ring, level, doors, nowLabel, name });
 */
export function createRing() {
  const usual = [];
  const today = [];
  const future = [];

  const root = svg('svg', {
    class: 'ring-svg',
    viewBox: '0 0 440 440',
    tabindex: '0',
    role: 'group',
    'aria-roledescription': 'interactive 24 hour clock',
    'aria-label': 'Rhythm ring. Outer band shows the usual day, inner band shows today. Use left and right arrow keys to read each half hour.',
  });

  root.append(svg('circle', { class: 'ring-face', cx: C, cy: C, r: R.face }));
  root.append(svg('circle', { class: 'ring-track', cx: C, cy: C, r: (R.usualIn + R.usualOut) / 2 }));

  for (let i = 0; i < SEGMENTS; i += 1) {
    const a0 = minuteToAngle(i * 30);
    const a1 = minuteToAngle((i + 1) * 30);
    const u = svg('path', { class: 'ring-seg-usual', d: segmentPath(C, C, R.usualIn, R.usualOut, a0, a1), opacity: 0 });
    const t = svg('path', { class: 'ring-seg-empty', d: segmentPath(C, C, R.todayIn, R.todayOut, a0, a1) });
    const f = svg('path', { class: 'ring-seg-future', d: segmentPath(C, C, R.todayIn, R.todayOut, a0, a1), visibility: 'hidden' });
    usual.push(u);
    today.push(t);
    future.push(f);
    root.append(u, t, f);
  }

  // Hour ticks every 3 hours, labels every 6.
  for (let hr = 0; hr < 24; hr += 3) {
    const a = minuteToAngle(hr * 60);
    const p1 = polar(C, C, R.tickIn, a);
    const p2 = polar(C, C, R.tickOut, a);
    root.append(svg('line', { class: 'ring-tick', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }));
  }
  for (const [hr, text] of [[0, '12 AM'], [6, '6 AM'], [12, '12 PM'], [18, '6 PM']]) {
    const p = polar(C, C, R.label, minuteToAngle(hr * 60));
    root.append(svg('text', { class: 'ring-label', x: p.x, y: p.y }, text));
  }

  const doorLayer = svg('g', { 'aria-hidden': 'true' });
  const cursor = svg('path', { class: 'ring-cursor', d: '' });
  const hand = svg('line', { class: 'ring-now-hand', x1: C, y1: C, x2: C, y2: C - R.usualOut });
  const dot = svg('circle', { class: 'ring-now-dot', cx: C, cy: C - R.usualOut, r: 6 });
  const centerTime = svg('text', { class: 'ring-center-time', x: C, y: C + 4 }, '');
  const centerSub = svg('text', { class: 'ring-center-sub', x: C, y: C + 26 }, 'right now');
  root.append(doorLayer, cursor, hand, dot, centerTime, centerSub);

  const readout = h('div', { class: 'ring-readout', 'aria-live': 'polite' });
  const legend = h(
    'div',
    { class: 'ring-legend' },
    h('span', {}, h('i', { class: 'swatch swatch-usual' }), 'Usual day'),
    h('span', {}, h('i', { class: 'swatch swatch-today' }), 'Today so far'),
    h('span', {}, h('i', { class: 'swatch swatch-door' }), 'Visitor at the door'),
  );
  const element = h('div', { class: 'ring-card' }, h('div', { class: 'ring-wrap' }, root), legend, readout);

  let data = null;
  let selected = null; // user-chosen segment, or null to follow "now"
  let hoverActive = false;

  function activeSegment() {
    if (selected !== null) return selected;
    return data ? data.ring.nowBucket : 0;
  }

  function drawCursor() {
    if (!data) return;
    const i = activeSegment();
    cursor.setAttribute(
      'd',
      segmentPath(C, C, R.todayIn - 3, R.usualOut + 3, minuteToAngle(i * 30), minuteToAngle((i + 1) * 30), 0.004),
    );
  }

  function drawReadout() {
    if (!data) return;
    const i = activeSegment();
    const perDay = data.ring.usualPerDay?.[i] ?? 0;
    const count = data.ring.today[i] ?? 0;
    const isFuture = i > data.ring.nowBucket;
    const usuallyLine = data.level === 'learning' ? 'Still learning the usual day' : usuallyText(perDay);
    let todayLine;
    if (isFuture) todayLine = 'This part of the day has not happened yet.';
    else if (count === 0) todayLine = 'Today: no movement noticed.';
    else todayLine = `Today: ${count} movement${count === 1 ? '' : 's'} noticed.`;
    clear(readout).append(
      h('strong', {}, segmentLabel(i)),
      h('small', {}, `${usuallyLine}. ${todayLine}`),
    );
  }

  function draw() {
    if (!data) return;
    const { ring, level } = data;
    root.dataset.level = level;
    const peak = Math.max(1, ...ring.today);
    for (let i = 0; i < SEGMENTS; i += 1) {
      const u = ring.baseline[i] ?? 0;
      usual[i].setAttribute('opacity', u > 0 ? String(0.16 + 0.84 * u) : '0');

      const isFuture = i > ring.nowBucket;
      future[i].setAttribute('visibility', isFuture ? 'visible' : 'hidden');
      today[i].setAttribute('visibility', isFuture ? 'hidden' : 'visible');
      const count = ring.today[i] ?? 0;
      if (!isFuture && count > 0) {
        today[i].setAttribute('class', 'ring-seg-today');
        today[i].setAttribute('opacity', String(0.5 + 0.5 * Math.min(1, count / Math.min(peak, 3))));
      } else {
        today[i].setAttribute('class', 'ring-seg-empty');
        today[i].removeAttribute('opacity');
      }
    }

    const a = minuteToAngle(ring.nowMinute);
    const tip = polar(C, C, R.usualOut + 2, a);
    const base = polar(C, C, R.face + 6, a);
    hand.setAttribute('x1', base.x);
    hand.setAttribute('y1', base.y);
    hand.setAttribute('x2', tip.x);
    hand.setAttribute('y2', tip.y);
    dot.setAttribute('cx', tip.x);
    dot.setAttribute('cy', tip.y);
    centerTime.textContent = clockLabel(ring.nowMinute);
    centerSub.textContent = data.name ? `${data.name}'s day` : 'right now';

    clear(doorLayer);
    for (const d of data.doors ?? []) {
      const p = polar(C, C, R.door, minuteToAngle(d.minute));
      doorLayer.append(svg('circle', { class: 'ring-door', cx: p.x, cy: p.y, r: 4.5 }, svg('title', {}, `${d.text} at ${d.time}`)));
    }

    drawCursor();
    drawReadout();
  }

  function pointerSegment(ev) {
    const box = root.getBoundingClientRect();
    const scale = 440 / box.width;
    const dx = (ev.clientX - box.left) * scale - C;
    const dy = (ev.clientY - box.top) * scale - C;
    const minute = pointerToMinute(dx, dy, R.face - 20);
    return minute === null ? null : segmentOf(minute);
  }

  root.addEventListener('pointermove', (ev) => {
    const seg = pointerSegment(ev);
    if (seg === null) return;
    hoverActive = true;
    selected = seg;
    drawCursor();
    drawReadout();
  });
  root.addEventListener('pointerleave', () => {
    hoverActive = false;
    if (document.activeElement !== root) selected = null;
    drawCursor();
    drawReadout();
  });
  root.addEventListener('click', (ev) => {
    const seg = pointerSegment(ev);
    if (seg !== null) selected = seg;
    root.focus({ preventScroll: true });
    drawCursor();
    drawReadout();
  });
  root.addEventListener('keydown', (ev) => {
    if (!data) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key];
    if (step !== undefined) {
      selected = (activeSegment() + step + SEGMENTS) % SEGMENTS;
    } else if (ev.key === 'Home') {
      selected = 0;
    } else if (ev.key === 'End') {
      selected = SEGMENTS - 1;
    } else if (ev.key === 'Escape') {
      selected = null;
    } else {
      return;
    }
    ev.preventDefault();
    drawCursor();
    drawReadout();
  });
  root.addEventListener('blur', () => {
    if (!hoverActive) {
      selected = null;
      drawCursor();
      drawReadout();
    }
  });

  return {
    element,
    /** @param {{ ring: object, level: string, doors?: object[], name?: string }} next */
    update(next) {
      data = next;
      draw();
    },
  };
}
