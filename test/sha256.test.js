import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { hmacSha256, sha256, toHex } from '../server/ring/sha256.js';

const enc = new TextEncoder();

test('sha256 matches the published test vectors', () => {
  assert.equal(toHex(sha256(enc.encode(''))), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(toHex(sha256(enc.encode('abc'))), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(
    toHex(sha256(enc.encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  );
});

test('sha256 agrees with node:crypto at every length around the block boundaries', () => {
  for (let n = 0; n <= 200; n += 1) {
    const data = randomBytes(n);
    assert.equal(toHex(sha256(data)), createHash('sha256').update(data).digest('hex'), `length ${n}`);
  }
});

test('hmacSha256 matches RFC 4231 test case 1', () => {
  const key = new Uint8Array(20).fill(0x0b);
  assert.equal(
    toHex(hmacSha256(key, enc.encode('Hi There'))),
    'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
  );
});

test('hmacSha256 agrees with node:crypto for short, block-sized, and long keys', () => {
  for (const keyLen of [1, 20, 63, 64, 65, 131]) {
    for (const msgLen of [0, 1, 55, 56, 64, 300]) {
      const key = randomBytes(keyLen);
      const msg = randomBytes(msgLen);
      assert.equal(toHex(hmacSha256(key, msg)), createHmac('sha256', key).update(msg).digest('hex'), `key ${keyLen}, msg ${msgLen}`);
    }
  }
});
