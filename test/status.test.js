import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBaseline } from '../server/core/baseline.js';
import { evaluateDay } from '../server/core/status.js';
import { atMinute } from '../server/core/time.js';
import { NOON, TZ, ev, usualDays } from './helpers.js';

const history = usualDays(10);
const baseline = buildBaseline(history, { now: NOON, tz: TZ });
const devices = [
  { id: 'kitchen', name: 'the kitchen', role: 'inside', online: true },
  { id: 'door', name: 'Front door', role: 'doorway', online: true },
];
const at = (h, m = 0) => atMinute(NOON, h * 60 + m, TZ);

function run({ inside = [], doorway = [], now, devs = devices, base = baseline }) {
  return evaluateDay({
    insideEvents: [...history, ...inside],
    doorwayEvents: doorway,
    baseline: base,
    devices: devs,
    now,
    tz: TZ,
    personName: 'Margaret',
  });
}
const door = (h, m, extra) => ({
  id: `d${h}${m}`,
  ts: at(h, m),
  deviceId: 'door',
  kind: 'doorbell',
  source: 'webhook',
  ...extra,
});

test('learning: judges nothing until enough days are seen', () => {
  const thin = buildBaseline(usualDays(2), { now: NOON, tz: TZ });
  const s = run({ now: at(11), base: thin });
  assert.equal(s.level, 'learning');
  assert.match(s.detail, /2 of the 5 days/);
});

test('typical: on-pattern morning', () => {
  const inside = [ev(7 * 60 + 20), ev(8 * 60), ev(8 * 60 + 40)];
  const s = run({ inside, now: at(9, 0) });
  assert.equal(s.level, 'typical');
  assert.equal(s.headline, 'Looks like a usual day');
  assert.match(s.detail, /Movement in the kitchen at 8:40 AM/);
});

test('typical: early in the morning before the usual wake-up is not a problem', () => {
  const s = run({ now: at(6, 30) });
  assert.equal(s.level, 'typical');
  assert.match(s.detail, /early/);
});

test('quiet: an hour past the usual wake-up with no movement', () => {
  const s = run({ now: at(8, 45) });
  assert.equal(s.level, 'quiet');
  assert.equal(s.findings[0].rule, 'late-start');
});

test('checkin: two hours past the usual wake-up', () => {
  const s = run({ now: at(10, 0) });
  assert.equal(s.level, 'checkin');
  assert.match(s.headline, /Worth a call/);
});

test('a recent visitor eases "worth a call" to "quiet" and says why', () => {
  const s = run({ now: at(10, 0), doorway: [door(9, 40)] });
  assert.equal(s.level, 'quiet');
  assert.match(s.context, /came to the door at 9:40 AM/);
});

test('an old visitor does not ease anything', () => {
  const s = run({ now: at(10, 0), doorway: [door(7, 0)] });
  assert.equal(s.level, 'checkin');
  assert.equal(s.context, null);
});

test('blind: every inside device offline for a while means no judgement', () => {
  const dark = [{ ...devices[0], online: false, offlineSince: at(8, 0) }, devices[1]];
  const s = run({ now: at(11, 0), devs: dark });
  assert.equal(s.level, 'blind');
  assert.match(s.detail, /offline since 8:00 AM/);
});

test('blind: a brief outage is within the grace period', () => {
  const brief = [{ ...devices[0], online: false, offlineSince: at(10, 50) }, devices[1]];
  const s = run({ now: at(11, 0), devs: brief });
  assert.notEqual(s.level, 'blind');
});

test('ring data: 48 buckets of baseline and of today, plus the current slot', () => {
  const s = run({ inside: [ev(7 * 60 + 20), ev(7 * 60 + 25)], now: at(9, 0) });
  assert.equal(s.ring.baseline.length, 48);
  assert.equal(s.ring.today.length, 48);
  assert.equal(s.ring.today[14], 2);
  assert.equal(s.ring.nowBucket, 18);
  assert.equal(s.ring.usualPerDay.length, 48);
});

test('visitors: newest first, in plain language, today only', () => {
  const s = run({
    now: at(11),
    doorway: [door(9, 0), { ...door(10, 0), kind: 'motion', subType: 'package_delivery' }],
  });
  assert.deepEqual(s.visitors.map((v) => v.text), ['A package was delivered', 'Someone rang the doorbell']);
  assert.equal(s.visitors[0].icon, 'box');
  assert.equal(s.visitors[0].minute, 600);
});

test('events after "now" are ignored (the simulated clock may be behind the data)', () => {
  const s = run({ inside: [ev(15 * 60)], now: at(9, 0) });
  assert.equal(s.ring.today.reduce((a, b) => a + b, 0), 0);
});
