import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, seedFrom } from '../server/sim/rng.js';

test('same seed gives the same sequence', () => {
  const a = makeRng(42);
  const b = makeRng(42);
  assert.deepEqual([a.next(), a.next(), a.next()], [b.next(), b.next(), b.next()]);
});

test('different seeds diverge', () => {
  assert.notEqual(makeRng(1).next(), makeRng(2).next());
});

test('next stays in [0, 1) and int stays in range', () => {
  const r = makeRng(7);
  for (let i = 0; i < 500; i += 1) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1);
    const n = r.int(3, 9);
    assert.ok(n >= 3 && n <= 9 && Number.isInteger(n));
  }
});

test('chance respects probability extremes; pick returns members', () => {
  const r = makeRng(9);
  assert.equal(r.chance(0), false);
  assert.equal(r.chance(1), true);
  assert.ok(['a', 'b', 'c'].includes(r.pick(['a', 'b', 'c'])));
});

test('seedFrom is stable and distinguishes strings', () => {
  assert.equal(seedFrom('2026-10-16'), seedFrom('2026-10-16'));
  assert.notEqual(seedFrom('2026-10-16'), seedFrom('2026-10-17'));
});
