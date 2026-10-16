import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mean, stddev, percentile, median, mad } from '../server/core/stats.js';

test('mean and stddev', () => {
  assert.equal(mean([]), 0);
  assert.equal(mean([2, 4, 6]), 4);
  assert.equal(stddev([5]), 0);
  assert.ok(Math.abs(stddev([2, 4, 4, 4, 5, 5, 7, 9]) - 2) < 1e-9);
});

test('percentile interpolates and clamps', () => {
  assert.equal(percentile([], 0.5), 0);
  assert.equal(percentile([10, 20, 30, 40], 0), 10);
  assert.equal(percentile([10, 20, 30, 40], 1), 40);
  assert.equal(percentile([10, 20, 30, 40], 0.5), 25);
  assert.equal(percentile([10, 20, 30, 40], 2), 40);
});

test('median ignores order', () => {
  assert.equal(median([9, 1, 5]), 5);
});

test('mad shrugs off a single outlier', () => {
  assert.equal(mad([430, 435, 440, 435, 900]), 5);
  assert.equal(mad([]), 0);
});
