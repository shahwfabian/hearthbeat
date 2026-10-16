import { Hub } from '../server/hub.js';
import { atMinute } from '../server/core/time.js';
import { NOON, TZ } from './helpers.js';

export const IDS = { kitchen: 'k', door: 'd', chime: 'c' };

export function fakeRing(overrides = {}) {
  const calls = { chime: 0 };
  return {
    calls,
    async listDevices() {
      return [
        { id: IDS.kitchen, name: 'Kitchen camera', online: true },
        { id: IDS.door, name: 'Front door', online: true },
        { id: IDS.chime, name: 'Hall chime', online: true },
      ];
    },
    async getEventHistory() {
      return [];
    },
    async playChime() {
      calls.chime += 1;
      return { audioRef: 'r', audioName: 'Soft bell', status: 'completed' };
    },
    ...overrides,
  };
}

export function makeHub({ now = atMinute(NOON, 9 * 60, TZ), ring = fakeRing() } = {}) {
  const clock = { t: now };
  const hub = new Hub({
    ring,
    now: () => clock.t,
    tz: TZ,
    mode: 'demo',
    personName: 'Margaret',
    caregiverName: 'Dana',
    roles: { [IDS.kitchen]: 'inside', [IDS.door]: 'doorway', [IDS.chime]: 'chime' },
  });
  for (const [id, name, role] of [
    [IDS.kitchen, 'Kitchen camera', 'inside'],
    [IDS.door, 'Front door', 'doorway'],
    [IDS.chime, 'Hall chime', 'chime'],
  ]) {
    hub.devices.set(id, { id, name, role, online: true, offlineSince: null });
  }
  return { hub, clock, ring };
}

export const evt = (id, deviceId, kind, minute, extra = {}) => ({
  id,
  deviceId,
  kind,
  ts: atMinute(NOON, minute, TZ),
  source: 'webhook',
  ...extra,
});
