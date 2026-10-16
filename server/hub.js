import { BASELINE_DAYS } from './core/constants.js';
import { buildBaseline } from './core/baseline.js';
import { describeDoorway, describeInside, iconFor } from './core/describe.js';
import { KINDS } from './core/events.js';
import { evaluateDay } from './core/status.js';
import { dayKey, formatClock, startOfDay } from './core/time.js';

const DAY_MS = 86_400_000;
const MAX_EVENTS = 5000;

/**
 * Hearthbeat's brain. It owns the events it has been allowed to see, the
 * learned baseline, the consent switch, the access log and the chime nudge.
 * It knows nothing about HTTP: the server wires it to routes and SSE, and the
 * tests drive it directly with a fake Ring client.
 *
 * What it stores: event timestamps, device ids, and a coarse type. Never video,
 * audio, snapshots or thumbnails. Nothing in this file could hold them.
 */
export class Hub {
  /**
   * @param {{
   *   ring: { listDevices(): Promise<any[]>, getEventHistory(id: string, o?: object): Promise<any[]>, playChime(id: string): Promise<any> },
   *   now: () => number,
   *   tz: string,
   *   mode: 'demo'|'live',
   *   personName: string,
   *   caregiverName: string,
   *   roles?: Record<string, 'inside'|'doorway'|'chime'>,
   * }} opts
   */
  constructor({ ring, now, tz, mode, personName, caregiverName, roles = {} }) {
    this.ring = ring;
    this.now = now;
    this.tz = tz;
    this.mode = mode;
    this.personName = personName;
    this.caregiverName = caregiverName;
    this.roles = { ...roles };

    /** @type {Map<string, {id:string,name:string,role:string,online:boolean|null,offlineSince:number|null}>} */
    this.devices = new Map();
    /** @type {import('./core/events.js').HomeEvent[]} */
    this.inside = [];
    /** @type {import('./core/events.js').HomeEvent[]} */
    this.doorway = [];
    this.seen = new Set();
    this.listeners = new Set();

    this.sharing = true;
    this.pausedAt = null;
    this.dropped = 0;
    this.accessLog = [];
    this.lastNudgeAt = 0;
    this.baselineCache = null;
  }

  /** Subscribe to hub messages. Returns an unsubscribe function. */
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type, data = {}) {
    for (const fn of this.listeners) fn({ type, ...data });
  }

  roleOf(deviceId) {
    return this.roles[deviceId] ?? null;
  }

  /**
   * Accept one event, from a webhook or from polling. Returns true when it was
   * new and kept. Events are dropped while sharing is paused, so the person
   * being cared for can switch Hearthbeat off at any moment.
   *
   * @param {import('./core/events.js').HomeEvent} ev
   */
  ingest(ev) {
    if (this.seen.has(ev.id)) return false;
    if (!this.sharing) {
      this.dropped += 1;
      return false;
    }
    const role = this.roleOf(ev.deviceId);
    if (!role || role === 'chime') return false;

    if (ev.kind === KINDS.ONLINE || ev.kind === KINDS.OFFLINE) {
      this.seen.add(ev.id);
      const d = this.devices.get(ev.deviceId);
      if (d) {
        d.online = ev.kind === KINDS.ONLINE;
        d.offlineSince = d.online ? null : ev.ts;
      }
      this.emit('update', { reason: ev.kind });
      return true;
    }
    if (ev.kind !== KINDS.MOTION && ev.kind !== KINDS.DOORBELL) return false;

    this.seen.add(ev.id);
    const list = role === 'inside' ? this.inside : this.doorway;
    list.push(ev);
    if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS);
    if (role === 'inside') this.baselineCache = null;

    const visit =
      role === 'doorway' && (ev.kind === KINDS.DOORBELL || (ev.kind === KINDS.MOTION && ev.subType === 'human'));
    if (visit) {
      this.emit('visitor', {
        id: ev.id,
        time: formatClock(ev.ts, this.tz),
        text: describeDoorway(ev),
        doorbell: ev.kind === KINDS.DOORBELL,
      });
    }
    this.emit('update', { reason: role === 'inside' ? 'activity' : 'door' });
    return true;
  }

  /** The learned usual day, recomputed only when inside history changes or the day rolls over. */
  baseline() {
    const key = dayKey(this.now(), this.tz);
    if (!this.baselineCache || this.baselineCache.key !== key) {
      this.baselineCache = {
        key,
        value: buildBaseline(this.inside, { now: this.now(), tz: this.tz, days: BASELINE_DAYS }),
      };
    }
    return this.baselineCache.value;
  }

  /** Today's status for the family view. */
  status() {
    return evaluateDay({
      insideEvents: this.inside,
      doorwayEvents: this.doorway,
      baseline: this.baseline(),
      devices: [...this.devices.values()],
      now: this.now(),
      tz: this.tz,
      personName: this.personName,
    });
  }

  /** Today's events, newest first, in plain language: the timeline both people can read. */
  timeline(limit = 40) {
    const now = this.now();
    const dayStart = startOfDay(now, this.tz);
    const rows = [];
    for (const ev of [...this.inside, ...this.doorway]) {
      if (ev.ts < dayStart || ev.ts > now) continue;
      const role = this.roleOf(ev.deviceId);
      const name = this.devices.get(ev.deviceId)?.name ?? 'the house';
      rows.push({
        id: ev.id,
        ts: ev.ts,
        time: formatClock(ev.ts, this.tz),
        role,
        icon: iconFor(ev, role),
        text: role === 'doorway' ? describeDoorway(ev) : describeInside(ev, name),
        device: name,
      });
    }
    return rows.sort((a, b) => b.ts - a.ts).slice(0, limit);
  }
}
