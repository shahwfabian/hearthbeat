import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DemoWorld } from '../server/sim/world.js';
import { createMockHandler } from '../server/sim/mock-handler.js';
import { memoryFetch } from '../server/sim/memory-fetch.js';
import { CHIME, DEMO_TOKEN, FRONT, KITCHEN } from '../server/sim/household.js';
import { RingAuthError, RingClient } from '../server/ring/client.js';

const REAL = Date.UTC(2026, 9, 14, 15, 0, 0);

function setup() {
  const world = new DemoWorld({ tz: 'UTC', realNow: REAL });
  world.reset('usual', 12 * 60);
  const played = [];
  const handle = createMockHandler(world, { onPlayback: (e) => played.push(e) });
  const client = new RingClient({ token: DEMO_TOKEN, baseUrl: 'http://mock.ring.local', fetchImpl: memoryFetch(handle), sleep: async () => {} });
  return { world, client, played };
}

test('the real RingClient works end to end over the in-memory transport', async () => {
  const { client, world } = setup();
  const devices = await client.listDevices();
  assert.equal(devices.length, 4);
  assert.equal(devices.find((d) => d.id === CHIME).capabilities.audio.customizable_slots, 2);
  const events = await client.getEventHistory(KITCHEN, { sinceMs: REAL - 15 * 86_400_000 });
  assert.ok(events.length > 60);
  assert.equal(new Set(events.map((e) => e.id)).size, events.length, 'paging works without a network');
  world.trigger({ deviceId: FRONT, kind: 'doorbell' });
  assert.ok((await client.getEventHistory(FRONT, { eventTypes: 'ding' })).length >= 1);
});

test('chime playback works in memory and is observed', async () => {
  const { client, played } = setup();
  const out = await client.playChime(CHIME);
  assert.equal(out.status, 'completed');
  assert.equal(played.length, 1);
});

test('the in-memory API still rejects a wrong token with 401', async () => {
  const { world } = setup();
  const handle = createMockHandler(world);
  const bad = new RingClient({ token: 'nope', baseUrl: 'http://mock.ring.local', fetchImpl: memoryFetch(handle), sleep: async () => {} });
  await assert.rejects(bad.listDevices(), RingAuthError);
});
