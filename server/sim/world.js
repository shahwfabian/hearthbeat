import { dayKey, startOfDay } from '../core/time.js';
import { DEVICES, FRONT, CHIME, CHIME_SLOTS, deviceById } from './household.js';
import { planDay, scenarioById } from './scenarios.js';

const DAY_MS = 86_400_000;
const HISTORY_DAYS = 14;

/**
 * @typedef {Object} WorldEvent
 * @property {string} id
 * @property {number} ts
 * @property {string} deviceId
 * @property {'motion'|'doorbell'|'online'|'offline'} kind
 * @property {string} [subType]
 */

/**
 * The simulated Ring side of the demo: a household with devices, fourteen
 * days of past Event History, and one "today" that plays out on a clock the
 * presenter controls. It is the data source behind the mock Ring API, so the
 * app reads it through the very same client code it uses against the real
 * service.
 */
export class DemoWorld {
  /**
   * @param {{ tz: string, realNow?: number, startMinute?: number }} opts
   */
  constructor({ tz, realNow = Date.now(), startMinute = 6 * 60 + 30 }) {
    this.tz = tz;
    this.realNow = realNow;
    this.startMinute = startMinute;
    this.scenario = 'usual';
    /** @type {Map<string, WorldEvent[]>} */
    this.history = new Map();
    this.online = new Map(DEVICES.map((d) => [d.id, true]));
    /** @type {{ts:number, deviceId:string, audioRef:string, by:string}[]} */
    this.chimeLog = [];
    this.reset('usual');
  }

  get dayStart() {
    return startOfDay(this.realNow, this.tz);
  }

  /** Start the day over with a scenario, replaying fourteen days of "normal" first. */
  reset(scenarioId = this.scenario, startMinute = this.startMinute) {
    this.scenario = scenarioById(scenarioId).id;
    this.startMinute = startMinute;
    this.simNow = this.dayStart + startMinute * 60_000;
    this.history = new Map(DEVICES.map((d) => [d.id, []]));
    for (const d of DEVICES) this.online.set(d.id, true);
    this.chimeLog = [];

    for (let back = HISTORY_DAYS; back >= 1; back -= 1) {
      const midday = this.dayStart - back * DAY_MS + 12 * 3_600_000;
      const base = startOfDay(midday, this.tz);
      for (const p of planDay('usual', dayKey(midday, this.tz))) {
        this.#record({ ...p, ts: base + p.minute * 60_000 });
      }
    }

    const key = dayKey(this.dayStart + 12 * 3_600_000, this.tz);
    /** Planned events for today that have not happened yet, oldest first. */
    this.pending = planDay(this.scenario, key).map((p) => ({
      ...p,
      ts: this.dayStart + p.minute * 60_000,
    }));
    // Anything already in the past at the starting time has "happened".
    this.#flushUpTo(this.simNow);
  }

  #record(ev) {
    const event = {
      id: `${ev.deviceId}_${ev.kind === 'doorbell' ? 'button_press' : ev.kind}_${ev.ts}`,
      ts: ev.ts,
      deviceId: ev.deviceId,
      kind: ev.kind,
      ...(ev.subType ? { subType: ev.subType } : {}),
    };
    this.history.get(ev.deviceId)?.push(event);
    return event;
  }

  #flushUpTo(limit) {
    const emitted = [];
    while (this.pending.length && this.pending[0].ts <= limit) {
      const next = this.pending.shift();
      if (this.online.get(next.deviceId) === false) continue; // an offline device sees nothing
      emitted.push(this.#record(next));
    }
    return emitted;
  }

  /** Move the simulated clock forward and return the events that occurred, in order. */
  advance(simMs) {
    const end = this.dayStart + DAY_MS - 60_000;
    const target = Math.min(this.simNow + Math.max(0, simMs), end);
    this.simNow = target;
    return this.#flushUpTo(target);
  }

  /** Jump forward to a minute of the day (never backwards). */
  advanceToMinute(minute) {
    const target = this.dayStart + minute * 60_000;
    return this.advance(Math.max(0, target - this.simNow));
  }

  /** Make something happen right now, as if a person did it in front of a device. */
  trigger({ deviceId, kind, subType }) {
    if (!deviceById(deviceId)) throw new Error(`Unknown device ${deviceId}`);
    if (this.online.get(deviceId) === false) return null;
    return this.#record({ deviceId, kind, subType, ts: this.simNow });
  }

  /** Take a device offline or bring it back. Returns the lifecycle event. */
  setOnline(deviceId, online) {
    if (!deviceById(deviceId)) throw new Error(`Unknown device ${deviceId}`);
    if (this.online.get(deviceId) === online) return null;
    this.online.set(deviceId, online);
    return {
      id: `${deviceId}_device_${online ? 'online' : 'offline'}_${this.simNow}`,
      ts: this.simNow,
      deviceId,
      kind: online ? 'online' : 'offline',
    };
  }

  /**
   * Event History as Ring returns it: newest first, only up to the simulated
   * "now", optionally filtered by Ring's composite event_types syntax.
   */
  historyFor(deviceId, { eventTypes, before = Infinity, limit = 100 } = {}) {
    const all = (this.history.get(deviceId) ?? []).filter((e) => e.ts <= this.simNow && e.ts < before);
    const wanted = eventTypes ? eventTypes.split(',').map((t) => t.trim()).filter(Boolean) : null;
    const rows = all.filter((e) => {
      if (!wanted) return true;
      return wanted.some((w) => {
        const [type, sub] = w.split('.');
        const eType = e.kind === 'doorbell' ? 'ding' : e.kind === 'motion' ? 'motion' : e.kind;
        if (type !== eType) return false;
        return sub ? sub === e.subType : true;
      });
    });
    rows.sort((a, b) => b.ts - a.ts);
    return { rows: rows.slice(0, limit), more: rows.length > limit };
  }

  /** Record a chime playback so the interface can show that the sound happened. */
  playAudio(deviceId, audioRef, by = 'caregiver') {
    const slot = CHIME_SLOTS.find((s) => s.audio_ref === audioRef);
    if (!slot) return null;
    const entry = { ts: this.simNow, deviceId, audioRef, by, audioName: slot.audio_name };
    this.chimeLog.push(entry);
    return entry;
  }

  get frontDoorId() {
    return FRONT;
  }

  get chimeId() {
    return CHIME;
  }
}
