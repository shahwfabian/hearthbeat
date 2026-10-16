/**
 * The simulated household used by demo mode.
 *
 * Margaret is 78 and lives alone. Her daughter Dana lives two hours away and
 * uses Hearthbeat. These are fictional people and devices. Device ids follow
 * the shape Ring documents (`ava1.ring.device.<opaque>`).
 */

export const PERSON = Object.freeze({
  name: 'Margaret',
  caregiver: 'Dana',
});

export const DEMO_TOKEN = 'demo-token';
export const DEMO_HMAC_KEY = 'demo-signing-key-not-a-secret';
export const DEMO_ACCOUNT_ID = 'ava1.ring.account.DEMO';

/** @type {ReadonlyArray<{id:string,name:string,role:'inside'|'doorway'|'chime',hasCamera:boolean}>} */
export const DEVICES = Object.freeze([
  { id: 'ava1.ring.device.DEMOKITCHEN', name: 'Kitchen camera', role: 'inside', hasCamera: true },
  { id: 'ava1.ring.device.DEMOLIVING', name: 'Living room camera', role: 'inside', hasCamera: true },
  { id: 'ava1.ring.device.DEMOFRONT', name: 'Front door', role: 'doorway', hasCamera: true },
  { id: 'ava1.ring.device.DEMOCHIME', name: 'Hallway chime', role: 'chime', hasCamera: false },
]);

export const KITCHEN = DEVICES[0].id;
export const LIVING = DEVICES[1].id;
export const FRONT = DEVICES[2].id;
export const CHIME = DEVICES[3].id;

/** Two audio slots on the demo chime, shaped like Ring's `audio.customizable_slots`. */
export const CHIME_SLOTS = Object.freeze([
  {
    event: 'ring-appstore-event-1',
    disabled: false,
    audio_ref: '4d4ec269-0bb2-4312-b7df-5e53c2e613e4',
    audio_name: 'Soft bell',
  },
  {
    event: 'ring-appstore-event-2',
    disabled: false,
    audio_ref: '9c62d803-6344-41a1-93c0-49f9331af83c',
    audio_name: 'Gentle hello',
  },
]);

export function deviceById(id) {
  return DEVICES.find((d) => d.id === id) ?? null;
}
