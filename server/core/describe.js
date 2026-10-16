import { KINDS } from './events.js';

/**
 * Plain-language wording for events, written so anyone in the family can read
 * the timeline without knowing what "motion_detected" means.
 */

const DOORWAY_TEXT = {
  human: 'Someone is at the door',
  vehicle: 'A vehicle pulled up outside',
  package_delivery: 'A package was delivered',
  animal: 'An animal passed by outside',
  other_motion: 'Movement outside',
  motion: 'Movement outside',
};

/** Words for an event seen by a doorway device (doorbell, porch camera). */
export function describeDoorway(ev) {
  if (ev.kind === KINDS.DOORBELL) return 'Someone rang the doorbell';
  if (ev.kind === KINDS.MOTION) return DOORWAY_TEXT[ev.subType ?? 'motion'] ?? 'Movement outside';
  if (ev.kind === KINDS.OFFLINE) return 'The door camera went offline';
  if (ev.kind === KINDS.ONLINE) return 'The door camera is back online';
  return 'Something happened at the door';
}

/** Words for an event seen inside the home. */
export function describeInside(ev, deviceName = 'the house') {
  if (ev.kind === KINDS.MOTION) return `Movement in ${deviceName}`;
  if (ev.kind === KINDS.OFFLINE) return `${deviceName} went offline`;
  if (ev.kind === KINDS.ONLINE) return `${deviceName} is back online`;
  return `Activity in ${deviceName}`;
}

/** A short icon key the interface maps to a glyph. */
export function iconFor(ev, role) {
  if (ev.kind === KINDS.DOORBELL) return 'bell';
  if (ev.kind === KINDS.OFFLINE || ev.kind === KINDS.ONLINE) return 'plug';
  if (role === 'doorway') {
    if (ev.subType === 'package_delivery') return 'box';
    if (ev.subType === 'vehicle') return 'car';
    return 'person';
  }
  return 'home';
}
