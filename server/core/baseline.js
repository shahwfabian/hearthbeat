import {
  BASELINE_DAYS,
  BUCKETS_PER_DAY,
  BUCKET_MINUTES,
  MIN_BASELINE_DAYS,
  MIN_EVENTS_PER_DAY,
  NIGHT_END,
  NIGHT_START,
  WAKE_FLOOR,
  WAKING_END,
  WAKING_START,
} from './constants.js';
import { dayKey, minutesOfDay, startOfDay } from './time.js';
import { mad, mean, median, percentile, stddev } from './stats.js';

/**
 * @typedef {Object} Baseline
 * @property {boolean} ready            enough days observed to judge a day
 * @property {number} daysObserved
 * @property {number} minDays
 * @property {number[]} profile         mean events per day in each 30 minute bucket
 * @property {number[]} intensity       profile scaled 0 to 1 (for drawing)
 * @property {{median: number, spread: number}|null} firstActivity  minutes since midnight
 * @property {{p90: number}|null} gap   longest quiet spell while awake, minutes
 * @property {{mean: number, std: number}} night  events per night between 01:00 and 04:00
 */

/** Which 30 minute slot of the day does this minute fall in? */
export function bucketOf(minutes) {
  return Math.min(BUCKETS_PER_DAY - 1, Math.floor(minutes / BUCKET_MINUTES));
}

/**
 * Learn a person's usual day from past "inside" activity events.
 * Only complete days before today are used, so a strange morning can never
 * teach the engine that strange is normal.
 *
 * @param {import('./events.js').HomeEvent[]} insideEvents
 * @param {{ now: number, tz: string, days?: number }} opts
 * @returns {Baseline}
 */
export function buildBaseline(insideEvents, { now, tz, days = BASELINE_DAYS }) {
  const todayStart = startOfDay(now, tz);
  const earliest = todayStart - days * 86_400_000;

  /** @type {Map<string, number[]>} */
  const byDay = new Map();
  for (const ev of insideEvents) {
    if (ev.ts >= todayStart || ev.ts < earliest) continue;
    const key = dayKey(ev.ts, tz);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(minutesOfDay(ev.ts, tz));
  }

  const dayMinutes = [...byDay.values()]
    .filter((mins) => mins.length >= MIN_EVENTS_PER_DAY)
    .map((mins) => mins.sort((a, b) => a - b));
  const daysObserved = dayMinutes.length;

  const profile = new Array(BUCKETS_PER_DAY).fill(0);
  for (const mins of dayMinutes) for (const m of mins) profile[bucketOf(m)] += 1;
  if (daysObserved) for (let i = 0; i < profile.length; i += 1) profile[i] /= daysObserved;
  const peak = Math.max(...profile, 0);
  const intensity = profile.map((v) => (peak > 0 ? v / peak : 0));

  const firsts = dayMinutes.map((mins) => mins.find((m) => m >= WAKE_FLOOR)).filter((m) => m !== undefined);
  const firstActivity = firsts.length ? { median: median(firsts), spread: mad(firsts) } : null;

  const longestGaps = [];
  for (const mins of dayMinutes) {
    const awake = mins.filter((m) => m >= WAKING_START && m <= WAKING_END);
    let longest = 0;
    for (let i = 1; i < awake.length; i += 1) longest = Math.max(longest, awake[i] - awake[i - 1]);
    if (awake.length >= 2) longestGaps.push(longest);
  }
  const gap = longestGaps.length ? { p90: percentile(longestGaps, 0.9) } : null;

  const nightCounts = dayMinutes.map((mins) => mins.filter((m) => m >= NIGHT_START && m < NIGHT_END).length);

  return {
    ready: daysObserved >= MIN_BASELINE_DAYS,
    daysObserved,
    minDays: MIN_BASELINE_DAYS,
    profile,
    intensity,
    firstActivity,
    gap,
    night: { mean: mean(nightCounts), std: stddev(nightCounts) },
  };
}
