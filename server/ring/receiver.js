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
export function createWebhookReceiver({ key, hub }) {
  const seen = new IdempotencyCache();
  return function receive(rawBody, signature) {
    if (!key) {
      return { status: 503, body: { error: 'Webhook receiving is not configured (no signing key)' } };
    }
    if (!verifySignature(key, rawBody, signature)) {
      return { status: 401, body: { error: 'Invalid signature' } };
    }
    let doc;
    try {
      doc = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return { status: 400, body: { error: 'Body is not valid JSON' } };
    }
    let parsed;
    try {
      parsed = parseWebhook(doc);
    } catch (err) {
      if (err instanceof WebhookError && err.code === 'unsupported-type') {
        return { status: 200, body: { status: 'ignored', reason: err.message } };
      }
      return { status: 400, body: { error: err.message } };
    }
    if (!seen.claim(parsed.requestId)) {
      return { status: 200, body: { status: 'already_processed' } };
    }
    const kept = hub.ingest(parsed.event);
    return { status: 200, body: { status: kept ? 'processed' : 'ignored' } };
  };
}
