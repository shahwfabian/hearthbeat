import { verifySignature } from './signing.js';
import { IdempotencyCache, WebhookError, parseWebhook } from './webhook.js';

/**
 * Build the function that handles one inbound Ring webhook.
 *
 * Order matters, and follows Ring's guidance: verify the signature over the RAW
 * bytes first, parse second, de-duplicate on `meta.request_id`, then hand the
 * event to the hub and answer quickly (Ring gives us 5 seconds).
 *
 * Status codes: Ring treats 4xx as permanent (no retry) and may disable an
 * endpoint that keeps returning them, so only a bad signature or a genuinely
 * malformed body gets a 4xx. Event types we do not use are acknowledged with 200.
 *
 * @param {{ key: string|undefined, hub: { ingest(ev: object): boolean } }} opts
 * @returns {(rawBody: Buffer, signature: string|undefined) => { status: number, body: object }}
 */
export function createWebhookReceiver({ key, hub, onDelivery = null }) {
  const seen = new IdempotencyCache();
  const report = (out, note, eventType) => {
    try {
      onDelivery?.({ status: out.status, note, eventType });
    } catch {
      /* observers never affect the response */
    }
    return out;
  };
  return function receive(rawBody, signature) {
    if (!key) {
      return report({ status: 503, body: { error: 'Webhook receiving is not configured (no signing key)' } }, 'no signing key configured');
    }
    if (!verifySignature(key, rawBody, signature)) {
      return report({ status: 401, body: { error: 'Invalid signature' } }, 'signature rejected');
    }
    let doc;
    try {
      doc = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return report({ status: 400, body: { error: 'Body is not valid JSON' } }, 'signature ok, body not JSON');
    }
    let parsed;
    try {
      parsed = parseWebhook(doc);
    } catch (err) {
      if (err instanceof WebhookError && err.code === 'unsupported-type') {
        return report({ status: 200, body: { status: 'ignored', reason: err.message } }, 'signature verified, event type not used');
      }
      return report({ status: 400, body: { error: err.message } }, 'signature ok, payload malformed');
    }
    if (!seen.claim(parsed.requestId)) {
      return report({ status: 200, body: { status: 'already_processed' } }, 'signature verified, duplicate request_id', parsed.rawType);
    }
    const kept = hub.ingest(parsed.event);
    return report({ status: 200, body: { status: kept ? 'processed' : 'ignored' } }, kept ? 'signature verified, event kept' : 'signature verified, event not kept', parsed.rawType);
  };
}
