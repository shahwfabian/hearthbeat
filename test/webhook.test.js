import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWebhook, IdempotencyCache, WebhookError } from '../server/ring/webhook.js';

function doc(type, attrs = {}, meta = {}) {
  return {
    meta: { version: '1.1', time: '2026-10-16T08:00:00Z', request_id: 'req-1', account_id: 'ava1.ring.account.T', ...meta },
    data: {
      id: `dev1_${type}_1`,
      type,
      attributes: { source: 'dev1', source_type: 'devices', timestamp: 1770989995231, ...attrs },
      relationships: { devices: { links: { self: '/v1/devices/dev1' } } },
    },
  };
}

test('parses a motion_detected webhook with sub_type', () => {
  const out = parseWebhook(doc('motion_detected', { sub_type: 'human', component_ids: ['0'] }));
  assert.equal(out.requestId, 'req-1');
  assert.equal(out.accountId, 'ava1.ring.account.T');
  assert.equal(out.event.kind, 'motion');
  assert.equal(out.event.subType, 'human');
  assert.equal(out.event.deviceId, 'dev1');
  assert.equal(out.event.ts, 1770989995231);
  assert.equal(out.event.source, 'webhook');
});

test('parses button_press as a doorbell event', () => {
  const out = parseWebhook(doc('button_press'));
  assert.equal(out.event.kind, 'doorbell');
  assert.equal(out.event.subType, undefined);
});

test('maps online and offline events', () => {
  assert.equal(parseWebhook(doc('device_online')).event.kind, 'online');
  assert.equal(parseWebhook(doc('device_offline')).event.kind, 'offline');
});

test('passes unknown sub_type values through instead of dropping them', () => {
  const out = parseWebhook(doc('motion_detected', { sub_type: 'some_future_value' }));
  assert.equal(out.event.subType, 'some_future_value');
});

test('rejects malformed payloads with WebhookError', () => {
  assert.throws(() => parseWebhook(null), WebhookError);
  assert.throws(() => parseWebhook({}), WebhookError);
  assert.throws(() => parseWebhook(doc('motion_detected', {}, { request_id: '' })), WebhookError);
  assert.throws(() => parseWebhook(doc('motion_detected', { timestamp: 'soon' })), WebhookError);
  assert.throws(() => parseWebhook(doc('not_a_real_type')), (e) => e.code === 'unsupported-type');
});

test('IdempotencyCache accepts an id once and rejects repeats', () => {
  const cache = new IdempotencyCache();
  assert.equal(cache.claim('a'), true);
  assert.equal(cache.claim('a'), false);
  assert.equal(cache.claim('b'), true);
});

test('IdempotencyCache forgets the oldest id past its limit', () => {
  const cache = new IdempotencyCache(2);
  cache.claim('a');
  cache.claim('b');
  cache.claim('c');
  assert.equal(cache.claim('a'), true, 'a was evicted so it is new again');
  assert.equal(cache.claim('c'), false, 'c is still remembered');
});
