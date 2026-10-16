import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/http.js';
import { DemoRuntime } from '../server/demo.js';
import { DEMO_HMAC_KEY } from '../server/sim/household.js';
import { signBody } from '../server/ring/signing.js';
import { buildWebhookDocument } from '../server/sim/emitter.js';

let server;
let demo;
let base;
let publicDir;

const get = (path) => fetch(base + path);
const post = (path, body = {}) =>
  fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const state = async (as = 'family') => (await get(`/api/state?as=${as}`)).json();

before(async () => {
  publicDir = await mkdtemp(join(tmpdir(), 'hb-public-'));
  await writeFile(join(publicDir, 'index.html'), '<h1>hello</h1>');
  server = createApp({ hmacKey: DEMO_HMAC_KEY, publicDir });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  base = `http://127.0.0.1:${port}`;
  demo = new DemoRuntime({ tz: 'UTC', webhookUrl: () => `${base}/webhooks/ring` });
  await demo.start();
  server.attach(demo.hub, demo);
});

after(async () => {
  demo.stop();
  server.closeAllConnections?.();
  server.close();
  await rm(publicDir, { recursive: true, force: true });
});

test('serves static files with a strict content security policy', async () => {
  const res = await get('/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
  assert.doesNotMatch(res.headers.get('content-security-policy'), /unsafe-inline/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await res.text(), '<h1>hello</h1>');
});

test('refuses path traversal and unknown files', async () => {
  assert.equal((await get('/missing.css')).status, 404);
  const res = await fetch(`${base}/..%2f..%2fpackage.json`);
  assert.ok([403, 404].includes(res.status));
});

test('state starts calm: the demo has learned two weeks of history', async () => {
  const s = await state();
  assert.equal(s.mode, 'demo');
  assert.equal(s.status.level, 'typical');
  assert.equal(s.demo.simulated, true);
  assert.equal(s.devices.length, 4);
  assert.ok(s.status.learning.daysObserved >= 5);
  assert.ok(s.privacy.never.some((t) => /video/i.test(t)));
});

test('webhook with a bad signature is rejected; a good one is accepted', async () => {
  const doc = buildWebhookDocument({
    id: 'x1',
    ts: demo.world.simNow,
    deviceId: 'ava1.ring.device.DEMOKITCHEN',
    kind: 'motion',
  });
  const raw = JSON.stringify(doc);
  const bad = await fetch(`${base}/webhooks/ring`, { method: 'POST', body: raw, headers: { 'X-Signature': 'sha256=00' } });
  assert.equal(bad.status, 401);
  const good = await fetch(`${base}/webhooks/ring`, {
    method: 'POST',
    body: raw,
    headers: { 'X-Signature': signBody(DEMO_HMAC_KEY, raw) },
  });
  assert.equal(good.status, 200);
  assert.equal((await good.json()).status, 'processed');
});

test('a slow morning escalates from learning to "worth a call"', async () => {
  assert.equal((await post('/api/demo/scenario', { id: 'slow-morning' })).status, 200);
  assert.equal((await post('/api/demo/jump', { minute: 8 * 60 + 45 })).status, 200);
  assert.equal((await state()).status.level, 'quiet');
  await post('/api/demo/jump', { minute: 10 * 60 });
  const s = await state();
  assert.equal(s.status.level, 'checkin');
  assert.match(s.status.detail, /usually around/);
});

test('playing the day moves the simulated clock at the chosen speed', async () => {
  await post('/api/demo/scenario', { id: 'usual' });
  await post('/api/demo/rate', { rate: 60 }); // 60 simulated minutes per real second
  const start = (await state()).demo.minute;
  await post('/api/demo/play', { running: true });
  await new Promise((r) => setTimeout(r, 900));
  await post('/api/demo/play', { running: false });
  const after = await state();
  assert.equal(after.demo.running, false);
  const moved = after.demo.minute - start;
  assert.ok(moved >= 30 && moved <= 120, `clock moved ${moved} simulated minutes in about 0.9 s`);
  await post('/api/demo/rate', { rate: 6 });
});

test('triggering a doorbell press shows up in visitors and the timeline', async () => {
  await post('/api/demo/trigger', { id: 'doorbell' });
  const s = await state();
  assert.equal(s.status.visitors[0].text, 'Someone rang the doorbell');
  assert.equal(s.timeline[0].icon, 'bell');
});

test('nudge sends a chime once, then asks for patience', async () => {
  const first = await post('/api/nudge');
  assert.equal(first.status, 200);
  assert.equal((await first.json()).sound, 'Soft bell');
  const again = await post('/api/nudge');
  assert.equal(again.status, 429);
  assert.equal((await again.json()).code, 'too-soon');
});

test('pausing hides everything from the family but not from the person, and logs it', async () => {
  await post('/api/sharing', { on: false });
  const family = await state('family');
  assert.equal(family.status.level, 'paused');
  assert.equal(family.timeline.length, 0);
  assert.equal(family.canNudge, false);
  const person = await state('person');
  assert.notEqual(person.status.level, 'paused');
  assert.ok(person.accessLog.some((e) => e.action === 'paused sharing'));
  assert.equal((await post('/api/nudge')).status, 403);
  await post('/api/sharing', { on: true });
});

test('access log lists what the family did, newest first', async () => {
  const { accessLog } = await state('person');
  assert.ok(accessLog.some((e) => e.who === 'Dana' && e.action === 'sent a gentle chime'));
  assert.ok(accessLog.some((e) => e.who === 'Dana' && e.action === 'viewed'));
  for (let i = 1; i < accessLog.length; i += 1) assert.ok(accessLog[i].id < accessLog[i - 1].id);
});

test('invalid demo input is a 400, not a crash', async () => {
  assert.equal((await post('/api/demo/jump', { minute: 99999 })).status, 400);
  assert.equal((await post('/api/demo/rate', { rate: 7 })).status, 400);
  assert.equal((await post('/api/demo/trigger', { id: 'nope' })).status, 400);
  assert.equal((await post('/api/sharing', { on: 'yes' })).status, 400);
  const bad = await fetch(`${base}/api/sharing`, { method: 'POST', body: '{oops' });
  assert.equal(bad.status, 400);
});

test('server-sent events deliver updates as they happen', async () => {
  const res = await fetch(`${base}/api/events`);
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  const reader = res.body.getReader();
  await reader.read(); // ": connected"
  await post('/api/demo/trigger', { id: 'kitchen' });
  let seen = '';
  const deadline = Date.now() + 3000;
  while (!seen.includes('event: update') && Date.now() < deadline) {
    const { value } = await reader.read();
    seen += new TextDecoder().decode(value);
  }
  await reader.cancel();
  assert.match(seen, /event: update/);
});

test('forget erases remembered activity and the family sees "learning" again', async () => {
  assert.equal((await post('/api/forget')).status, 200);
  const s = await state('person');
  assert.equal(s.status.level, 'learning');
  assert.ok(s.accessLog.some((e) => e.action === 'deleted stored activity'));
});
