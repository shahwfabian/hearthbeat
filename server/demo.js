import { once } from 'node:events';
import { RingClient } from './ring/client.js';
import { DemoWorld } from './sim/world.js';
import { createMockRingApi } from './sim/mock-api.js';
import { createEmitter } from './sim/emitter.js';
import { SCENARIOS } from './sim/scenarios.js';
import { DEMO_TOKEN, DEVICES, FRONT, KITCHEN, LIVING, PERSON } from './sim/household.js';
import { Hub } from './hub.js';
import { formatMinutes, minutesOfDay } from './core/time.js';

const TICK_MS = 250;

/** Quick actions the presenter can trigger from the interface. */
const TRIGGERS = {
  kitchen: { deviceId: KITCHEN, kind: 'motion', label: 'Movement in the kitchen' },
  living: { deviceId: LIVING, kind: 'motion', label: 'Movement in the living room' },
  doorbell: { deviceId: FRONT, kind: 'doorbell', label: 'Doorbell press' },
  person: { deviceId: FRONT, kind: 'motion', subType: 'human', label: 'Person at the door' },
  package: { deviceId: FRONT, kind: 'motion', subType: 'package_delivery', label: 'Package delivered' },
};

/**
 * Demo mode: a simulated Ring account, a mock of the documented Ring API, and
 * a clock the presenter controls. Events reach the Hub the same way real ones
 * would: as signed webhooks over HTTP, plus Event History reads for the past.
 */
export class DemoRuntime {
  /**
   * @param {{ tz: string, webhookUrl: () => string }} opts
   */
  constructor({ tz, webhookUrl }) {
    this.tz = tz;
    this.webhookUrl = webhookUrl;
    this.world = new DemoWorld({ tz });
    this.running = false;
    this.rate = 6; // simulated minutes per real second
    this.timer = null;
    this.busy = false;
    this.lastTick = Date.now();
  }

  /** Start the mock Ring API, build the Hub, and learn from two weeks of history. */
  async start() {
    this.api = createMockRingApi(this.world, { onPlayback: (entry) => this.hub?.emit('chime', { entry }) });
    this.api.listen(0, '127.0.0.1');
    await once(this.api, 'listening');
    this.apiUrl = `http://127.0.0.1:${this.api.address().port}`;

    this.ring = new RingClient({
      token: DEMO_TOKEN,
      baseUrl: this.apiUrl,
      onRequest: (info) => this.hub?.logApi({ dir: 'out', ...info, note: info.attempt ? `retry ${info.attempt}` : '' }),
    });
    this.hub = new Hub({
      ring: this.ring,
      now: () => this.world.simNow,
      tz: this.tz,
      mode: 'demo',
      personName: PERSON.name,
      caregiverName: PERSON.caregiver,
      roles: Object.fromEntries(DEVICES.map((d) => [d.id, d.role])),
      ringTarget: {
        label: 'Simulated Ring API: our local mock of the documented endpoints, not Ring',
        host: this.apiUrl,
        simulated: true,
      },
    });
    this.emitter = createEmitter({ url: this.webhookUrl() });
    await this.hub.loadHistory();
    this.timer = setInterval(() => void this.#tick(), TICK_MS);
    return this;
  }

  stop() {
    clearInterval(this.timer);
    this.api?.close();
  }

  async #deliver(events) {
    for (const ev of events) {
      try {
        await this.emitter.send(ev);
      } catch (err) {
        console.error(`[demo] could not deliver simulated webhook: ${err.message}`);
      }
    }
  }

  async #tick() {
    const wall = Date.now();
    const dt = wall - this.lastTick;
    this.lastTick = wall;
    if (!this.running || this.busy) return;
    this.busy = true;
    try {
      // rate is simulated minutes per real second: dt ms * rate * 60_000 ms / 1000 ms
      const events = this.world.advance(dt * this.rate * 60);
      await this.#deliver(events);
      this.hub.emit('clock');
    } finally {
      this.busy = false;
    }
  }

  setRunning(on) {
    this.running = Boolean(on);
    this.lastTick = Date.now();
    this.hub.emit('clock');
  }

  setRate(minutesPerSecond) {
    const allowed = [2, 6, 20, 60];
    if (!allowed.includes(minutesPerSecond)) throw new RangeError('Unsupported speed');
    this.rate = minutesPerSecond;
    this.hub.emit('clock');
  }

  /** Skip ahead to a time of day, delivering everything that happens on the way. */
  async jumpTo(minute) {
    if (!Number.isFinite(minute) || minute < 0 || minute > 1439) throw new RangeError('minute must be 0 to 1439');
    await this.#deliver(this.world.advanceToMinute(minute));
    this.hub.emit('clock');
  }

  /** Start a scenario's day from the beginning. */
  async resetDay(scenarioId) {
    this.running = false;
    this.world.reset(scenarioId, 6 * 60 + 30);
    this.hub.reset();
    await this.hub.loadHistory();
    this.hub.emit('clock');
  }

  /** Make something happen right now: a doorbell press, a package, someone in the kitchen. */
  async trigger(name) {
    const t = TRIGGERS[name];
    if (!t) throw new RangeError(`Unknown trigger "${name}"`);
    const ev = this.world.trigger(t);
    if (ev) await this.#deliver([ev]);
    return Boolean(ev);
  }

  /** Switch a device offline or back on to show the "can't see" state. */
  async setOffline(deviceId, offline) {
    const ev = this.world.setOnline(deviceId, !offline);
    if (ev) await this.#deliver([ev]);
  }

  describe() {
    const minute = minutesOfDay(this.world.simNow, this.tz);
    return {
      running: this.running,
      rate: this.rate,
      rates: [2, 6, 20, 60],
      scenario: this.world.scenario,
      scenarios: SCENARIOS,
      minute,
      clock: formatMinutes(minute),
      triggers: Object.entries(TRIGGERS).map(([id, t]) => ({ id, label: t.label })),
      offline: DEVICES.filter((d) => this.world.online.get(d.id) === false).map((d) => d.id),
      apiUrl: this.apiUrl,
      simulated: true,
    };
  }
}
