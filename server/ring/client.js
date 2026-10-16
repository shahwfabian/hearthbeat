/**
 * Minimal client for the Ring Partner API (https://api.amazonvision.com).
 *
 * There is no official Ring SDK, so this uses plain fetch. All endpoints
 * follow JSON:API and need `Authorization: Bearer <access_token>`.
 * Hearthbeat never calls the media endpoints (live video, clips, snapshots).
 */

import { indexIncluded, relatedAttributes } from './jsonapi.js';
import { HISTORY_KIND } from '../core/events.js';

export const DEFAULT_BASE_URL = 'https://api.amazonvision.com';

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export class RingError extends Error {
  constructor(message, { status = 0, body = null } = {}) {
    super(message);
    this.name = 'RingError';
    this.status = status;
    this.body = body;
  }
}

/** The chime exists but cannot sound right now. `reason` is machine readable. */
export class ChimeUnavailableError extends RingError {
  constructor(reason, message) {
    super(message);
    this.name = 'ChimeUnavailableError';
    this.reason = reason;
  }
}

/** 401: the token is missing, invalid or expired (Playground tokens last about 30 minutes). */
export class RingAuthError extends RingError {
  constructor(message, opts) {
    super(message, opts);
    this.name = 'RingAuthError';
  }
}

/**
 * Convert one Event History record to a HomeEvent.
 * Record: { id, attributes: { event_type: "motion" | "motion.human" | "ding" | "on_demand", start } }
 * `on_demand` (a live-view session) says nothing about the household, so it is skipped.
 */
export function historyRowToEvent(row, fallbackDeviceId) {
  const raw = row?.attributes?.event_type;
  if (typeof raw !== 'string') return null;
  const [type, sub] = raw.split('.');
  const kind = HISTORY_KIND[type];
  if (!kind) return null;
  const ts = Number(row.attributes.start);
  if (!Number.isFinite(ts)) return null;
  const event = {
    id: String(row.id),
    ts,
    deviceId: row.relationships?.source?.data?.id ?? fallbackDeviceId,
    kind,
    source: 'history',
  };
  if (sub) event.subType = sub;
  return event;
}

export class RingClient {
  /**
   * @param {{ token: string, baseUrl?: string, timeoutMs?: number, maxRetries?: number, sleep?: (ms:number)=>Promise<void>, fetchImpl?: typeof fetch, onRequest?: (info: {method:string, path:string, status:number, ms:number, attempt:number}) => void }} opts
   */
  constructor({
    token,
    baseUrl = DEFAULT_BASE_URL,
    timeoutMs = 10_000,
    maxRetries = 3,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    fetchImpl = fetch,
    onRequest = null,
  }) {
    if (!token) throw new RingError('A Ring access token is required');
    this.token = token;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.sleep = sleep;
    this.fetch = fetchImpl;
    /** Optional observer for every attempt: powers the "Under the hood" panel. Never receives the token or bodies. */
    this.onRequest = onRequest;
  }

  /**
   * Request with retry. Rate limits (429) and transient server errors
   * (500, 502, 503, 504) are retried with exponential backoff, honouring
   * `Retry-After` when present. Ring allows 100 requests per second.
   */
  async request(method, path, opts = {}) {
    let attempt = 0;
    for (;;) {
      const started = Date.now();
      try {
        const out = await this.#once(method, path, opts);
        this.#observe(method, path, opts, 200, started, attempt);
        return out;
      } catch (err) {
        this.#observe(method, path, opts, err instanceof RingError ? err.status : 0, started, attempt);
        const retryable =
          err instanceof RingError && !(err instanceof RingAuthError) && RETRYABLE.has(err.status);
        if (!retryable || attempt >= this.maxRetries) throw err;
        const waitMs = err.retryAfterMs ?? Math.min(250 * 2 ** attempt, 4000);
        attempt += 1;
        await this.sleep(waitMs);
      }
    }
  }

  #observe(method, path, { query } = {}, status, started, attempt) {
    if (!this.onRequest) return;
    const url = new URL(path.startsWith('http') ? path : this.baseUrl + path);
    for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    try {
      this.onRequest({ method, path: url.pathname + decodeURIComponent(url.search), status, ms: Date.now() - started, attempt });
    } catch {
      /* an observer must never break a Ring call */
    }
  }

  /**
   * GET /v1/devices?include=status,capabilities
   * Returns a flat list: { id, name, online, capabilities } for each device.
   * `online` is null when Ring did not include status.
   */
  async listDevices() {
    const doc = await this.request('GET', '/v1/devices', {
      query: { include: 'status,capabilities' },
    });
    const index = indexIncluded(doc);
    return (doc?.data ?? []).map((d) => ({
      id: d.id,
      name: d.attributes?.name ?? 'Unnamed device',
      online: relatedAttributes(index, d, 'status')?.online ?? null,
      capabilities: relatedAttributes(index, d, 'capabilities'),
    }));
  }

  /** GET /v1/devices/{id}/status, the `attributes` object (`online`, `audio.snooze`, ...). */
  async getStatus(deviceId) {
    const doc = await this.request('GET', `/v1/devices/${encodeURIComponent(deviceId)}/status`);
    return doc?.data?.attributes ?? {};
  }

  /**
   * GET /v1/history/devices/{id}/events, following `links.next` to the end.
   * Results come newest first and only cover events after the user gave
   * consent. Each record is reduced to a HomeEvent (no media is requested).
   *
   * @param {string} deviceId
   * @param {{ eventTypes?: string, sinceMs?: number, maxPages?: number }} [opts]
   *   `eventTypes` uses Ring's composite syntax, e.g. "ding,motion.human".
   *   Paging stops once a page is entirely older than `sinceMs`.
   */
  async getEventHistory(deviceId, { eventTypes, sinceMs = 0, maxPages = 50 } = {}) {
    const events = [];
    let path = `/v1/history/devices/${encodeURIComponent(deviceId)}/events`;
    let query = { event_types: eventTypes };
    for (let page = 0; page < maxPages; page += 1) {
      const doc = await this.request('GET', path, { query });
      const rows = doc?.data ?? [];
      let oldest = Infinity;
      for (const row of rows) {
        const ev = historyRowToEvent(row, deviceId);
        if (!ev) continue;
        oldest = Math.min(oldest, ev.ts);
        if (ev.ts >= sinceMs) events.push(ev);
      }
      const next = doc?.links?.next;
      if (!next || rows.length === 0 || oldest < sinceMs) break;
      path = next; // already contains the filters and the page[key] cursor
      query = undefined;
    }
    return events;
  }

  /**
   * Play a gentle sound on a Ring Chime (needs the Chime Controls capability).
   *
   * Follows the documented sequence: read capabilities, status and
   * configurations in one request, make sure the device is really a chime that
   * is online and not snoozed, pick an enabled audio slot, then
   * POST /v1/devices/{id}/media/audio/playback with that slot's audio_ref.
   * Playback is the only chime command partners get and it changes no state.
   *
   * @returns {Promise<{ audioRef: string, audioName: string|null, status: string }>}
   * @throws {ChimeUnavailableError} when the chime cannot sound right now
   */
  async playChime(deviceId) {
    const doc = await this.request('GET', `/v1/devices/${encodeURIComponent(deviceId)}`, {
      query: { include: 'capabilities,configurations,status' },
    });
    const index = indexIncluded(doc);
    const device = doc?.data;
    const caps = relatedAttributes(index, device, 'capabilities');
    const status = relatedAttributes(index, device, 'status');
    const config = relatedAttributes(index, device, 'configurations');

    if (((caps?.audio?.customizable_slots) || 0) <= 0) {
      throw new ChimeUnavailableError('not-a-chime', 'That device is not a Ring Chime');
    }
    if (status?.online !== true) {
      throw new ChimeUnavailableError('offline', 'The chime is offline');
    }
    if (status?.audio?.snooze?.active) {
      throw new ChimeUnavailableError('snoozed', 'The chime is snoozed in the Ring app');
    }
    const slot = (config?.audio?.customizable_slots ?? []).find((s) => s && !s.disabled && s.audio_ref);
    if (!slot) {
      throw new ChimeUnavailableError('no-slot', 'The chime has no enabled audio slot');
    }

    const res = await this.request(
      'POST',
      `/v1/devices/${encodeURIComponent(deviceId)}/media/audio/playback`,
      { body: { data: { type: 'audio', attributes: { audio_ref: slot.audio_ref } } } },
    );
    return {
      audioRef: slot.audio_ref,
      audioName: slot.audio_name ?? null,
      status: res?.data?.attributes?.status ?? 'unknown',
    };
  }

  /** Perform one authenticated request and return the parsed JSON body. */
  async #once(method, path, { query, body } = {}) {
    const url = new URL(path.startsWith('http') ? path : this.baseUrl + path);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
    const res = await this.fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await res.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    if (res.status === 401) {
      throw new RingAuthError('Ring rejected the access token (invalid or expired)', {
        status: 401,
        body: json,
      });
    }
    if (!res.ok) {
      const err = new RingError(`Ring API ${method} ${url.pathname} failed with ${res.status}`, {
        status: res.status,
        body: json,
      });
      const retryAfter = Number(res.headers.get('retry-after'));
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        err.retryAfterMs = Math.min(retryAfter * 1000, 10_000);
      }
      throw err;
    }
    return json;
  }
}
