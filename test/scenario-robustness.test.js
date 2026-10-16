import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DemoWorld } from '../server/sim/world.js';
import { SCENARIOS } from '../server/sim/scenarios.js';
import { DEVICES, KITCHEN, LIVING } from '../server/sim/household.js';
import { buildBaseline } from '../server/core/baseline.js';
import { evaluateDay } from '../server/core/status.js';

/**
 * The demo is seeded by the calendar date, so every day of the year produces a
 * slightly different household. The story each scenario tells must hold on all of them,
 * otherwise a demo recorded tomorrow could go off-script.
 */
const EXPECTED = {
  usual: 'typical',
  'slow-morning': 'checkin',
  'dana-visit': 'checkin',
  'quiet-afternoon': 'checkin',
  'restless-night': 'quiet',
};

function statusAt(scenario, realNow, minute) {
  const world = new DemoWorld({ tz: 'UTC', realNow });
  world.reset(scenario, 6 * 60 + 30);
  const events = world.advanceToMinute(minute);
  const inside = [...world.history.get(KITCHEN), ...world.history.get(LIVING)]
    .filter((e) => e.ts <= world.simNow)
    .map((e) => ({ ...e, source: 'history' }));
  const doorway = world.history.get(world.frontDoorId).filter((e) => e.ts <= world.simNow);
  void events;
  return evaluateDay({
    insideEvents: inside,
    doorwayEvents: doorway,
    baseline: buildBaseline(inside, { now: world.simNow, tz: 'UTC' }),
    devices: DEVICES.map((d) => ({ id: d.id, name: d.name, role: d.role, online: true, offlineSince: null })),
    now: world.simNow,
    tz: 'UTC',
    personName: 'Margaret',
  });
}

test('every scenario tells its story on 60 different calendar days', () => {
  const start = Date.UTC(2026, 0, 1, 15, 0, 0);
  for (let d = 0; d < 60; d += 1) {
    const realNow = start + d * 6 * 86_400_000; // every sixth day across a year
    for (const s of SCENARIOS) {
      const status = statusAt(s.id, realNow, s.moment);
      assert.equal(
        status.level,
        EXPECTED[s.id],
        `${s.id} on ${new Date(realNow).toISOString().slice(0, 10)}: got ${status.level} (${status.headline})`,
      );
    }
  }
});

test('dana-visit eases after the doorbell on every day', () => {
  const start = Date.UTC(2026, 0, 1, 15, 0, 0);
  for (let d = 0; d < 30; d += 1) {
    const status = statusAt('dana-visit', start + d * 11 * 86_400_000, 9 * 60 + 56);
    assert.equal(status.level, 'quiet', `day ${d}: ${status.headline}`);
    assert.match(status.context, /came to the door/);
  }
});
