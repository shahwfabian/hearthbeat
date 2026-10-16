/**
 * Read configuration from command-line flags and environment variables.
 * With no configuration at all the app starts in demo mode.
 */

const splitIds = (value) =>
  String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export function systemTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * @param {string[]} argv  process.argv.slice(2)
 * @param {Record<string, string|undefined>} env
 */
export function loadConfig(argv = [], env = {}) {
  const live = argv.includes('--live') || env.RING_MODE === 'live';
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new ConfigError(`PORT must be a number between 0 and 65535 (got "${env.PORT}")`);
  }

  const tz = env.HOUSEHOLD_TZ || systemTimeZone();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    throw new ConfigError(`HOUSEHOLD_TZ "${tz}" is not a valid IANA time zone (for example America/Chicago)`);
  }

  const cfg = { mode: live ? 'live' : 'demo', port, tz, host: env.HOST || '127.0.0.1' };

  if (live) {
    const token = (env.RING_ACCESS_TOKEN || '').trim();
    if (!token || token === 'your_playground_token_here') {
      throw new ConfigError(
        'Live mode needs RING_ACCESS_TOKEN. Generate a token in the Ring Developer Playground ' +
          '(https://developer.amazon.com/ring/console/playground), put it in .env, and run again. ' +
          'Or run `npm start` for demo mode, which needs nothing.',
      );
    }
    const pollMs = Number(env.POLL_INTERVAL_MS ?? 30_000);
    cfg.live = {
      token,
      pollMs: Number.isFinite(pollMs) && pollMs >= 5000 ? pollMs : 30_000,
      hmacKey: env.RING_HMAC_KEY && env.RING_HMAC_KEY !== 'your_hmac_signing_key_here' ? env.RING_HMAC_KEY : undefined,
      inside: splitIds(env.RING_INSIDE_DEVICE_IDS),
      doorway: splitIds(env.RING_DOORWAY_DEVICE_IDS),
      chime: (env.RING_CHIME_DEVICE_ID || '').trim() || null,
      baseUrl: env.RING_API_BASE_URL || undefined,
    };
  }
  return cfg;
}

/** Device id -> role map from a live config. */
export function rolesFromLive(live) {
  const roles = {};
  for (const id of live.inside) roles[id] = 'inside';
  for (const id of live.doorway) roles[id] = 'doorway';
  if (live.chime) roles[live.chime] = 'chime';
  return roles;
}
