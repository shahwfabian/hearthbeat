import {
  MIN_GAP_THRESHOLD,
  MIN_MORNING_TOLERANCE,
  NIGHT_END,
  NIGHT_START,
  WAKE_FLOOR,
  WAKING_END,
  WAKING_START,
} from './constants.js';
import { formatDuration, formatMinutes } from './time.js';

/**
 * Each rule looks at today so far, compares it with the learned baseline and
 * returns a Finding or null. Rules are deliberately small, deterministic and
 * explainable: every finding carries the plain-language reason and the exact
 * numbers behind it, so a family member (and the person being cared for) can
 * always see why Hearthbeat said what it said.
 *
 * Severity 1 = "quieter than usual", severity 2 = "worth a call".
 * Nothing here is a medical judgement.
 *
 * @typedef {Object} Finding
 * @property {string} rule
 * @property {1|2} severity
 * @property {string} headline
 * @property {string} why
 * @property {Record<string, number>} numbers
 *
 * @typedef {Object} RuleContext
 * @property {import('./baseline.js').Baseline} baseline
 * @property {{ts: number, minute: number}[]} today  inside events since local midnight, oldest first
 * @property {number} nowMinute  minutes since local midnight
 */

/** First movement of the day (after the night-time floor), or undefined. */
export function firstActivityToday(today) {
  return today.find((e) => e.minute >= WAKE_FLOOR);
}

/**
 * No movement yet, long after the usual wake-up time.
 * Tolerance is the larger of an hour or twice the person's own day-to-day wobble.
 * @param {RuleContext} ctx
 * @returns {Finding|null}
 */
export function lateStartRule({ baseline, today, nowMinute }) {
  const usual = baseline.firstActivity;
  if (!usual || nowMinute < WAKE_FLOOR) return null;
  if (firstActivityToday(today)) return null;

  const tolerance = Math.max(MIN_MORNING_TOLERANCE, 2 * usual.spread);
  const late = nowMinute - usual.median;
  if (late < tolerance) return null;

  const severity = late >= 2 * tolerance ? 2 : 1;
  return {
    rule: 'late-start',
    severity,
    headline: severity === 2 ? 'Worth a call: no activity yet today' : 'Quieter than usual this morning',
    why:
      `No movement yet today. The first movement is usually around ${formatMinutes(usual.median)} ` +
      `(give or take ${formatDuration(Math.max(usual.spread, 5))}). It is now ${formatMinutes(nowMinute)}, ` +
      `${formatDuration(late)} later than usual.`,
    numbers: {
      usualFirstMinute: Math.round(usual.median),
      toleranceMinutes: Math.round(tolerance),
      minutesLate: Math.round(late),
    },
  };
}

/**
 * A silence while awake that is clearly longer than this person's own longest
 * usual quiet spell. Measured only inside waking hours so the evening wind-down
 * and the night never look like a gap.
 * @param {RuleContext} ctx
 * @returns {Finding|null}
 */
export function longQuietRule({ baseline, today, nowMinute }) {
  if (!baseline.gap || nowMinute < WAKING_START) return null;
  if (!firstActivityToday(today)) return null; // the late-start rule owns this case
  const last = today[today.length - 1];

  const threshold = Math.max(MIN_GAP_THRESHOLD, baseline.gap.p90 * 1.25);
  const from = Math.max(last.minute, WAKING_START);
  const to = Math.min(nowMinute, WAKING_END);
  const gap = to - from;
  if (gap < threshold) return null;

  const severity = gap >= threshold * 1.6 ? 2 : 1;
  return {
    rule: 'long-quiet',
    severity,
    headline: severity === 2 ? 'Worth a call: quiet for a long stretch' : 'Quiet for a while',
    why:
      `Last movement was at ${formatMinutes(last.minute)}, ${formatDuration(gap)} ago. ` +
      `Their longest usual quiet spell while awake is about ${formatDuration(baseline.gap.p90)}.`,
    numbers: {
      lastMinute: Math.round(last.minute),
      quietMinutes: Math.round(gap),
      usualLongestMinutes: Math.round(baseline.gap.p90),
      thresholdMinutes: Math.round(threshold),
    },
  };
}

/**
 * Noticeably more night-time movement (01:00 to 04:00) than this person's norm.
 * Reported only until midday, then it is yesterday's news. It is a gentle note,
 * never an alarm: broken sleep has many ordinary causes.
 * @param {RuleContext} ctx
 * @returns {Finding|null}
 */
export function restlessNightRule({ baseline, today, nowMinute }) {
  if (nowMinute < NIGHT_END || nowMinute >= 12 * 60) return null;
  const count = today.filter((e) => e.minute >= NIGHT_START && e.minute < NIGHT_END).length;
  const threshold = baseline.night.mean + Math.max(3, 2 * baseline.night.std);
  if (count < 4 || count < threshold) return null;

  return {
    rule: 'restless-night',
    severity: 1,
    headline: 'A restless night',
    why:
      `${count} movements between ${formatMinutes(NIGHT_START)} and ${formatMinutes(NIGHT_END)}, ` +
      `compared with about ${Math.round(baseline.night.mean)} on a usual night.`,
    numbers: { nightMovements: count, usualNightMovements: Math.round(baseline.night.mean) },
  };
}
