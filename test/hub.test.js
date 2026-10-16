import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atMinute } from '../server/core/time.js';
import { NOON, TZ } from './helpers.js';
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
