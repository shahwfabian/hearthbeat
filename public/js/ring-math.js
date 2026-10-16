/**
 * Geometry for the Rhythm Ring. Pure functions only (no DOM), so they are
 * unit-tested in Node and reused by the browser.
 *
 * The ring is a 24 hour clock: midnight at the top, time running clockwise.
 * It has 48 segments, one per 30 minutes.
 */

export const SEGMENTS = 48;
export const SEGMENT_MINUTES = 30;
const TAU = Math.PI * 2;

/** Angle in radians for a minute of the day, 0 at the top, clockwise. */
export function minuteToAngle(minute) {
  return (minute / 1440) * TAU;
}

/** Point on a circle. `angle` is measured clockwise from 12 o'clock. */
export function polar(cx, cy, r, angle) {
  return { x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) };
}

const f = (n) => Math.round(n * 100) / 100;

/**
 * SVG path for a ring segment (a thick arc) between two radii and two angles.
 * A small gap (in radians) is trimmed from each end so neighbours do not touch.
 */
export function segmentPath(cx, cy, inner, outer, a0, a1, gap = 0.008) {
  const s = a0 + gap;
  const e = a1 - gap;
  const p1 = polar(cx, cy, outer, s);
  const p2 = polar(cx, cy, outer, e);
  const p3 = polar(cx, cy, inner, e);
  const p4 = polar(cx, cy, inner, s);
  const large = e - s > Math.PI ? 1 : 0;
  return [
    `M${f(p1.x)} ${f(p1.y)}`,
    `A${outer} ${outer} 0 ${large} 1 ${f(p2.x)} ${f(p2.y)}`,
    `L${f(p3.x)} ${f(p3.y)}`,
    `A${inner} ${inner} 0 ${large} 0 ${f(p4.x)} ${f(p4.y)}`,
    'Z',
  ].join(' ');
}

/** Which segment contains this minute? */
export function segmentOf(minute) {
  return Math.min(SEGMENTS - 1, Math.max(0, Math.floor(minute / SEGMENT_MINUTES)));
}

/** 435 -> "7:15 AM" */
export function clockLabel(minute) {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm} ${h24 >= 12 ? 'PM' : 'AM'}`;
}

/** Segment 14 -> "7:00 to 7:30 AM" (keeps the suffix once when both ends share it). */
export function segmentLabel(index) {
  const start = clockLabel(index * SEGMENT_MINUTES);
  const end = clockLabel((index + 1) * SEGMENT_MINUTES);
  const sSuffix = start.slice(-2);
  const eSuffix = end.slice(-2);
  return sSuffix === eSuffix ? `${start.slice(0, -3)} to ${end}` : `${start} to ${end}`;
}

/**
 * Turn a pointer position (relative to the ring's centre) into a minute of the
 * day, or null when the pointer is too close to the centre to mean anything.
 */
export function pointerToMinute(dx, dy, deadZone = 20) {
  if (Math.hypot(dx, dy) < deadZone) return null;
  let angle = Math.atan2(dx, -dy); // 0 at the top, clockwise positive
  if (angle < 0) angle += TAU;
  return Math.min(1439, Math.floor((angle / TAU) * 1440));
}

/** Words for the average number of movements in a segment. */
export function usuallyText(perDay) {
  if (perDay < 0.15) return 'Usually quiet';
  if (perDay < 0.75) return 'Usually a little activity';
  if (perDay < 1.5) return 'Usually some activity';
  return 'Usually busy';
}
