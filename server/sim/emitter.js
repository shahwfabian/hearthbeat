import { signBody } from '../ring/signing.js';
import { DEMO_ACCOUNT_ID, DEMO_HMAC_KEY } from './household.js';

const TYPE_FOR_KIND = {
  motion: 'motion_detected',
  doorbell: 'button_press',
  online: 'device_online',
  offline: 'device_offline',
};

/**
 * Build a Ring v1.1 webhook document for a simulated event, matching the
 * envelope in the Ring docs (`meta` + JSON:API `data`).
 *
 * @param {{id:string, ts:number, deviceId:string, kind:string, subType?:string}} ev
 */
export function buildWebhookDocument(ev, { requestId = globalThis.crypto.randomUUID(), now = Date.now() } = {}) {
  const type = TYPE_FOR_KIND[ev.kind];
  if (!type) throw new Error(`No webhook type for kind ${ev.kind}`);
  const attributes = {
    source: ev.deviceId,
    source_type: 'devices',
    timestamp: ev.ts,
    timestamp_readable: new Date(ev.ts).toISOString().replace('T', ' ').slice(0, 19),
  };
  if (ev.kind === 'motion') attributes.sub_type = ev.subType ?? 'motion';
  return {
    meta: {
      version: '1.1',
      time: new Date(now).toISOString(),
      request_id: requestId,
      account_id: DEMO_ACCOUNT_ID,
    },
    data: {
      id: ev.id,
      type,
      attributes,
      relationships: { devices: { links: { self: `/v1/devices/${ev.deviceId}` } } },
    },
  };
}

/**
 * Deliver simulated events to the app's own webhook endpoint exactly the way
 * Ring would: JSON body, `X-Signature: sha256=<hmac of the raw body>`.
 * Because it goes over real HTTP, the app's verification, parsing and
 * de-duplication code is what handles it.
 */
export function createEmitter({ url, key = DEMO_HMAC_KEY, fetchImpl = fetch }) {
  return {
    /**
     * @param {object} ev  world event
     * @param {{ requestId?: string }} [opts]
     * @returns {Promise<number>} HTTP status returned by the app
     */
    async send(ev, opts = {}) {
      const body = JSON.stringify(buildWebhookDocument(ev, opts));
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signBody(key, body),
        },
        body,
        signal: AbortSignal.timeout(5000),
      });
      await res.arrayBuffer();
      return res.status;
    },
  };
}
