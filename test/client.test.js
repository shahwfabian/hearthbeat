import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RingClient, RingError, RingAuthError } from '../server/ring/client.js';

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
