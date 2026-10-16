/**
 * Everything the interface needs in one JSON document.
 *
 * Two viewers see the same facts with different powers:
 *  - "family"  sees status, rhythm and timeline, and can send a chime. If the
 *              person has paused sharing, the family view shows only that.
 *  - "person"  (the person being cared for) always sees everything, plus the
 *              access log, the pause switch and delete-my-data.
 */

export const PRIVACY = Object.freeze({
  collects: [
    'When a Ring camera or doorbell noticed movement (a time and which device)',
    'When the doorbell was pressed',
    'Whether a Ring device is online or offline',
  ],
  never: [
    'Video, live view, or recorded clips',
    'Audio',
    'Snapshots or thumbnails',
    'Faces, names, or who anyone is',
    'Location beyond which device saw movement',
  ],
});

/**
 * @param {import('./hub.js').Hub} hub
 * @param {import('./demo.js').DemoRuntime|null} demo
 * @param {'family'|'person'} viewer
 */
export function buildSnapshot(hub, demo, viewer) {
  const paused = !hub.sharing;
  const hidden = viewer === 'family' && paused;

  const status = hidden
    ? {
        level: 'paused',
        headline: `${hub.personName} has paused sharing`,
        detail:
          'Hearthbeat is not keeping anything new and is not showing anything. That is their choice. ' +
          'A phone call is a lovely way to check in.',
        findings: [],
        visitors: [],
        ring: null,
        lastActivity: null,
        context: null,
      }
    : hub.status();

  return {
    mode: hub.mode,
    viewer,
    person: { name: hub.personName },
    caregiver: { name: hub.caregiverName },
    sharing: { on: hub.sharing, pausedAt: hub.pausedAt, dropped: hub.dropped },
    status,
    timeline: hidden ? [] : hub.timeline(),
    devices: [...hub.devices.values()].map((d) => ({
      id: d.id,
      name: d.name,
      role: d.role,
      online: d.online,
    })),
    accessLog: [...hub.accessLog].reverse().slice(0, 50),
    privacy: PRIVACY,
    demo: demo ? demo.describe() : null,
    api: { target: hub.ringTarget, log: [...hub.apiLog].reverse().slice(0, 25) },
    canNudge: hub.sharing && Object.values(hub.roles).includes('chime'),
  };
}
