import { BASELINE_DAYS } from './core/constants.js';
import { buildBaseline } from './core/baseline.js';
import { describeDoorway, describeInside, iconFor } from './core/describe.js';
import { KINDS } from './core/events.js';
import { evaluateDay } from './core/status.js';
import { dayKey, formatClock, minutesOfDay, startOfDay } from './core/time.js';

const DAY_MS = 86_400_000;
const MAX_EVENTS = 5000;
const MAX_LOG = 200;
const MAX_API_LOG = 60;
const VIEW_LOG_DEBOUNCE_MS = 5 * 60_000;
const NUDGE_COOLDOWN_MS = 10 * 60_000;

/** An expected, explainable refusal (for example "sharing is paused"). `status` is the HTTP code to use. */
export class HubError extends Error {
  constructor(code, message, status = 409, extra = {}) {
    super(message);
    this.name = 'HubError';
    this.code = code;
    this.status = status;
    Object.assign(this, extra);
  }
}

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
   *   wallNow?: () => number,
   *   mode: 'demo'|'live',
   *   personName: string,
   *   caregiverName: string,
   *   roles?: Record<string, 'inside'|'doorway'|'chime'>,
   *   ringTarget?: { label: string, host: string, simulated: boolean },
   * }} opts
   */
  constructor({ ring, now, wallNow = Date.now, tz, mode, personName, caregiverName, roles = {}, ringTarget = null }) {
    this.ring = ring;
    this.now = now;
    this.wallNow = wallNow;
    this.tz = tz;
    this.mode = mode;
    this.personName = personName;
    this.caregiverName = caregiverName;
    this.roles = { ...roles };
    this.ringTarget = ringTarget;
    /** Every Ring call and webhook, newest last. Metadata only: no tokens, no bodies. */
    this.apiLog = [];
    this.apiSeq = 0;

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
    this.lastViewLogged = new Map();
    this.accessSeq = 0;
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

    // Only things happening now deserve a flashing banner, never history being replayed.
    const visit =
      role === 'doorway' &&
      ev.source !== 'history' &&
      (ev.kind === KINDS.DOORBELL || (ev.kind === KINDS.MOTION && ev.subType === 'human'));
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
        minute: minutesOfDay(ev.ts, this.tz),
        role,
        icon: iconFor(ev, role),
        text: role === 'doorway' ? describeDoorway(ev) : describeInside(ev, name),
        device: name,
      });
    }
    return rows.sort((a, b) => b.ts - a.ts).slice(0, limit);
  }

  /**
   * Record who did what with the data. The person being cared for can read this
   * log at any time; Ring's content policy asks apps to give customers easy
   * access to monitoring activity, and this is that.
   */
  log(who, action, detail = '') {
    this.accessSeq += 1;
    const entry = {
      id: this.accessSeq,
      ts: this.now(),
      time: formatClock(this.now(), this.tz),
      who,
      action,
      detail,
    };
    this.accessLog.push(entry);
    if (this.accessLog.length > MAX_LOG) this.accessLog.splice(0, this.accessLog.length - MAX_LOG);
    this.emit('log', { entry });
    return entry;
  }

  /**
   * Record one Ring API call (direction "out") or one webhook delivery ("in").
   * This feeds the "Under the hood" panel, so anyone watching a demo can see
   * which Ring endpoints are really being used.
   */
  logApi({ dir, method, path, status, ms = null, note = '', detail = '' }) {
    this.apiSeq += 1;
    const wall = this.wallNow();
    const entry = {
      id: this.apiSeq,
      dir,
      method,
      path,
      status,
      ms,
      note,
      detail,
      time: new Date(wall).toLocaleTimeString('en-US', { timeZone: this.tz, hour: 'numeric', minute: '2-digit', second: '2-digit' }),
    };
    this.apiLog.push(entry);
    if (this.apiLog.length > MAX_API_LOG) this.apiLog.splice(0, this.apiLog.length - MAX_API_LOG);
    this.emit('api');
    return entry;
  }

  /** The family member opened the dashboard. Logged at most once every five minutes of real time. */
  recordFamilyView() {
    const last = this.lastViewLogged.get(this.caregiverName) ?? 0;
    const wall = this.wallNow();
    if (wall - last < VIEW_LOG_DEBOUNCE_MS) return null;
    this.lastViewLogged.set(this.caregiverName, wall);
    return this.log(this.caregiverName, 'viewed', `Looked at ${this.personName}'s daily rhythm`);
  }

  /** The person being cared for pauses or resumes sharing. While paused, nothing new is kept. */
  setSharing(on, by = this.personName) {
    if (this.sharing === on) return this.sharing;
    this.sharing = on;
    this.pausedAt = on ? null : this.now();
    this.log(by, on ? 'resumed sharing' : 'paused sharing', on ? '' : 'New activity is not being kept until sharing resumes.');
    this.emit('update', { reason: 'sharing' });
    return this.sharing;
  }

  /** Delete everything Hearthbeat has stored. The person can do this whenever they like. */
  forget(by = this.personName) {
    this.inside = [];
    this.doorway = [];
    this.seen = new Set();
    this.baselineCache = null;
    this.log(by, 'deleted stored activity', 'All remembered events were erased.');
    this.emit('update', { reason: 'forget' });
  }

  /** Start from a clean slate (used by the demo's "reset day"). Not an access-log event. */
  reset() {
    this.inside = [];
    this.doorway = [];
    this.seen = new Set();
    this.devices.clear();
    this.sharing = true;
    this.pausedAt = null;
    this.dropped = 0;
    this.accessLog = [];
    this.accessSeq = 0;
    this.lastNudgeAt = 0;
    this.lastViewLogged.clear();
    this.apiLog = [];
    this.lastPoll = undefined;
    this.baselineCache = null;
    this.emit('update', { reason: 'reset' });
  }

  /**
   * Family sends a gentle chime to the person's Ring Chime. One tap, no video.
   * Refused while sharing is paused (their wish comes first), when there is no
   * chime, when a nudge was sent very recently, or when the chime cannot sound.
   */
  async nudge(by = this.caregiverName) {
    if (!this.sharing) {
      throw new HubError('paused', `${this.personName} has paused sharing, so Hearthbeat will not send anything.`, 403);
    }
    const chimeId = Object.keys(this.roles).find((id) => this.roles[id] === 'chime');
    if (!chimeId) throw new HubError('no-chime', 'No Ring Chime is set up for this home.', 404);

    const wall = this.wallNow();
    const wait = this.lastNudgeAt + NUDGE_COOLDOWN_MS - wall;
    if (this.lastNudgeAt && wait > 0) {
      const mins = Math.ceil(wait / 60_000);
      throw new HubError('too-soon', `A chime was just sent. Please wait ${mins} more minute${mins === 1 ? '' : 's'}.`, 429, {
        retryInSeconds: Math.ceil(wait / 1000),
      });
    }

    let played;
    try {
      played = await this.ring.playChime(chimeId);
    } catch (err) {
      if (err?.name === 'ChimeUnavailableError') {
        const why = { offline: 'The chime is offline.', snoozed: `The chime is snoozed in ${this.personName}'s Ring app.` }[err.reason];
        throw new HubError(err.reason, why ?? err.message, 409);
      }
      throw new HubError('ring-error', 'Ring could not play the chime right now. Please try again shortly.', 502);
    }
    this.lastNudgeAt = wall;
    const entry = this.log(by, 'sent a gentle chime', `Played "${played.audioName ?? 'a soft sound'}" on the hallway chime.`);
    this.emit('nudge', { entry });
    return { ok: true, sound: played.audioName ?? null, entry };
  }

  /**
   * Read the last two weeks of Event History for every device that has a role
   * and learn from it. Works the same against the real API or the demo mock.
   */
  async loadHistory() {
    const found = await this.ring.listDevices();
    this.devices.clear();
    for (const d of found) {
      const role = this.roleOf(d.id);
      if (!role) continue;
      // A device that is already offline when we start counts as offline from now.
      const offlineSince = d.online === false ? this.now() : null;
      this.devices.set(d.id, { id: d.id, name: d.name, role, online: d.online, offlineSince });
    }
    const sinceMs = this.now() - BASELINE_DAYS * DAY_MS;
    let loaded = 0;
    for (const d of this.devices.values()) {
      if (d.role === 'chime') continue;
      const eventTypes = d.role === 'doorway' ? 'ding,motion' : 'motion';
      const events = await this.ring.getEventHistory(d.id, { eventTypes, sinceMs });
      for (const ev of events) if (this.ingest(ev)) loaded += 1;
    }
    this.lastPoll = this.now();
    this.emit('update', { reason: 'history' });
    return { devices: this.devices.size, events: loaded };
  }

  /** Live mode: fetch anything new since the last check (the documented alternative to webhooks). */
  async poll() {
    const since = (this.lastPoll ?? this.now()) - 2 * 60_000;
    const started = this.now();
    let added = 0;
    for (const d of this.devices.values()) {
      if (d.role === 'chime') continue;
      const eventTypes = d.role === 'doorway' ? 'ding,motion' : 'motion';
      const events = await this.ring.getEventHistory(d.id, { eventTypes, sinceMs: since });
      for (const ev of events) if (this.ingest(ev)) added += 1;
    }
    this.lastPoll = started;
    return added;
  }
}
