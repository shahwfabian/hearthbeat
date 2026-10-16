import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, planDay, scenarioById } from '../server/sim/scenarios.js';
import { FRONT, KITCHEN, LIVING } from '../server/sim/household.js';

const inside = (plan) => plan.filter((e) => e.deviceId === KITCHEN || e.deviceId === LIVING);

test('every scenario has an id, label, and blurb', () => {
  assert.equal(SCENARIOS.length, 5);
  for (const s of SCENARIOS) assert.ok(s.id && s.label && s.blurb);
  assert.equal(scenarioById('nope').id, 'usual');
});

test('plans are deterministic for a given day and scenario', () => {
  assert.deepEqual(planDay('usual', '2026-10-16'), planDay('usual', '2026-10-16'));
  assert.notDeepEqual(planDay('usual', '2026-10-16'), planDay('usual', '2026-10-17'));
});

test('a usual day starts around 7:15 and runs until 9 pm', () => {
  const plan = inside(planDay('usual', '2026-10-16'));
  const first = plan.find((e) => e.minute >= 4 * 60);
  assert.ok(first.minute >= 7 * 60 && first.minute <= 8 * 60 + 5, `first at ${first.minute}`);
  assert.ok(plan[plan.length - 1].minute > 20 * 60);
});

test('plans are sorted by time', () => {
  const plan = planDay('usual', '2026-10-16');
  for (let i = 1; i < plan.length; i += 1) assert.ok(plan[i].minute >= plan[i - 1].minute);
});

test('slow morning has nothing inside before 10:40', () => {
  const plan = inside(planDay('slow-morning', '2026-10-16')).filter((e) => e.minute >= 4 * 60);
  assert.equal(plan[0].minute, 10 * 60 + 40);
});

test('dana-visit rings the doorbell before activity resumes', () => {
  const plan = planDay('dana-visit', '2026-10-16');
  const bell = plan.find((e) => e.kind === 'doorbell' && e.minute === 9 * 60 + 55);
  assert.equal(bell.deviceId, FRONT);
  const firstInside = inside(plan).find((e) => e.minute >= 4 * 60);
  assert.equal(firstInside.minute, 10 * 60);
});

test('quiet afternoon leaves a hole from 13:10 to 17:05', () => {
  const plan = inside(planDay('quiet-afternoon', '2026-10-16'));
  assert.equal(plan.filter((e) => e.minute > 13 * 60 + 10 && e.minute < 17 * 60 + 5).length, 0);
  assert.ok(plan.some((e) => e.minute < 13 * 60 + 10));
});

test('restless night adds six movements between 1 and 4 am', () => {
  const plan = inside(planDay('restless-night', '2026-10-16'));
  assert.ok(plan.filter((e) => e.minute >= 60 && e.minute < 240).length >= 6);
});
