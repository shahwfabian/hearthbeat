/**
 * Minimal client for the Ring Partner API (https://api.amazonvision.com).
 *
 * There is no official Ring SDK, so this uses plain fetch. All endpoints
 * follow JSON:API and need `Authorization: Bearer <access_token>`.
 * Hearthbeat never calls the media endpoints (live video, clips, snapshots).
 */

export const DEFAULT_BASE_URL = 'https://api.amazonvision.com';

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

  /** Perform one authenticated request and return the parsed JSON body. */
  async request(method, path, { query, body } = {}) {
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
      throw new RingError(`Ring API ${method} ${url.pathname} failed with ${res.status}`, {
        status: res.status,
        body: json,
      });
    }
    return json;
  }
}
