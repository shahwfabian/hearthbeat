import {
  BUCKETS_PER_DAY,
  OFFLINE_GRACE_MINUTES,
  VISIT_CONTEXT_MINUTES,
} from './constants.js';
import { bucketOf } from './baseline.js';
import { describeDoorway, describeInside, iconFor } from './describe.js';
import { KINDS } from './events.js';
import { lateStartRule, longQuietRule, restlessNightRule } from './rules.js';
import { formatClock, formatMinutes, minutesOfDay, startOfDay } from './time.js';

/**
 * The single answer the interface shows: "does today look like a usual day?"
 *
 * Levels, from calm to least calm:
 *   learning  not enough history yet to judge anything
 *   blind     every inside device is offline, so silence means nothing
 *   typical   today looks like a usual day
 *   quiet     quieter than usual (a gentle heads-up)
 *   checkin   worth a call (still not an emergency claim)
 *
 * @typedef {{id: string, name: string, role: 'inside'|'doorway', online: boolean|null, offlineSince?: number|null}} DeviceState
 */

const HEADLINES = {
  typical: 'Looks like a usual day',
  learning: 'Still learning their usual day',
  blind: "Hearthbeat can't see right now",
};

/**
 * @param {{
 *   insideEvents: import('./events.js').HomeEvent[],
 *   doorwayEvents: import('./events.js').HomeEvent[],
 *   baseline: import('./baseline.js').Baseline,
 *   devices: DeviceState[],
 *   now: number,
 *   tz: string,
 *   personName: string,
 * }} input
 */
export function evaluateDay({ insideEvents, doorwayEvents, baseline, devices, now, tz, personName }) {
  const dayStart = startOfDay(now, tz);
  const nowMinute = minutesOfDay(now, tz);
  const nameOf = new Map(devices.map((d) => [d.id, d.name]));

  const todayInside = insideEvents
    .filter((e) => e.kind === KINDS.MOTION && e.ts >= dayStart && e.ts <= now)
    .sort((a, b) => a.ts - b.ts)
    .map((e) => ({ ...e, minute: minutesOfDay(e.ts, tz) }));

  const todayDoorway = doorwayEvents
    .filter((e) => e.ts >= dayStart && e.ts <= now)
    .sort((a, b) => a.ts - b.ts);

  const counts = new Array(BUCKETS_PER_DAY).fill(0);
  for (const e of todayInside) counts[bucketOf(e.minute)] += 1;

  const last = todayInside[todayInside.length - 1] ?? null;
  const visitors = todayDoorway
    .slice(-8)
    .reverse()
    .map((e) => ({
      id: e.id,
      ts: e.ts,
      time: formatClock(e.ts, tz),
      minute: minutesOfDay(e.ts, tz),
      text: describeDoorway(e),
      icon: iconFor(e, 'doorway'),
      kind: e.kind,
    }));

  const base = {
    personName,
    now,
    nowLabel: formatMinutes(nowMinute),
    lastActivity: last
      ? {
          ts: last.ts,
          time: formatClock(last.ts, tz),
          text: describeInside(last, nameOf.get(last.deviceId) ?? 'the house'),
        }
      : null,
    ring: {
      baseline: baseline.intensity,
      usualPerDay: baseline.profile.map((v) => Math.round(v * 100) / 100),
      today: counts,
      nowMinute,
      nowBucket: bucketOf(nowMinute),
    },
    visitors,
    learning: { daysObserved: baseline.daysObserved, minDays: baseline.minDays },
    findings: [],
    context: null,
  };

  if (!baseline.ready) {
    return {
      ...base,
      level: 'learning',
      headline: HEADLINES.learning,
      detail:
        `Hearthbeat has seen ${baseline.daysObserved} of the ${baseline.minDays} days it needs ` +
        `before it can say whether a day looks usual. Nothing is flagged until then.`,
    };
  }

  const insideDevices = devices.filter((d) => d.role === 'inside');
  const graceMs = OFFLINE_GRACE_MINUTES * 60_000;
  const allDark =
    insideDevices.length > 0 &&
    insideDevices.every((d) => d.online === false && d.offlineSince && now - d.offlineSince > graceMs);
  if (allDark) {
    const since = Math.min(...insideDevices.map((d) => d.offlineSince));
    return {
      ...base,
      level: 'blind',
      headline: HEADLINES.blind,
      detail:
        `The home sensors have been offline since ${formatClock(since, tz)}. ` +
        `That says nothing about how ${personName}'s day is going, so no judgement is made.`,
    };
  }

  const ctx = { baseline, today: todayInside, nowMinute };
  const findings = [lateStartRule(ctx), longQuietRule(ctx), restlessNightRule(ctx)]
    .filter(Boolean)
    .sort((a, b) => b.severity - a.severity);

  if (findings.length === 0) {
    return {
      ...base,
      level: 'typical',
      headline: HEADLINES.typical,
      detail: last
        ? `${base.lastActivity.text} at ${base.lastActivity.time}. The day is following ${personName}'s usual rhythm.`
        : `Nothing out of the ordinary so far. It is early, and ${personName}'s usual first movement is later.`,
    };
  }

  const top = findings[0];
  let severity = top.severity;
  let context = null;

  const recentVisit = [...todayDoorway]
    .reverse()
    .find(
      (e) =>
        (e.kind === KINDS.DOORBELL || (e.kind === KINDS.MOTION && e.subType === 'human')) &&
        now - e.ts <= VISIT_CONTEXT_MINUTES * 60_000,
    );
  if (recentVisit && severity === 2) {
    severity = 1;
    context = `Someone came to the door at ${formatClock(recentVisit.ts, tz)}, which may explain a quiet spell. Hearthbeat has eased its message.`;
  }

  return {
    ...base,
    level: severity === 2 ? 'checkin' : 'quiet',
    headline: severity === top.severity ? top.headline : 'Quiet for a while',
    detail: top.why,
    findings,
    context,
  };
}
