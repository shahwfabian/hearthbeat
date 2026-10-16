import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atMinute } from '../server/core/time.js';
import { NOON, TZ, usualDays } from './helpers.js';
import { HubError } from '../server/hub.js';
import { IDS, evt, fakeRing, makeHub } from './hub-helpers.js';

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
  assert.equal(rows[0].minute, 600);
});

test('pausing sharing drops new events and is logged by the person', () => {
  const { hub } = makeHub();
  hub.ingest(evt('p1', IDS.kitchen, 'motion', 7 * 60));
  hub.setSharing(false);
  assert.equal(hub.ingest(evt('p2', IDS.kitchen, 'motion', 7 * 60 + 5)), false);
  assert.equal(hub.dropped, 1);
  assert.equal(hub.inside.length, 1);
  hub.setSharing(true);
  assert.equal(hub.ingest(evt('p3', IDS.kitchen, 'motion', 7 * 60 + 10)), true);
  assert.deepEqual(hub.accessLog.map((e) => [e.who, e.action]), [
    ['Margaret', 'paused sharing'],
    ['Margaret', 'resumed sharing'],
  ]);
});

test('setSharing with the same value does nothing and logs nothing', () => {
  const { hub } = makeHub();
  hub.setSharing(true);
  assert.equal(hub.accessLog.length, 0);
});

test('forget erases stored events and logs it', () => {
  const { hub } = makeHub();
  hub.ingest(evt('f1', IDS.kitchen, 'motion', 7 * 60));
  hub.ingest(evt('f2', IDS.door, 'doorbell', 8 * 60));
  hub.forget();
  assert.equal(hub.inside.length + hub.doorway.length, 0);
  assert.equal(hub.accessLog.at(-1).action, 'deleted stored activity');
  assert.equal(hub.ingest(evt('f1', IDS.kitchen, 'motion', 7 * 60)), true, 'ids are forgotten too');
});

test('family views are logged at most once every five real minutes', () => {
  const { hub } = makeHub();
  let wall = 1_000_000;
  hub.wallNow = () => wall;
  assert.ok(hub.recordFamilyView());
  wall += 60_000;
  assert.equal(hub.recordFamilyView(), null);
  wall += 5 * 60_000;
  assert.ok(hub.recordFamilyView());
  assert.equal(hub.accessLog.length, 2);
  assert.equal(hub.accessLog[0].who, 'Dana');
});

test('nudge plays the chime, logs it, and tells the interface', async () => {
  const { hub, ring } = makeHub();
  const heard = [];
  hub.subscribe((m) => m.type === 'nudge' && heard.push(m));
  const out = await hub.nudge();
  assert.equal(out.ok, true);
  assert.equal(out.sound, 'Soft bell');
  assert.equal(ring.calls.chime, 1);
  assert.equal(hub.accessLog.at(-1).action, 'sent a gentle chime');
  assert.equal(heard.length, 1);
});

test('nudge respects a 10 minute cooldown', async () => {
  const { hub, ring } = makeHub();
  let wall = 5_000_000;
  hub.wallNow = () => wall;
  await hub.nudge();
  wall += 3 * 60_000;
  await assert.rejects(hub.nudge(), (e) => e instanceof HubError && e.code === 'too-soon' && e.retryInSeconds === 420);
  wall += 8 * 60_000;
  await hub.nudge();
  assert.equal(ring.calls.chime, 2);
});

test('nudge is refused while sharing is paused: their wish comes first', async () => {
  const { hub, ring } = makeHub();
  hub.setSharing(false);
  await assert.rejects(hub.nudge(), (e) => e.code === 'paused' && e.status === 403);
  assert.equal(ring.calls.chime, 0);
});

test('nudge explains a snoozed or offline chime in plain words', async () => {
  const err = (reason) => Object.assign(new Error('x'), { name: 'ChimeUnavailableError', reason });
  for (const [reason, pattern] of [['snoozed', /snoozed/], ['offline', /offline/]]) {
    const { hub } = makeHub({ ring: fakeRing({ playChime: async () => { throw err(reason); } }) });
    await assert.rejects(hub.nudge(), (e) => e.code === reason && pattern.test(e.message));
  }
});

test('nudge turns unexpected Ring failures into a calm message', async () => {
  const { hub } = makeHub({ ring: fakeRing({ playChime: async () => { throw new Error('boom'); } }) });
  await assert.rejects(hub.nudge(), (e) => e.code === 'ring-error' && e.status === 502);
});

test('loadHistory reads every role-bearing device and learns the baseline', async () => {
  const history = usualDays(8).map((e) => ({ ...e, id: `L-${e.id}`, deviceId: IDS.kitchen }));
  const asked = [];
  const ring = fakeRing({
    async getEventHistory(id, opts) {
      asked.push([id, opts.eventTypes]);
      return id === IDS.kitchen ? history : [];
    },
  });
  const { hub } = makeHub({ ring });
  const out = await hub.loadHistory();
  assert.equal(out.events, history.length);
  assert.deepEqual(asked, [[IDS.kitchen, 'motion'], [IDS.door, 'ding,motion']]);
  assert.equal(hub.baseline().ready, true);
});

test('loadHistory ignores devices without a role', async () => {
  const ring = fakeRing({
    async listDevices() {
      return [{ id: 'stranger', name: 'Neighbour cam', online: true }, { id: IDS.kitchen, name: 'Kitchen camera', online: true }];
    },
  });
  const { hub } = makeHub({ ring });
  await hub.loadHistory();
  assert.deepEqual([...hub.devices.keys()], [IDS.kitchen]);
});

test('poll picks up only new events and skips ones already seen', async () => {
  let batch = [{ id: 'n1', deviceId: IDS.kitchen, kind: 'motion', ts: atMinute(NOON, 500, TZ), source: 'history' }];
  const ring = fakeRing({ getEventHistory: async (id) => (id === IDS.kitchen ? batch : []) });
  const { hub } = makeHub({ ring });
  assert.equal(await hub.poll(), 1);
  assert.equal(await hub.poll(), 0, 'same event again is a duplicate');
  batch = [...batch, { id: 'n2', deviceId: IDS.kitchen, kind: 'motion', ts: atMinute(NOON, 520, TZ), source: 'history' }];
  assert.equal(await hub.poll(), 1);
});

test('reset returns the hub to a clean slate without logging', () => {
  const { hub } = makeHub();
  hub.ingest(evt('r1', IDS.kitchen, 'motion', 7 * 60));
  hub.setSharing(false);
  hub.reset();
  assert.equal(hub.inside.length, 0);
  assert.equal(hub.sharing, true);
  assert.equal(hub.accessLog.length, 0);
  assert.equal(hub.devices.size, 0);
});
