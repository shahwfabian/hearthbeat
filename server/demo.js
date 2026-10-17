import { once } from 'node:events';
import { DemoRuntime as BaseDemoRuntime } from './sim/runtime.js';
import { createMockRingApi } from './sim/mock-api.js';

/**
 * Node transport: the mock Ring API on a real local HTTP port, and simulated
 * webhooks delivered to the app's own endpoint as real HTTP posts.
 */
function httpTransport(webhookUrl) {
  return async (runtime) => {
    const api = createMockRingApi(runtime.world, { onPlayback: (entry) => runtime.onPlayback(entry) });
    api.listen(0, '127.0.0.1');
    await once(api, 'listening');
    const baseUrl = `http://127.0.0.1:${api.address().port}`;
    return { baseUrl, host: baseUrl, webhookUrl: webhookUrl(), close: () => api.close() };
  };
}

/** Demo mode in Node. Same behaviour as before the runtime was made environment-neutral. */
export class DemoRuntime extends BaseDemoRuntime {
  /** @param {{ tz: string, webhookUrl: () => string }} opts */
  constructor({ tz, webhookUrl }) {
    super({ tz, transport: httpTransport(webhookUrl) });
  }
}
