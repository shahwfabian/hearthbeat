/**
 * Hearthbeat's internal event shape. Everything that arrives from Ring
 * (webhook or Event History) is reduced to this so the rest of the app never
 * touches raw Ring payloads, and never holds media of any kind.
 *
 * @typedef {Object} HomeEvent
 * @property {string} id         stable id, used to drop duplicates
 * @property {number} ts         epoch milliseconds
 * @property {string} deviceId
 * @property {'motion'|'doorbell'|'online'|'offline'|'lifecycle'} kind
 * @property {string} [subType]  e.g. human, vehicle, package_delivery, other_motion
 * @property {'webhook'|'history'|'demo'} source
 */

export const KINDS = Object.freeze({
  MOTION: 'motion',
  DOORBELL: 'doorbell',
  ONLINE: 'online',
  OFFLINE: 'offline',
  LIFECYCLE: 'lifecycle',
});

/** Ring webhook `data.type` values mapped to our kinds. */
export const WEBHOOK_KIND = Object.freeze({
  motion_detected: KINDS.MOTION,
  button_press: KINDS.DOORBELL,
  device_online: KINDS.ONLINE,
  device_offline: KINDS.OFFLINE,
  device_added: KINDS.LIFECYCLE,
  device_removed: KINDS.LIFECYCLE,
  app_integration_added: KINDS.LIFECYCLE,
  app_integration_removed: KINDS.LIFECYCLE,
});

/** Event History `event_type` values mapped to our kinds. */
export const HISTORY_KIND = Object.freeze({
  motion: KINDS.MOTION,
  ding: KINDS.DOORBELL,
});

/** Does this event say "someone moved inside"? Decided by the device role. */
export function isMotion(ev) {
  return ev.kind === KINDS.MOTION;
}

export function isDoorbell(ev) {
  return ev.kind === KINDS.DOORBELL;
}

/** Sort newest-last, stable, without mutating the input. */
export function byTime(events) {
  return [...events].sort((a, b) => a.ts - b.ts || String(a.id).localeCompare(String(b.id)));
}
