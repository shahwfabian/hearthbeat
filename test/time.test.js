import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  minutesOfDay,
  dayKey,
  startOfDay,
  atMinute,
  formatMinutes,
  formatClock,
  formatDuration,
} from '../server/core/time.js';

// 2026-10-16T14:30:15.250Z
const TS = Date.UTC(2026, 9, 16, 14, 30, 15, 250);

test('minutesOfDay respects the time zone', () => {
  assert.equal(minutesOfDay(TS, 'UTC'), 14 * 60 + 30);
  // US Central is UTC-5 in mid October (CDT)
  assert.equal(minutesOfDay(TS, 'America/Chicago'), 9 * 60 + 30);
});

test('dayKey rolls over at local midnight, not UTC midnight', () => {
  const lateUtc = Date.UTC(2026, 9, 17, 2, 0, 0); // 9 pm on the 16th in Chicago
  assert.equal(dayKey(lateUtc, 'UTC'), '2026-10-17');
  assert.equal(dayKey(lateUtc, 'America/Chicago'), '2026-10-16');
});

test('startOfDay returns local midnight', () => {
  assert.equal(startOfDay(TS, 'UTC'), Date.UTC(2026, 9, 16, 0, 0, 0));
  assert.equal(startOfDay(TS, 'America/Chicago'), Date.UTC(2026, 9, 16, 5, 0, 0));
});

test('atMinute builds a timestamp on the same local day', () => {
  assert.equal(atMinute(TS, 7 * 60 + 15, 'UTC'), Date.UTC(2026, 9, 16, 7, 15, 0));
});

test('formatMinutes uses a 12 hour clock', () => {
  assert.equal(formatMinutes(0), '12:00 AM');
  assert.equal(formatMinutes(435), '7:15 AM');
  assert.equal(formatMinutes(720), '12:00 PM');
  assert.equal(formatMinutes(13 * 60 + 5), '1:05 PM');
  assert.equal(formatMinutes(1439), '11:59 PM');
});

test('formatClock formats an instant in the household zone', () => {
  assert.equal(formatClock(TS, 'America/Chicago'), '9:30 AM');
});

test('formatDuration is short and human', () => {
  assert.equal(formatDuration(40), '40 min');
  assert.equal(formatDuration(60), '1 h');
  assert.equal(formatDuration(95), '1 h 35 min');
});
