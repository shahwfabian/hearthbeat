import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError, loadConfig, rolesFromLive } from '../server/config.js';

test('defaults to demo mode on port 3000, bound to localhost', () => {
  const c = loadConfig([], {});
  assert.equal(c.mode, 'demo');
  assert.equal(c.port, 3000);
  assert.equal(c.host, '127.0.0.1');
  assert.ok(c.tz);
  assert.equal(c.live, undefined);
});

test('--live without a token explains how to get one', () => {
  assert.throws(() => loadConfig(['--live'], {}), (e) => e instanceof ConfigError && /Playground/.test(e.message));
  assert.throws(() => loadConfig(['--live'], { RING_ACCESS_TOKEN: 'your_playground_token_here' }), ConfigError);
});

test('live config reads token, device roles, and poll interval', () => {
  const c = loadConfig(['--live'], {
    RING_ACCESS_TOKEN: ' tok ',
    RING_INSIDE_DEVICE_IDS: 'a, b',
    RING_DOORWAY_DEVICE_IDS: 'c',
    RING_CHIME_DEVICE_ID: 'd',
    POLL_INTERVAL_MS: '15000',
    HOUSEHOLD_TZ: 'America/Chicago',
  });
  assert.equal(c.mode, 'live');
  assert.equal(c.live.token, 'tok');
  assert.equal(c.live.pollMs, 15000);
  assert.deepEqual(rolesFromLive(c.live), { a: 'inside', b: 'inside', c: 'doorway', d: 'chime' });
});

test('too-small poll interval falls back to the default', () => {
  const c = loadConfig(['--live'], { RING_ACCESS_TOKEN: 't', POLL_INTERVAL_MS: '10' });
  assert.equal(c.live.pollMs, 30000);
});

test('placeholder HMAC key is treated as unset', () => {
  const c = loadConfig(['--live'], { RING_ACCESS_TOKEN: 't', RING_HMAC_KEY: 'your_hmac_signing_key_here' });
  assert.equal(c.live.hmacKey, undefined);
});

test('RING_MODE=live works like --live', () => {
  assert.equal(loadConfig([], { RING_MODE: 'live', RING_ACCESS_TOKEN: 't' }).mode, 'live');
});

test('rejects bad ports and time zones', () => {
  assert.throws(() => loadConfig([], { PORT: 'abc' }), ConfigError);
  assert.throws(() => loadConfig([], { PORT: '99999' }), ConfigError);
  assert.throws(() => loadConfig([], { HOUSEHOLD_TZ: 'Mars/Olympus' }), /valid IANA/);
});
