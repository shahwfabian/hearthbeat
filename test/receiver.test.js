import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWebhookReceiver } from '../server/ring/receiver.js';
import { signBody } from '../server/ring/signing.js';
import { buildWebhookDocument } from '../server/sim/emitter.js';
import { FRONT } from '../server/sim/household.js';

const KEY = 'receiver-test-key';
const ev = { id: `${FRONT}_button_press_1`, ts: 1770989995231, deviceId: FRONT, kind: 'doorbell' };

function setup(kept = true) {
  const got = [];
  const receive = createWebhookReceiver({ key: KEY, hub: { ingest: (e) => (got.push(e), kept) } });
  const send = (doc, sig) => {
    const raw = Buffer.from(typeof doc === 'string' ? doc : JSON.stringify(doc));
    return receive(raw, sig ?? signBody(KEY, raw));
  };
  return { got, send, receive };
}

test('valid signed webhook is processed and reaches the hub', () => {
  const { got, send } = setup();
  const res = send(buildWebhookDocument(ev, { requestId: 'a' }));
  assert.deepEqual(res, { status: 200, body: { status: 'processed' } });
  assert.equal(got.length, 1);
  assert.equal(got[0].kind, 'doorbell');
});

test('bad or missing signature is 401 and never reaches the hub', () => {
  const { got, send } = setup();
  assert.equal(send(buildWebhookDocument(ev), 'sha256=deadbeef').status, 401);
  assert.equal(send(buildWebhookDocument(ev), '').status, 401);
  assert.equal(got.length, 0);
});

test('a retried delivery with the same request_id is acknowledged once', () => {
  const { got, send } = setup();
  const doc = buildWebhookDocument(ev, { requestId: 'same' });
  assert.equal(send(doc).body.status, 'processed');
  assert.equal(send(doc).body.status, 'already_processed');
  assert.equal(got.length, 1);
});

test('signed but malformed bodies get 400', () => {
  const { send } = setup();
  assert.equal(send('not json').status, 400);
  assert.equal(send({ meta: {}, data: {} }).status, 400);
});

test('event types we do not use are acknowledged with 200, not 4xx', () => {
  const { send, got } = setup();
  const doc = buildWebhookDocument(ev, { requestId: 'sub' });
  doc.data.type = 'subscription_activated';
  const res = send(doc);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ignored');
  assert.equal(got.length, 0);
});

test('with no signing key configured, the endpoint says so (503) instead of accepting anything', () => {
  const receive = createWebhookReceiver({ key: undefined, hub: { ingest: () => true } });
  assert.equal(receive(Buffer.from('{}'), 'sha256=x').status, 503);
});

test('a hub that declines the event (for example sharing paused) still answers 200', () => {
  const { send } = setup(false);
  assert.equal(send(buildWebhookDocument(ev, { requestId: 'p' })).body.status, 'ignored');
});
