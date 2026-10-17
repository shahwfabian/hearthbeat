import { STATIC } from './mode.js';

/**
 * Thin wrappers around the Hearthbeat API.
 *
 * Normally the API is the Node server. In the hosted demo (STATIC is true, set
 * by the build) the very same application code runs inside this page instead,
 * so every visitor gets a private household and nothing leaves the tab.
 */

let localBackend = null;
const local = () => (localBackend ??= import('/engine/local.js').then((m) => m.createLocalBackend()));

export class ApiError extends Error {
  constructor(message, { status, code, retryInSeconds } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryInSeconds = retryInSeconds;
  }
}

async function parse(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, {
      status: res.status,
      code: body?.code,
      retryInSeconds: body?.retryInSeconds,
    });
  }
  return body;
}

function fromLocal(out) {
  if (out.status >= 400) {
    throw new ApiError(out.body?.error ?? `Request failed (${out.status})`, {
      status: out.status,
      code: out.body?.code,
      retryInSeconds: out.body?.retryInSeconds,
    });
  }
  return out.body;
}

export async function getState(viewer) {
  if (STATIC) return fromLocal(await (await local()).request('GET', '/api/state', viewer));
  return parse(await fetch(`/api/state?as=${viewer}`));
}

export async function post(path, body = {}) {
  const result = STATIC
    ? fromLocal(await (await local()).request('POST', path, 'family', body))
    : await parse(
        await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );
  // Redraw right away instead of waiting for the live-update message to arrive.
  window.dispatchEvent(new Event('hearthbeat:changed'));
  return result;
}

/**
 * Listen for server-sent events. EventSource reconnects by itself; we only
 * report whether we are currently connected so the page can say so.
 */
export function connectEvents(onMessage, onStatus) {
  if (STATIC) {
    let off = null;
    local().then((backend) => {
      off = backend.subscribe(onMessage);
      onStatus(true);
    });
    return () => off?.();
  }
  const source = new EventSource('/api/events');
  for (const type of ['update', 'visitor', 'nudge', 'chime', 'log', 'clock', 'api']) {
    source.addEventListener(type, (e) => {
      try {
        onMessage(JSON.parse(e.data));
      } catch {
        /* ignore a malformed frame */
      }
    });
  }
  source.addEventListener('open', () => onStatus(true));
  source.addEventListener('error', () => onStatus(false));
  return () => source.close();
}
