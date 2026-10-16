import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEGMENTS,
  clockLabel,
  minuteToAngle,
  pointerToMinute,
  polar,
  segmentLabel,
  segmentOf,
  segmentPath,
  usuallyText,
} from '../public/js/ring-math.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('midnight is at the top and noon at the bottom', () => {
  const top = polar(100, 100, 50, minuteToAngle(0));
  near(top.x, 100);
  near(top.y, 50);
  const bottom = polar(100, 100, 50, minuteToAngle(720));
  near(bottom.x, 100);
  near(bottom.y, 150);
});

test('6 am is on the right and 6 pm on the left (clockwise)', () => {
  const right = polar(100, 100, 50, minuteToAngle(360));
  near(right.x, 150);
  near(right.y, 100);
  const left = polar(100, 100, 50, minuteToAngle(1080));
  near(left.x, 50);
});

test('there are 48 segments and segmentOf clamps', () => {
  assert.equal(SEGMENTS, 48);
  assert.equal(segmentOf(0), 0);
  assert.equal(segmentOf(435), 14);
  assert.equal(segmentOf(1439), 47);
  assert.equal(segmentOf(99999), 47);
  assert.equal(segmentOf(-5), 0);
});

test('clockLabel and segmentLabel read naturally', () => {
  assert.equal(clockLabel(0), '12:00 AM');
  assert.equal(clockLabel(435), '7:15 AM');
  assert.equal(clockLabel(13 * 60), '1:00 PM');
  assert.equal(segmentLabel(14), '7:00 to 7:30 AM');
  assert.equal(segmentLabel(23), '11:30 AM to 12:00 PM');
  assert.equal(segmentLabel(47), '11:30 PM to 12:00 AM');
});

test('pointerToMinute maps directions to times and ignores the middle', () => {
  assert.equal(pointerToMinute(0, -50), 0); // straight up = midnight
  assert.equal(pointerToMinute(50, 0), 360); // right = 6 am
  assert.equal(pointerToMinute(0, 50), 720); // down = noon
  assert.equal(pointerToMinute(-50, 0), 1080); // left = 6 pm
  assert.equal(pointerToMinute(3, 3), null);
});

test('segmentPath is a closed arc path with the right radii', () => {
  const d = segmentPath(200, 200, 100, 120, 0, minuteToAngle(30));
  assert.match(d, /^M[\d. -]+ A120 120 0 0 1 [\d. -]+ L[\d. -]+ A100 100 0 0 0 [\d. -]+ Z$/);
});

test('usuallyText buckets the average', () => {
  assert.equal(usuallyText(0), 'Usually quiet');
  assert.equal(usuallyText(0.5), 'Usually a little activity');
  assert.equal(usuallyText(1), 'Usually some activity');
  assert.equal(usuallyText(2), 'Usually busy');
});
