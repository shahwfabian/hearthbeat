import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DemoWorld } from '../server/sim/world.js';
import { FRONT, KITCHEN, LIVING, CHIME, CHIME_SLOTS } from '../server/sim/household.js';
import { buildBaseline } from '../server/core/baseline.js';

// Wed 14 Oct 2026, 15:00 UTC; with tz=UTC "today" starts at 00:00 UTC
const REAL = Date.UTC(2026, 9, 14, 15, 0, 0);
const mk = (scenario = 'usual', startMinute = 6 * 60 + 30) => {
  const w = new DemoWorld({ tz: 'UTC', realNow: REAL, startMinute });
  w.reset(scenario, startMinute);
  return w;
};

test('starts at the requested minute of today', () => {
  const w = mk();
  assert.equal(w.simNow, Date.UTC(2026, 9, 14, 6, 30, 0));
});

test('history holds fourteen days of past activity, and nothing from the future', () => {
  const w = mk();
  const rows = w.historyFor(KITCHEN, { limit: 5000 }).rows;
  assert.ok(rows.length > 50);
  assert.ok(rows.every((e) => e.ts <= w.simNow));
  assert.ok(rows.some((e) => e.ts < Date.UTC(2026, 9, 1)));
});

test('history is newest-first and paginates with a before cursor', () => {
  const w = mk();
  const first = w.historyFor(KITCHEN, { limit: 10 });
  assert.equal(first.rows.length, 10);
  assert.equal(first.more, true);
  for (let i = 1; i < 10; i += 1) assert.ok(first.rows[i].ts <= first.rows[i - 1].ts);
  const second = w.historyFor(KITCHEN, { limit: 10, before: first.rows[9].ts });
  assert.ok(second.rows[0].ts < first.rows[9].ts);
});

test('advance emits planned events in time order and updates the clock', () => {
  const w = mk();
  const out = w.advance(3 * 3_600_000); // 06:30 -> 09:30
  assert.ok(out.length >= 2);
  for (let i = 1; i < out.length; i += 1) assert.ok(out[i].ts >= out[i - 1].ts);
  assert.equal(w.simNow, Date.UTC(2026, 9, 14, 9, 30, 0));
  assert.ok(out.every((e) => e.ts <= w.simNow));
});

test('advanceToMinute never goes backwards and stops before midnight', () => {
  const w = mk();
  w.advanceToMinute(12 * 60);
  const noon = w.simNow;
  assert.deepEqual(w.advanceToMinute(9 * 60), []);
  assert.equal(w.simNow, noon);
  w.advanceToMinute(30 * 60);
  assert.equal(w.simNow, Date.UTC(2026, 9, 14, 23, 59, 0));
});

test('trigger records an event now and it shows up in history', () => {
  const w = mk();
  const ev = w.trigger({ deviceId: FRONT, kind: 'doorbell' });
  assert.equal(ev.ts, w.simNow);
  assert.match(ev.id, /_button_press_/);
  const ding = w.historyFor(FRONT, { eventTypes: 'ding' }).rows;
  assert.equal(ding[0].id, ev.id);
});

test('event_types filtering supports Ring composite syntax', () => {
  const w = mk();
  w.trigger({ deviceId: FRONT, kind: 'motion', subType: 'human' });
  w.trigger({ deviceId: FRONT, kind: 'motion', subType: 'vehicle' });
  const human = w.historyFor(FRONT, { eventTypes: 'motion.human' }).rows;
  assert.ok(human.length >= 1 && human.every((e) => e.subType === 'human'));
  const any = w.historyFor(FRONT, { eventTypes: 'motion' }).rows;
  assert.ok(any.length > human.length);
});

test('an offline device records nothing, and lifecycle events are returned', () => {
  const w = mk();
  const off = w.setOnline(KITCHEN, false);
  assert.equal(off.kind, 'offline');
  assert.equal(w.setOnline(KITCHEN, false), null, 'no change, no event');
  assert.equal(w.trigger({ deviceId: KITCHEN, kind: 'motion' }), null);
  assert.equal(w.setOnline(KITCHEN, true).kind, 'online');
});

test('slow-morning scenario really is quiet until late morning', () => {
  const w = mk('slow-morning');
  const out = w.advanceToMinute(10 * 60 + 30).filter((e) => e.deviceId === KITCHEN || e.deviceId === LIVING);
  assert.equal(out.filter((e) => e.ts >= Date.UTC(2026, 9, 14, 4, 0)).length, 0);
});

test('baseline learned from the simulated history is ready and sensible', () => {
  const w = mk();
  const inside = [...w.history.get(KITCHEN), ...w.history.get(LIVING)].map((e) => ({ ...e, source: 'history' }));
  const b = buildBaseline(inside, { now: w.simNow, tz: 'UTC' });
  assert.equal(b.ready, true);
  assert.ok(b.firstActivity.median > 6.5 * 60 && b.firstActivity.median < 8.5 * 60);
});

test('chime playback is recorded only for known audio refs', () => {
  const w = mk();
  assert.ok(w.playAudio(CHIME, CHIME_SLOTS[0].audio_ref));
  assert.equal(w.playAudio(CHIME, 'bogus'), null);
  assert.equal(w.chimeLog.length, 1);
});
