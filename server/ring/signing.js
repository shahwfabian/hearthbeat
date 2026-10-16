import { createHmac, timingSafeEqual } from 'node:crypto';

const PREFIX = 'sha256=';

/**
 * Compute the value of the `X-Signature` header Ring sends with every webhook:
 * `sha256=` + lowercase hex HMAC-SHA256 of the raw request body, keyed with the
 * partner HMAC signing key.
 *
 * @param {string} key  HMAC signing key issued at partner onboarding
 * @param {Buffer|string} rawBody  the body bytes exactly as received
 */
export function signBody(key, rawBody) {
  const digest = createHmac('sha256', key).update(rawBody).digest('hex');
  return PREFIX + digest;
}

/**
 * Verify an `X-Signature` header in constant time.
 * Pass the RAW body: re-serialised JSON changes whitespace and key order and
 * will never match.
 */
export function verifySignature(key, rawBody, header) {
  if (!key || typeof header !== 'string' || !header) return false;
  const received = header.startsWith(PREFIX) ? header.slice(PREFIX.length) : header;
  const expected = signBody(key, rawBody).slice(PREFIX.length);
  const a = Buffer.from(received, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
