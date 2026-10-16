/** Thin wrappers around the Hearthbeat server API. */

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

export async function getState(viewer) {
  return parse(await fetch(`/api/state?as=${viewer}`));
}

export async function post(path, body = {}) {
  return parse(
    await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

/**
 * Listen for server-sent events. EventSource reconnects by itself; we only
 * report whether we are currently connected so the page can say so.
 */
export function connectEvents(onMessage, onStatus) {
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
