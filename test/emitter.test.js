import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWebhookDocument, createEmitter } from '../server/sim/emitter.js';
import { parseWebhook } from '../server/ring/webhook.js';
import { verifySignature } from '../server/ring/signing.js';
import { DEMO_HMAC_KEY, FRONT } from '../server/sim/household.js';

const ev = { id: `${FRONT}_button_press_1`, ts: 1770989995231, deviceId: FRONT, kind: 'doorbell' };

test('documents match the v1.1 envelope and round-trip through our parser', () => {
  const doc = buildWebhookDocument(ev, { requestId: 'req-x' });
  assert.equal(doc.meta.version, '1.1');
  assert.equal(doc.meta.request_id, 'req-x');
  assert.equal(doc.data.type, 'button_press');
  assert.equal(doc.data.attributes.source_type, 'devices');
  const parsed = parseWebhook(doc);
  assert.equal(parsed.event.kind, 'doorbell');
  assert.equal(parsed.event.deviceId, FRONT);
});

test('motion documents carry sub_type (defaulting to "motion")', () => {
  const base = { id: 'm', ts: 1, deviceId: FRONT, kind: 'motion' };
  assert.equal(buildWebhookDocument(base).data.attributes.sub_type, 'motion');
  assert.equal(buildWebhookDocument({ ...base, subType: 'human' }).data.attributes.sub_type, 'human');
});

test('lifecycle kinds map to device_online and device_offline', () => {
  assert.equal(buildWebhookDocument({ ...ev, kind: 'offline' }).data.type, 'device_offline');
  assert.equal(buildWebhookDocument({ ...ev, kind: 'online' }).data.type, 'device_online');
  assert.throws(() => buildWebhookDocument({ ...ev, kind: 'mystery' }));
});

test('the emitter signs the exact bytes it sends', async () => {
  let seen;
  const emitter = createEmitter({
    url: 'http://app.test/webhooks/ring',
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return new Response('{}', { status: 200 });
    },
  });
  const status = await emitter.send(ev);
  assert.equal(status, 200);
  assert.equal(seen.url, 'http://app.test/webhooks/ring');
  assert.equal(verifySignature(DEMO_HMAC_KEY, seen.init.body, seen.init.headers['X-Signature']), true);
});
