import { atMinute } from '../server/core/time.js';

export const TZ = 'UTC';

/** A fixed "now": Friday 16 October 2026, 12:00 UTC. */
export const NOON = Date.UTC(2026, 9, 16, 12, 0, 0);

let counter = 0;

/** Build an "inside" motion event at `minutes` after midnight, `daysAgo` days before NOON's day. */
export function ev(minutes, daysAgo = 0, extra = {}) {
  counter += 1;
  return {
    id: `t${counter}`,
    ts: atMinute(NOON - daysAgo * 86_400_000, minutes, TZ),
    deviceId: 'kitchen',
    kind: 'motion',
    source: 'history',
    ...extra,
  };
}

/**
 * A believable usual day: up around 7:15, something every ~40 minutes until 21:00,
 * plus a little jitter so no two days are identical.
 */
export function usualDay(daysAgo, jitter = 0) {
  const out = [];
  for (let m = 7 * 60 + 15 + jitter; m <= 21 * 60; m += 40) out.push(ev(m, daysAgo));
  return out;
}

/** `n` usual days, yesterday backwards. */
export function usualDays(n) {
  const out = [];
  for (let d = 1; d <= n; d += 1) out.push(...usualDay(d, (d % 3) * 5 - 5));
  return out;
}
