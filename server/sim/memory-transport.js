import { createMockHandler } from './mock-handler.js';
import { memoryFetch } from './memory-fetch.js';
import { createWebhookReceiver } from '../ring/receiver.js';
import { DEMO_HMAC_KEY } from './household.js';

/**
 * In-memory transport for the demo runtime: no server, no network.
 *
 *  - Ring calls go through the real RingClient to the mock API via `memoryFetch`.
 *  - Simulated webhooks are signed with the real HMAC code and handed to the
 *    real webhook receiver (signature check, parsing, replay protection).
 *
 * Used by the hosted browser demo, where each visitor gets a private household
 * living entirely inside their own tab.
 *
 * @param {import('./runtime.js').DemoRuntime} runtime
 */
export async function memoryTransport(runtime) {
  const handle = createMockHandler(runtime.world, { onPlayback: (entry) => runtime.onPlayback(entry) });
  const receive = createWebhookReceiver({
    key: DEMO_HMAC_KEY,
    hub: { ingest: (ev) => (runtime.hub ? runtime.hub.ingest(ev) : false) },
    onDelivery: ({ status, note, eventType }) =>
      runtime.hub?.logApi({ dir: 'in', method: 'POST', path: '/webhooks/ring', status, note, detail: eventType ?? '' }),
  });
  return {
    baseUrl: 'http://mock.ring.local',
    fetchImpl: memoryFetch(handle),
    webhookUrl: 'http://hearthbeat.local/webhooks/ring',
    webhookFetch: async (_url, init) => {
      const out = receive(init.body, init.headers['X-Signature']);
      return new Response(JSON.stringify(out.body), { status: out.status, headers: { 'Content-Type': 'application/json' } });
    },
    host: 'inside this browser tab (no network)',
    label: 'Simulated Ring API: a mock of the documented endpoints running inside this page, not Ring',
    close() {},
  };
}
