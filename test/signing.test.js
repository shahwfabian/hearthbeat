import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { signBody, verifySignature } from '../server/ring/signing.js';

const KEY = 'unit-test-key';
const BODY = '{"meta":{"request_id":"r1"},"data":{"type":"button_press"}}';

test('signBody produces sha256=<hex hmac>', () => {
  const expected = 'sha256=' + createHmac('sha256', KEY).update(BODY).digest('hex');
  assert.equal(signBody(KEY, BODY), expected);
});

test('verifySignature accepts a correct signature', () => {
  assert.equal(verifySignature(KEY, BODY, signBody(KEY, BODY)), true);
});

test('verifySignature accepts the digest without the sha256= prefix', () => {
  const bare = signBody(KEY, BODY).slice('sha256='.length);
  assert.equal(verifySignature(KEY, BODY, bare), true);
});

test('verifySignature rejects a tampered body', () => {
  const sig = signBody(KEY, BODY);
  assert.equal(verifySignature(KEY, BODY.replace('r1', 'r2'), sig), false);
});

test('verifySignature rejects re-serialised JSON (whitespace changes the bytes)', () => {
  const sig = signBody(KEY, BODY);
  const reserialised = JSON.stringify(JSON.parse(BODY), null, 2);
  assert.equal(verifySignature(KEY, reserialised, sig), false);
});

test('verifySignature rejects wrong key, missing header, and bad lengths', () => {
  const sig = signBody(KEY, BODY);
  assert.equal(verifySignature('other-key', BODY, sig), false);
  assert.equal(verifySignature(KEY, BODY, undefined), false);
  assert.equal(verifySignature(KEY, BODY, ''), false);
  assert.equal(verifySignature(KEY, BODY, 'sha256=abc'), false);
  assert.equal(verifySignature('', BODY, sig), false);
});
