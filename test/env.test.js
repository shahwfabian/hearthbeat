import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from '../server/env.js';

test('parseEnv reads keys, ignores comments and blank lines', () => {
  const out = parseEnv('# hello\n\nPORT=3000\nNAME = spaced \n');
  assert.deepEqual(out, { PORT: '3000', NAME: 'spaced' });
});

test('parseEnv strips matching quotes and keeps = inside values', () => {
  const out = parseEnv('A="x y"\nB=\'z\'\nC=a=b=c\r\n');
  assert.deepEqual(out, { A: 'x y', B: 'z', C: 'a=b=c' });
});

test('parseEnv skips malformed lines', () => {
  assert.deepEqual(parseEnv('=nokey\njustwords\n'), {});
});
