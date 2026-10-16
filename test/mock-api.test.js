import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { DemoWorld } from '../server/sim/world.js';
import { createMockRingApi } from '../server/sim/mock-api.js';
import { CHIME, CHIME_SLOTS, DEMO_TOKEN, FRONT, KITCHEN } from '../server/sim/household.js';
import { ChimeUnavailableError, RingAuthError, RingClient } from '../server/ring/client.js';

const REAL = Date.UTC(2026, 9, 14, 15, 0, 0);
let world;
let server;
let client;
let played = [];

before(async () => {
  world = new DemoWorld({ tz: 'UTC', realNow: REAL });
  world.reset('usual', 12 * 60);
  server = createMockRingApi(world, { onPlayback: (e) => played.push(e) });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  client = new RingClient({ token: DEMO_TOKEN, baseUrl: `http://127.0.0.1:${port}`, sleep: async () => {} });
});

after(() => server.close());

test('rejects a missing or wrong token with 401', async () => {
  const { port } = server.address();
  const bad = new RingClient({ token: 'nope', baseUrl: `http://127.0.0.1:${port}`, sleep: async () => {} });
  await assert.rejects(bad.listDevices(), RingAuthError);
});

test('lists the four demo devices with status and capabilities', async () => {
  const devices = await client.listDevices();
  assert.equal(devices.length, 4);
  assert.ok(devices.every((d) => d.online === true));
  const chime = devices.find((d) => d.id === CHIME);
  assert.equal(chime.capabilities.audio.customizable_slots, 2);
  const cam = devices.find((d) => d.id === KITCHEN);
  assert.equal(cam.capabilities.audio, undefined);
});

test('getStatus reflects a device going offline', async () => {
  world.setOnline(KITCHEN, false);
  assert.equal((await client.getStatus(KITCHEN)).online, false);
  world.setOnline(KITCHEN, true);
  assert.equal((await client.getStatus(KITCHEN)).online, true);
});

test('event history pages through two weeks of events via links.next', async () => {
  const events = await client.getEventHistory(KITCHEN, { sinceMs: REAL - 15 * 86_400_000 });
  assert.ok(events.length > 60, `got ${events.length}`);
  for (let i = 1; i < events.length; i += 1) assert.ok(events[i].ts <= events[i - 1].ts);
  assert.equal(new Set(events.map((e) => e.id)).size, events.length, 'no duplicates across pages');
});

test('event history filters by composite event_types', async () => {
  world.trigger({ deviceId: FRONT, kind: 'doorbell' });
  const dings = await client.getEventHistory(FRONT, { eventTypes: 'ding' });
  assert.ok(dings.length >= 1 && dings.every((e) => e.kind === 'doorbell'));
});

test('playChime reads configuration, then plays the first enabled slot', async () => {
  played = [];
  const out = await client.playChime(CHIME);
  assert.equal(out.status, 'completed');
  assert.equal(out.audioRef, CHIME_SLOTS[0].audio_ref);
  assert.equal(played.length, 1);
});

test('playChime refuses a camera', async () => {
  await assert.rejects(
    client.playChime(KITCHEN),
    (e) => e instanceof ChimeUnavailableError && e.reason === 'not-a-chime',
  );
});

test('playChime refuses an offline chime', async () => {
  world.setOnline(CHIME, false);
  await assert.rejects(client.playChime(CHIME), (e) => e.reason === 'offline');
  world.setOnline(CHIME, true);
});

test('unknown devices and endpoints return JSON:API errors', async () => {
  await assert.rejects(client.getStatus('ava1.ring.device.NOPE'), (e) => e.status === 404);
  await assert.rejects(client.request('GET', '/v1/devices/x/media/streaming/whep/sessions'), (e) => e.status === 404);
});
