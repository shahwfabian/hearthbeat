import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atMinute } from '../server/core/time.js';
import { NOON, TZ, usualDays } from './helpers.js';
import { IDS, evt, makeHub } from './hub-helpers.js';

test('ingest keeps new inside and doorway events and ignores repeats', () => {
  const { hub } = makeHub();
  assert.equal(hub.ingest(evt('a', IDS.kitchen, 'motion', 7 * 60)), true);
  assert.equal(hub.ingest(evt('a', IDS.kitchen, 'motion', 7 * 60)), false);
  assert.equal(hub.ingest(evt('b', IDS.door, 'doorbell', 8 * 60)), true);
  assert.equal(hub.inside.length, 1);
  assert.equal(hub.doorway.length, 1);
});

test('ingest ignores unknown devices and chimes', () => {
  const { hub } = makeHub();
  assert.equal(hub.ingest(evt('x', 'stranger', 'motion', 60)), false);
  assert.equal(hub.ingest(evt('y', IDS.chime, 'motion', 60)), false);
});

test('doorbell and human motion at the door announce a visitor; vehicles do not', () => {
  const { hub } = makeHub();
  const heard = [];
  hub.subscribe((m) => m.type === 'visitor' && heard.push(m));
  hub.ingest(evt('v1', IDS.door, 'doorbell', 9 * 60));
  hub.ingest(evt('v2', IDS.door, 'motion', 9 * 60 + 1, { subType: 'human' }));
  hub.ingest(evt('v3', IDS.door, 'motion', 9 * 60 + 2, { subType: 'vehicle' }));
  assert.equal(heard.length, 2);
  assert.equal(heard[0].doorbell, true);
  assert.equal(heard[0].text, 'Someone rang the doorbell');
});

test('offline and online events update device state', () => {
  const { hub } = makeHub();
  hub.ingest(evt('o1', IDS.kitchen, 'offline', 8 * 60));
  const d = hub.devices.get(IDS.kitchen);
  assert.equal(d.online, false);
  assert.equal(d.offlineSince, atMinute(NOON, 8 * 60, TZ));
  hub.ingest(evt('o2', IDS.kitchen, 'online', 8 * 60 + 5));
  assert.equal(d.online, true);
  assert.equal(d.offlineSince, null);
});

test('subscribers receive update messages and can unsubscribe', () => {
  const { hub } = makeHub();
  let n = 0;
  const off = hub.subscribe(() => (n += 1));
  hub.ingest(evt('u1', IDS.kitchen, 'motion', 100));
  off();
  hub.ingest(evt('u2', IDS.kitchen, 'motion', 101));
  assert.equal(n, 1);
});

function seedHistory(hub, days = 10) {
  for (const e of usualDays(days)) hub.ingest({ ...e, id: `h-${e.id}`, deviceId: IDS.kitchen });
}

test('status learns from ingested history and then judges the day', () => {
  const { hub } = makeHub({ now: atMinute(NOON, 9 * 60, TZ) });
  assert.equal(hub.status().level, 'learning');
  seedHistory(hub);
  assert.equal(hub.status().level, 'quiet', 'nothing yet today, 105 minutes after the usual time');
  hub.ingest(evt('m1', IDS.kitchen, 'motion', 8 * 60 + 40));
  assert.equal(hub.status().level, 'typical');
});

test('baseline is cached until inside events change', () => {
  const { hub } = makeHub();
  seedHistory(hub);
  const a = hub.baseline();
  assert.equal(hub.baseline(), a);
  hub.ingest(evt('m2', IDS.kitchen, 'motion', 8 * 60));
  assert.notEqual(hub.baseline(), a);
});

test('timeline is today only, newest first, in plain language', () => {
  const { hub } = makeHub({ now: atMinute(NOON, 12 * 60, TZ) });
  seedHistory(hub, 3);
  hub.ingest(evt('t1', IDS.kitchen, 'motion', 8 * 60));
  hub.ingest(evt('t2', IDS.door, 'doorbell', 10 * 60));
  const rows = hub.timeline();
  assert.deepEqual(rows.map((r) => r.text), ['Someone rang the doorbell', 'Movement in Kitchen camera']);
  assert.equal(rows[0].icon, 'bell');
  assert.equal(rows[0].time, '10:00 AM');
});
