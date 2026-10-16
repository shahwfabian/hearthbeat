import {
  MIN_MORNING_TOLERANCE,
  WAKE_FLOOR,
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
