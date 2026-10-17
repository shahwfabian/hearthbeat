import { createServer } from 'node:http';
import { createMockHandler } from './mock-handler.js';

/**
 * Serve the mock Ring API over real HTTP on a local port (demo mode in Node).
 * All behaviour lives in `mock-handler.js`, which has no Node dependencies, so
 * the hosted browser demo can run the very same logic in memory.
 *
 * @param {import('./world.js').DemoWorld} world
 * @param {{ token?: string, onPlayback?: (entry: object) => void }} [opts]
 */
export function createMockRingApi(world, opts = {}) {
  const handle = createMockHandler(world, opts);
  return createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const out = await handle({
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization,
      bodyText: Buffer.concat(chunks).toString('utf8'),
    });
    res.writeHead(out.status, { 'Content-Type': 'application/vnd.api+json' });
    res.end(JSON.stringify(out.body));
  });
}
