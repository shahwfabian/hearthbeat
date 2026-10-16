/**
 * Minimal client for the Ring Partner API (https://api.amazonvision.com).
 *
 * There is no official Ring SDK, so this uses plain fetch. All endpoints
 * follow JSON:API and need `Authorization: Bearer <access_token>`.
 * Hearthbeat never calls the media endpoints (live video, clips, snapshots).
 */

import { indexIncluded, relatedAttributes } from './jsonapi.js';

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

/** 401: the token is missing, invalid or expired (Playground tokens last about 30 minutes). */
export class RingAuthError extends RingError {
  constructor(message, opts) {
    super(message, opts);
    this.name = 'RingAuthError';
  }
}

export class RingClient {
  /**
   * @param {{ token: string, baseUrl?: string, timeoutMs?: number, maxRetries?: number, sleep?: (ms:number)=>Promise<void>, fetchImpl?: typeof fetch }} opts
   */
  constructor({
    token,
    baseUrl = DEFAULT_BASE_URL,
    timeoutMs = 10_000,
    maxRetries = 3,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    fetchImpl = fetch,
  }) {
    if (!token) throw new RingError('A Ring access token is required');
    this.token = token;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.sleep = sleep;
    this.fetch = fetchImpl;
  }

  /**
   * Request with retry. Rate limits (429) and transient server errors
   * (500, 502, 503, 504) are retried with exponential backoff, honouring
   * `Retry-After` when present. Ring allows 100 requests per second.
   */
  async request(method, path, opts = {}) {
    let attempt = 0;
    for (;;) {
      try {
        return await this.#once(method, path, opts);
      } catch (err) {
        const retryable =
          err instanceof RingError && !(err instanceof RingAuthError) && RETRYABLE.has(err.status);
        if (!retryable || attempt >= this.maxRetries) throw err;
        const waitMs = err.retryAfterMs ?? Math.min(250 * 2 ** attempt, 4000);
        attempt += 1;
        await this.sleep(waitMs);
      }
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
