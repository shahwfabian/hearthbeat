import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { HubError } from './hub.js';
import { createWebhookReceiver } from './ring/receiver.js';
import { buildSnapshot } from './snapshot.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

/**
 * Strict headers: the page loads only its own scripts and styles and talks
 * only to its own origin. Inline script is not allowed at all.
 */
const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

const MAX_BODY = 64 * 1024;

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HubError('too-large', 'Request body too large', 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  const raw = await readBody(req);
  if (raw.length === 0) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw new HubError('bad-json', 'Body must be valid JSON', 400);
  }
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    ...SECURITY_HEADERS,
    ...headers,
  });
  res.end(payload);
}

/**
 * Create the HTTP server. The server can start listening before the Hub exists
 * (the demo needs a port to aim its simulated webhooks at), so the Hub is
 * attached afterwards with `server.attach(hub, demo)`. Until then API calls
 * answer 503 "starting".
 *
 * @param {{ hmacKey: string|undefined, publicDir: string }} opts
 */
export function createApp({ hmacKey, publicDir }) {
  /** @type {{ hub: import('./hub.js').Hub|null, demo: import('./demo.js').DemoRuntime|null }} */
  const ctx = { hub: null, demo: null };
  const receive = createWebhookReceiver({
    key: hmacKey,
    hub: { ingest: (ev) => (ctx.hub ? ctx.hub.ingest(ev) : false) },
  });
  const sseClients = new Set();

  function attach(hub, demo = null) {
    ctx.hub = hub;
    ctx.demo = demo;
    hub.subscribe((msg) => {
      const payload = {
        type: msg.type,
        reason: msg.reason ?? null,
        entry: msg.entry ?? null,
        id: msg.id ?? null,
        text: msg.text ?? null,
        time: msg.time ?? null,
        doorbell: msg.doorbell ?? false,
      };
      const line = `event: ${msg.type}
data: ${JSON.stringify(payload)}

`;
      for (const res of sseClients) res.write(line);
    });
  }

  const viewerOf = (url) => (url.searchParams.get('as') === 'person' ? 'person' : 'family');

  async function route(req, res, url) {
    const { pathname } = url;
    const { hub, demo } = ctx;
    if (!hub && pathname.startsWith('/api/')) {
      return send(res, 503, { ok: false, error: 'Hearthbeat is still starting. Try again in a moment.' }, { 'Retry-After': '1' });
    }

    if (req.method === 'POST' && pathname === '/webhooks/ring') {
      const raw = await readBody(req);
      const out = receive(raw, req.headers['x-signature']);
      return send(res, out.status, out.body);
    }

    if (req.method === 'GET' && pathname === '/api/state') {
      const viewer = viewerOf(url);
      if (viewer === 'family') hub.recordFamilyView();
      return send(res, 200, buildSnapshot(hub, demo, viewer));
    }

    if (req.method === 'GET' && pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        ...SECURITY_HEADERS,
      });
      res.write(': connected\n\n');
      sseClients.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
      req.on('close', () => {
        clearInterval(ping);
        sseClients.delete(res);
      });
      return undefined;
    }

    if (req.method === 'POST' && pathname === '/api/nudge') {
      const out = await hub.nudge(hub.caregiverName);
      return send(res, 200, { ok: true, sound: out.sound });
    }

    if (req.method === 'POST' && pathname === '/api/sharing') {
      const body = await readJson(req);
      if (typeof body.on !== 'boolean') throw new HubError('bad-request', '"on" must be true or false', 400);
      hub.setSharing(body.on);
      return send(res, 200, { ok: true, sharing: hub.sharing });
    }

    if (req.method === 'POST' && pathname === '/api/forget') {
      hub.forget();
      return send(res, 200, { ok: true });
    }

    if (pathname.startsWith('/api/demo/')) {
      if (!demo) throw new HubError('not-demo', 'Demo controls are only available in demo mode', 404);
      return demoRoute(req, res, pathname.slice('/api/demo/'.length));
    }

    if (req.method === 'GET') return serveStatic(res, pathname);
    return send(res, 404, { error: 'Not found' });
  }

  async function demoRoute(req, res, action) {
    const demo = ctx.demo;
    if (req.method !== 'POST') throw new HubError('method', 'Use POST', 405);
    const body = await readJson(req);
    try {
      switch (action) {
        case 'play':
          demo.setRunning(body.running !== false);
          break;
        case 'rate':
          demo.setRate(Number(body.rate));
          break;
        case 'jump':
          await demo.jumpTo(Number(body.minute));
          break;
        case 'scenario':
          await demo.resetDay(String(body.id));
          break;
        case 'trigger':
          await demo.trigger(String(body.id));
          break;
        case 'offline':
          await demo.setOffline(String(body.deviceId), body.offline !== false);
          break;
        default:
          throw new HubError('not-found', 'Unknown demo action', 404);
      }
    } catch (err) {
      if (err instanceof RangeError) throw new HubError('bad-request', err.message, 400);
      throw err;
    }
    return send(res, 200, { ok: true, demo: demo.describe() });
  }

  async function serveStatic(res, pathname) {
    const rel = pathname === '/' ? '/index.html' : pathname;
    const full = normalize(join(publicDir, rel));
    if (!full.startsWith(publicDir + sep) && full !== publicDir) return send(res, 403, 'Forbidden');
    try {
      const data = await readFile(full);
      res.writeHead(200, {
        'Content-Type': MIME[extname(full)] ?? 'application/octet-stream',
        ...SECURITY_HEADERS,
      });
      return res.end(data);
    } catch {
      return send(res, 404, 'Not found');
    }
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      await route(req, res, url);
    } catch (err) {
      if (err instanceof HubError) {
        return send(res, err.status, { ok: false, code: err.code, error: err.message, retryInSeconds: err.retryInSeconds });
      }
      console.error('[http] unexpected error:', err);
      return send(res, 500, { ok: false, error: 'Something went wrong on our side.' });
    }
  });
  server.on('close', () => {
    for (const res of sseClients) res.end();
  });
  server.attach = attach;
  return server;
}
