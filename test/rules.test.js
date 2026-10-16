import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBaseline } from '../server/core/baseline.js';
import { lateStartRule } from '../server/core/rules.js';
import { NOON, TZ, usualDays } from './helpers.js';

const baseline = buildBaseline(usualDays(10), { now: NOON, tz: TZ });
const at = (h, m = 0) => h * 60 + m;
const ev = (minute) => ({ ts: minute * 60_000, minute });

test('late-start: stays quiet while it is still within the usual morning window', () => {
  assert.equal(lateStartRule({ baseline, today: [], nowMinute: at(8, 0) }), null);
  assert.equal(lateStartRule({ baseline, today: [], nowMinute: at(8, 10) }), null);
});

test('late-start: says "quieter than usual" an hour past the usual wake-up', () => {
  const f = lateStartRule({ baseline, today: [], nowMinute: at(8, 30) });
  assert.equal(f.severity, 1);
  assert.equal(f.rule, 'late-start');
  assert.match(f.headline, /Quieter than usual/);
  assert.match(f.why, /usually around 7:\d\d AM/);
});

test('late-start: escalates to "worth a call" at twice the tolerance', () => {
  const f = lateStartRule({ baseline, today: [], nowMinute: at(10, 0) });
  assert.equal(f.severity, 2);
  assert.match(f.headline, /Worth a call/);
});

test('late-start: silent once any morning movement is seen', () => {
  assert.equal(lateStartRule({ baseline, today: [ev(at(7, 20))], nowMinute: at(11, 0) }), null);
});

test('late-start: night-time movement does not count as getting up', () => {
  const f = lateStartRule({ baseline, today: [ev(at(2, 0))], nowMinute: at(10, 0) });
  assert.equal(f.severity, 2);
});

test('late-start: needs a learned wake-up time', () => {
  const none = { ...baseline, firstActivity: null };
  assert.equal(lateStartRule({ baseline: none, today: [], nowMinute: at(11, 0) }), null);
});

test('late-start: does not fire in the small hours', () => {
  assert.equal(lateStartRule({ baseline, today: [], nowMinute: at(3, 0) }), null);
});
