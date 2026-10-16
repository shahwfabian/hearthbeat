import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBaseline, bucketOf } from '../server/core/baseline.js';
import { NOON, TZ, ev, usualDays, usualDay } from './helpers.js';

test('bucketOf maps minutes to 30 minute slots', () => {
  assert.equal(bucketOf(0), 0);
  assert.equal(bucketOf(29), 0);
  assert.equal(bucketOf(30), 1);
  assert.equal(bucketOf(7 * 60 + 15), 14);
  assert.equal(bucketOf(1439), 47);
});

test('baseline is not ready with too few days', () => {
  const b = buildBaseline(usualDays(3), { now: NOON, tz: TZ });
  assert.equal(b.ready, false);
  assert.equal(b.daysObserved, 3);
});

test('baseline learns first activity near 7:15 from 10 usual days', () => {
  const b = buildBaseline(usualDays(10), { now: NOON, tz: TZ });
  assert.equal(b.ready, true);
  assert.equal(b.daysObserved, 10);
  assert.ok(Math.abs(b.firstActivity.median - (7 * 60 + 15)) <= 10, `median ${b.firstActivity.median}`);
  assert.ok(b.firstActivity.spread <= 10);
});

test('baseline learns the longest waking quiet spell', () => {
  const b = buildBaseline(usualDays(10), { now: NOON, tz: TZ });
  assert.equal(b.gap.p90, 40);
});

test("today's events never teach the baseline", () => {
  const withToday = [...usualDays(8), ev(5 * 60, 0), ev(5 * 60 + 5, 0), ev(5 * 60 + 10, 0)];
  const b = buildBaseline(withToday, { now: NOON, tz: TZ });
  assert.equal(b.daysObserved, 8);
});

test('days older than the window are ignored', () => {
  const old = usualDay(40);
  const b = buildBaseline([...usualDays(6), ...old], { now: NOON, tz: TZ, days: 14 });
  assert.equal(b.daysObserved, 6);
});

test('sparse days (fewer than 3 events) do not count as a day', () => {
  const sparse = [ev(8 * 60, 2), ev(9 * 60, 2)];
  const b = buildBaseline([...usualDays(5), ...sparse], { now: NOON, tz: TZ });
  assert.equal(b.daysObserved, 5);
});

test('intensity is scaled to 0..1 and profile has 48 buckets', () => {
  const b = buildBaseline(usualDays(10), { now: NOON, tz: TZ });
  assert.equal(b.profile.length, 48);
  assert.equal(Math.max(...b.intensity), 1);
  assert.ok(b.intensity.every((v) => v >= 0 && v <= 1));
  assert.equal(b.intensity[2], 0, 'nothing at 1 am on a usual day');
});

test('night-time movement is measured separately from waking activity', () => {
  const nights = [];
  for (let d = 1; d <= 6; d += 1) nights.push(...usualDay(d), ev(2 * 60, d));
  const b = buildBaseline(nights, { now: NOON, tz: TZ });
  assert.equal(b.night.mean, 1);
  assert.equal(b.night.std, 0);
});
