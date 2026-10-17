import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalBackend } from '../server/local.js';

let app;
const state = async (viewer = 'family') => (await app.request('GET', '/api/state', viewer)).body;
const post = (path, body = {}) => app.request('POST', path, 'family', body);

before(async () => {
  app = await createLocalBackend({ tz: 'UTC' });
});
after(() => app.stop());

test('the in-page backend starts calm with two weeks of learned history', async () => {
  const s = await state();
  assert.equal(s.mode, 'demo');
  assert.equal(s.status.level, 'typical');
  assert.equal(s.devices.length, 4);
  assert.ok(s.status.learning.daysObserved >= 5);
  assert.match(s.api.target.label, /not Ring/);
  assert.match(s.api.target.host, /inside this browser tab/);
});

test('real Ring calls and webhook verification are logged, with no secrets', async () => {
  await post('/api/demo/trigger', { id: 'doorbell' });
  const { api } = await state('person');
  assert.ok(api.log.some((e) => e.dir === 'out' && e.path.startsWith('/v1/devices?include=') && e.status === 200));
  const hook = api.log.find((e) => e.dir === 'in');
  assert.match(hook.note, /signature verified/);
  assert.equal(hook.detail, 'button_press');
  assert.ok(!JSON.stringify(api).includes('demo-token'));
  assert.ok(!JSON.stringify(api).includes('signing-key'));
});

test('every scenario tells its story at its key moment', async () => {
  const expected = { usual: 'typical', 'slow-morning': 'checkin', 'dana-visit': 'checkin', 'quiet-afternoon': 'checkin', 'restless-night': 'quiet' };
  for (const [id, level] of Object.entries(expected)) {
    await post('/api/demo/scenario', { id });
    const { demo } = await state();
    await post('/api/demo/jump', { minute: demo.scenarios.find((s) => s.id === id).moment });
    assert.equal((await state()).status.level, level, id);
  }
});

test('live updates arrive in the server-sent-event shape, including the visitor banner', async () => {
  await post('/api/demo/scenario', { id: 'usual' });
  const seen = [];
  const off = app.subscribe((m) => seen.push(m));
  await post('/api/demo/trigger', { id: 'doorbell' });
  off();
  const visitor = seen.find((m) => m.type === 'visitor');
  assert.equal(visitor.text, 'Someone rang the doorbell');
  assert.equal(visitor.doorbell, true);
  assert.ok(seen.some((m) => m.type === 'update'));
});

test('chime nudge works once, then asks for patience; errors keep the HTTP contract', async () => {
  const first = await post('/api/nudge');
  assert.equal(first.status, 200);
  assert.equal(first.body.sound, 'Soft bell');
  const again = await post('/api/nudge');
  assert.equal(again.status, 429);
  assert.equal(again.body.code, 'too-soon');
  assert.equal((await post('/api/demo/jump', { minute: 99999 })).status, 400);
  assert.equal((await post('/api/sharing', { on: 'yes' })).status, 400);
});

test('consent works in the page: pause hides the family view, blocks chimes, and is logged', async () => {
  await post('/api/sharing', { on: false });
  const family = await state('family');
  assert.equal(family.status.level, 'paused');
  assert.equal(family.canNudge, false);
  assert.equal((await post('/api/nudge')).status, 403);
  const person = await state('person');
  assert.ok(person.accessLog.some((e) => e.action === 'paused sharing'));
  await post('/api/sharing', { on: true });
});

test('delete-everything resets the learned routine', async () => {
  assert.equal((await post('/api/forget')).status, 200);
  assert.equal((await state('person')).status.level, 'learning');
});

test('unknown routes return 404 instead of throwing', async () => {
  assert.equal((await app.request('GET', '/api/nope')).status, 404);
});
