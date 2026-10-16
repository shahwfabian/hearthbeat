import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RingClient, RingError, RingAuthError, ChimeUnavailableError } from '../server/ring/client.js';

/** Build a fetch stub that replays the given responses in order and records calls. */
function stubFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error('stubFetch ran out of responses');
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: next.headers ?? {},
    });
  };
  return { impl, calls };
}

function client(responses, extra = {}) {
  const { impl, calls } = stubFetch(responses);
  const sleeps = [];
  const c = new RingClient({
    token: 'tok',
    baseUrl: 'https://ring.test/',
    fetchImpl: impl,
    sleep: async (ms) => void sleeps.push(ms),
    ...extra,
  });
  return { c, calls, sleeps };
}

test('requires a token', () => {
  assert.throws(() => new RingClient({ token: '' }), RingError);
});

test('sends the bearer token and builds query strings', async () => {
  const { c, calls } = client([{ body: { data: [] } }]);
  await c.request('GET', '/v1/devices', { query: { include: 'status', skip: undefined } });
  assert.equal(calls[0].url, 'https://ring.test/v1/devices?include=status');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
});

test('401 raises RingAuthError and is not retried', async () => {
  const { c, calls } = client([{ status: 401, body: { errors: [] } }]);
  await assert.rejects(c.request('GET', '/v1/devices'), RingAuthError);
  assert.equal(calls.length, 1);
});

test('retries 503 with exponential backoff, then succeeds', async () => {
  const { c, calls, sleeps } = client([{ status: 503 }, { status: 503 }, { body: { ok: 1 } }]);
  const out = await c.request('GET', '/v1/devices');
  assert.deepEqual(out, { ok: 1 });
  assert.equal(calls.length, 3);
  assert.deepEqual(sleeps, [250, 500]);
});

test('honours Retry-After on 429', async () => {
  const { c, sleeps } = client([{ status: 429, headers: { 'retry-after': '2' } }, { body: {} }]);
  await c.request('GET', '/v1/devices');
  assert.deepEqual(sleeps, [2000]);
});

test('gives up after maxRetries and surfaces the status', async () => {
  const { c, calls } = client([{ status: 500 }, { status: 500 }, { status: 500 }], { maxRetries: 2 });
  await assert.rejects(
    c.request('GET', '/v1/devices'),
    (err) => err instanceof RingError && err.status === 500,
  );
  assert.equal(calls.length, 3);
});

test('404 is not retried', async () => {
  const { c, calls } = client([{ status: 404, body: { errors: [{ status: '404' }] } }]);
  await assert.rejects(c.request('GET', '/v1/devices/missing'), (e) => e.status === 404);
  assert.equal(calls.length, 1);
});

test('listDevices flattens a compound document', async () => {
  const { c, calls } = client([
    {
      body: {
        data: [
          {
            type: 'devices',
            id: 'dev1',
            attributes: { name: 'Front Door Camera' },
            relationships: {
              status: { data: { type: 'device-status', id: 's1' } },
              capabilities: { data: { type: 'device-capabilities', id: 'c1' } },
            },
          },
          { type: 'devices', id: 'dev2', attributes: {}, relationships: {} },
        ],
        included: [
          { type: 'device-status', id: 's1', attributes: { online: true } },
          { type: 'device-capabilities', id: 'c1', attributes: { audio: { customizable_slots: 2 } } },
        ],
      },
    },
  ]);
  const devices = await c.listDevices();
  assert.match(calls[0].url, /include=status%2Ccapabilities/);
  assert.equal(devices[0].name, 'Front Door Camera');
  assert.equal(devices[0].online, true);
  assert.equal(devices[0].capabilities.audio.customizable_slots, 2);
  assert.equal(devices[1].name, 'Unnamed device');
  assert.equal(devices[1].online, null);
});

test('getStatus returns the attributes object and encodes the id', async () => {
  const { c, calls } = client([{ body: { data: { attributes: { online: false } } } }]);
  assert.deepEqual(await c.getStatus('ava1.ring.device.A/B'), { online: false });
  assert.match(calls[0].url, /ava1\.ring\.device\.A%2FB\/status$/);
});

function row(id, type, start) {
  return {
    type: 'history-events',
    id,
    attributes: { event_type: type, start },
    relationships: { source: { data: { type: 'devices', id: 'dev1' } } },
  };
}

test('getEventHistory follows links.next and keeps only supported event types', async () => {
  const { c, calls } = client([
    {
      body: {
        data: [row('e3', 'motion.human', 3000), row('e2x', 'on_demand', 2500), row('e2', 'ding', 2000)],
        links: { next: '/v1/history/devices/dev1/events?page[key]=2026-01-01T00:00:00Z' },
      },
    },
    { body: { data: [row('e1', 'motion', 1000)] } },
  ]);
  const events = await c.getEventHistory('dev1', { eventTypes: 'ding,motion' });
  assert.deepEqual(events.map((e) => e.id), ['e3', 'e2', 'e1']);
  assert.equal(events[0].subType, 'human');
  assert.equal(events[1].kind, 'doorbell');
  assert.equal(events[2].source, 'history');
  assert.match(calls[0].url, /event_types=ding%2Cmotion/);
  assert.match(calls[1].url, /page\[key\]=2026-01-01T00:00:00Z|page%5Bkey%5D/);
});

test('getEventHistory stops paging once a page is older than sinceMs', async () => {
  const { c, calls } = client([
    {
      body: {
        data: [row('new', 'motion', 5000), row('old', 'motion', 100)],
        links: { next: '/v1/history/devices/dev1/events?page[key]=x' },
      },
    },
  ]);
  const events = await c.getEventHistory('dev1', { sinceMs: 1000 });
  assert.deepEqual(events.map((e) => e.id), ['new']);
  assert.equal(calls.length, 1);
});

test('getEventHistory returns [] for an account with no activity yet', async () => {
  const { c } = client([{ body: { data: [], links: { next: '/v1/x?page[key]=y' } } }]);
  assert.deepEqual(await c.getEventHistory('dev1'), []);
});

function chimeDoc({ slots = 2, online = true, snooze = false, config = undefined } = {}) {
  return {
    data: {
      type: 'devices',
      id: 'chime1',
      attributes: { name: 'Living Room Chime' },
      relationships: {
        capabilities: { data: { type: 'device-capabilities', id: 'cap' } },
        status: { data: { type: 'device-status', id: 'st' } },
        configurations: { data: { type: 'device-configurations', id: 'cfg' } },
      },
    },
    included: [
      { type: 'device-capabilities', id: 'cap', attributes: slots ? { audio: { customizable_slots: slots } } : {} },
      { type: 'device-status', id: 'st', attributes: { online, audio: { snooze: { active: snooze, until: null } } } },
      {
        type: 'device-configurations',
        id: 'cfg',
        attributes: {
          audio: {
            customizable_slots: config ?? [
              { event: 'e2', disabled: true, audio_ref: 'ref-disabled', audio_name: 'Off' },
              { event: 'e1', disabled: false, audio_ref: 'ref-ok', audio_name: 'Soft Bell' },
            ],
          },
        },
      },
    ],
  };
}

test('playChime picks the first enabled slot and posts its audio_ref', async () => {
  const { c, calls } = client([
    { body: chimeDoc() },
    { body: { data: { type: 'audio', id: 'ref-ok', attributes: { status: 'completed' } } } },
  ]);
  const out = await c.playChime('chime1');
  assert.deepEqual(out, { audioRef: 'ref-ok', audioName: 'Soft Bell', status: 'completed' });
  assert.equal(calls[1].init.method, 'POST');
  assert.match(calls[1].url, /\/chime1\/media\/audio\/playback$/);
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    data: { type: 'audio', attributes: { audio_ref: 'ref-ok' } },
  });
});

test('playChime refuses devices that are not chimes, offline, snoozed, or slotless', async () => {
  const cases = [
    [chimeDoc({ slots: 0 }), 'not-a-chime'],
    [chimeDoc({ online: false }), 'offline'],
    [chimeDoc({ snooze: true }), 'snoozed'],
    [chimeDoc({ config: [{ event: 'x', disabled: true, audio_ref: 'r' }] }), 'no-slot'],
  ];
  for (const [doc, reason] of cases) {
    const { c, calls } = client([{ body: doc }]);
    await assert.rejects(
      c.playChime('chime1'),
      (err) => err instanceof ChimeUnavailableError && err.reason === reason,
    );
    assert.equal(calls.length, 1, `no playback request when ${reason}`);
  }
});

test('onRequest observes every attempt with method, path, status and no secrets', async () => {
  const seen = [];
  const { impl } = stubFetch([{ status: 503 }, { body: { data: [] } }]);
  const c = new RingClient({
    token: 'super-secret-token',
    baseUrl: 'https://ring.test',
    fetchImpl: impl,
    sleep: async () => {},
    onRequest: (info) => seen.push(info),
  });
  await c.listDevices();
  assert.deepEqual(seen.map((s) => [s.method, s.status, s.attempt]), [['GET', 503, 0], ['GET', 200, 1]]);
  assert.equal(seen[0].path, '/v1/devices?include=status,capabilities');
  assert.ok(!JSON.stringify(seen).includes('super-secret-token'));
});

test('a throwing observer never breaks a Ring call', async () => {
  const { impl } = stubFetch([{ body: { data: [] } }]);
  const c = new RingClient({ token: 't', baseUrl: 'https://ring.test', fetchImpl: impl, onRequest: () => { throw new Error('boom'); } });
  assert.deepEqual(await c.listDevices(), []);
});
