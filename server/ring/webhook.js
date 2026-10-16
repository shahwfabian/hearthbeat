import { WEBHOOK_KIND } from '../core/events.js';

/**
 * Reasons a webhook body can be rejected. Ring treats 4xx as a permanent
 * failure (no retry), so only genuinely malformed payloads get one.
 */
export class WebhookError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WebhookError';
  }
}

/**
 * Turn a parsed Ring v1.1 webhook document into a HomeEvent.
 *
 * Envelope (from the Ring Partner API docs):
 *   meta: { version, time, request_id, account_id }
 *   data: { id, type, attributes: { source, source_type, timestamp, sub_type? }, relationships }
 *
 * `sub_type` is an open vocabulary, so unknown values are passed through.
 *
 * @returns {{ requestId: string, accountId: string|null, event: import('../core/events.js').HomeEvent, rawType: string }}
 */
export function parseWebhook(doc) {
  if (!doc || typeof doc !== 'object') throw new WebhookError('Body is not a JSON object');
  const { meta, data } = doc;
  if (!meta || typeof meta !== 'object') throw new WebhookError('Missing meta');
  if (!data || typeof data !== 'object') throw new WebhookError('Missing data');
  if (typeof meta.request_id !== 'string' || !meta.request_id) {
    throw new WebhookError('Missing meta.request_id');
  }
  if (typeof data.type !== 'string' || !data.type) throw new WebhookError('Missing data.type');
  const attrs = data.attributes;
  if (!attrs || typeof attrs !== 'object') throw new WebhookError('Missing data.attributes');
  if (typeof attrs.source !== 'string' || !attrs.source) {
    throw new WebhookError('Missing attributes.source');
  }

  const ts = Number(attrs.timestamp);
  if (!Number.isFinite(ts)) throw new WebhookError('attributes.timestamp is not a number');

  const kind = WEBHOOK_KIND[data.type];
  if (!kind) throw new WebhookError(`Unsupported event type: ${data.type}`);

  const event = {
    id: typeof data.id === 'string' && data.id ? data.id : `${attrs.source}_${data.type}_${ts}`,
    ts,
    deviceId: attrs.source,
    kind,
    source: 'webhook',
  };
  if (typeof attrs.sub_type === 'string' && attrs.sub_type) event.subType = attrs.sub_type;

  return {
    requestId: meta.request_id,
    accountId: typeof meta.account_id === 'string' ? meta.account_id : null,
    event,
    rawType: data.type,
  };
}

/**
 * Bounded memory of recently seen `meta.request_id` values. Ring retries
 * failed deliveries up to six times, so the same request can arrive again.
 */
export class IdempotencyCache {
  constructor(limit = 1000) {
    this.limit = limit;
    this.seen = new Set();
  }

  /** Returns true the first time an id is seen, false for repeats. */
  claim(requestId) {
    if (this.seen.has(requestId)) return false;
    this.seen.add(requestId);
    if (this.seen.size > this.limit) {
      // Sets iterate in insertion order, so the first key is the oldest.
      this.seen.delete(this.seen.values().next().value);
    }
    return true;
  }
}
