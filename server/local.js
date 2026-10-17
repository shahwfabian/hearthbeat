import { DemoRuntime } from './sim/runtime.js';
import { memoryTransport } from './sim/memory-transport.js';
import { eventPayload, handleApi } from './api.js';
import { HubError } from './hub.js';

/**
 * The whole app, running in one place with no server: the demo world, the Ring
 * client, the webhook receiver, the Hub and the application API, all in memory.
 * This is what the hosted (Vercel) demo runs inside each visitor's browser tab,
 * so every visitor gets a private household and nothing is sent anywhere.
 *
 * It has no Node dependencies and is exercised by the Node test suite.
 *
 * @param {{ tz?: string }} [opts]
 */
export async function createLocalBackend({ tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } = {}) {
  const demo = new DemoRuntime({ tz, transport: memoryTransport });
  await demo.start();
  const ctx = { hub: demo.hub, demo };

  return {
    demo,
    hub: demo.hub,

    /**
     * Same contract as the HTTP API: `{ status, body }`, errors included.
     * @param {string} method @param {string} pathname @param {'family'|'person'} viewer @param {any} body
     */
    async request(method, pathname, viewer = 'family', body = {}) {
      try {
        const out = await handleApi(ctx, { method, pathname, viewer, getBody: async () => body ?? {} });
        return out ?? { status: 404, body: { ok: false, error: 'Not found' } };
      } catch (err) {
        if (err instanceof HubError) {
          return { status: err.status, body: { ok: false, code: err.code, error: err.message, retryInSeconds: err.retryInSeconds } };
        }
        throw err;
      }
    },

    /** Live updates, in the same shape the server-sent events carry. */
    subscribe(fn) {
      return demo.hub.subscribe((msg) => fn(eventPayload(msg)));
    },

    stop() {
      demo.stop();
    },
  };
}
