import { makeRng, seedFrom } from './rng.js';
import { FRONT, KITCHEN, LIVING } from './household.js';

/**
 * Scenario catalogue for the interactive demo. Each scenario produces one
 * day's worth of planned events as `{ minute, deviceId, kind, subType? }`,
 * where `minute` is minutes since local midnight.
 */
export const SCENARIOS = Object.freeze([
  {
    id: 'usual',
    label: 'A usual day',
    blurb: 'Margaret follows her normal routine. Nothing to see, which is the point.',
    moment: 12 * 60 + 30,
  },
  {
    id: 'slow-morning',
    label: 'A slow morning',
    blurb: 'No movement until almost 11 am. Watch the message soften, then escalate.',
    moment: 10 * 60 + 30,
  },
  {
    id: 'dana-visit',
    label: 'Dana visits',
    blurb: 'A quiet morning ends when the doorbell rings. Hearthbeat notices and eases off.',
    moment: 9 * 60 + 50,
  },
  {
    id: 'quiet-afternoon',
    label: 'A quiet afternoon',
    blurb: 'A normal morning, then four hours of silence after lunch.',
    moment: 16 * 60 + 30,
  },
  {
    id: 'restless-night',
    label: 'A restless night',
    blurb: 'Lots of movement between 1 and 4 am, then a late start.',
    moment: 8 * 60 + 30,
  },
]);

export function scenarioById(id) {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

const MEAL_WINDOWS = [
  [7 * 60 + 30, 8 * 60 + 30],
  [11 * 60 + 45, 12 * 60 + 45],
  [17 * 60 + 30, 18 * 60 + 30],
];

const inMeal = (m) => MEAL_WINDOWS.some(([a, b]) => m >= a && m <= b);

/** A normal day for Margaret. */
function usualPlan(rng) {
  const events = [];
  const wake = 7 * 60 + 15 + rng.int(-10, 10);
  // On roughly one day in seven she is a little slower to get going.
  const lazy = rng.chance(0.14) ? rng.int(20, 45) : 0;

  let m = wake + lazy;
  while (m <= 21 * 60) {
    const deviceId = inMeal(m) || rng.chance(0.3) ? KITCHEN : LIVING;
    events.push({ minute: m, deviceId, kind: 'motion' });
    m += rng.int(22, 46);
  }

  if (rng.chance(0.4)) {
    events.push({ minute: 2 * 60 + rng.int(-40, 40), deviceId: LIVING, kind: 'motion' });
  }

  if (rng.chance(0.55)) {
    events.push({
      minute: rng.int(10 * 60, 15 * 60),
      deviceId: FRONT,
      kind: 'motion',
      subType: 'package_delivery',
    });
  }
  if (rng.chance(0.3)) {
    const t = rng.int(14 * 60, 16 * 60);
    events.push({ minute: t - 1, deviceId: FRONT, kind: 'motion', subType: 'human' });
    events.push({ minute: t, deviceId: FRONT, kind: 'doorbell' });
  }
  if (rng.chance(0.25)) {
    events.push({ minute: rng.int(8 * 60, 18 * 60), deviceId: FRONT, kind: 'motion', subType: 'vehicle' });
  }
  return events;
}

const isInside = (e) => e.deviceId === KITCHEN || e.deviceId === LIVING;

/**
 * Build the planned events for one day.
 * @param {string} scenarioId
 * @param {string} dayKey  `YYYY-MM-DD`, used to seed the randomness
 */
export function planDay(scenarioId, dayKey) {
  const rng = makeRng(seedFrom(`${dayKey}:${scenarioId}`));
  let events = usualPlan(rng);

  switch (scenarioId) {
    case 'slow-morning':
      events = events.filter((e) => !isInside(e) || e.minute >= 10 * 60 + 40);
      events.push({ minute: 10 * 60 + 40, deviceId: KITCHEN, kind: 'motion' });
      break;
    case 'dana-visit':
      events = events.filter((e) => !isInside(e) || e.minute >= 10 * 60);
      events.push(
        { minute: 9 * 60 + 54, deviceId: FRONT, kind: 'motion', subType: 'human' },
        { minute: 9 * 60 + 55, deviceId: FRONT, kind: 'doorbell' },
        { minute: 10 * 60, deviceId: LIVING, kind: 'motion' },
      );
      break;
    case 'quiet-afternoon':
      // Silence inside, and no visitor either: a visit would (rightly) soften the message.
      events = events.filter((e) => {
        const quietHours = e.minute >= 13 * 60 + 10 && e.minute <= 17 * 60 + 5;
        const visitor = e.kind === 'doorbell' || e.subType === 'human';
        return !(quietHours && (isInside(e) || visitor));
      });
      break;
    case 'restless-night':
      events = events.filter((e) => !isInside(e) || e.minute >= 8 * 60 + 5);
      for (const minute of [75, 98, 131, 160, 189, 214]) {
        events.push({ minute, deviceId: LIVING, kind: 'motion' });
      }
      events.push({ minute: 8 * 60 + 5, deviceId: KITCHEN, kind: 'motion' });
      break;
    default:
      break;
  }

  return events.sort((a, b) => a.minute - b.minute || a.deviceId.localeCompare(b.deviceId));
}
