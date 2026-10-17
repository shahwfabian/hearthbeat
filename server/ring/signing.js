import { hmacSha256, toHex } from './sha256.js';

const PREFIX = 'sha256=';
const enc = new TextEncoder();

const bytes = (v) => (typeof v === 'string' ? enc.encode(v) : v);

/**
 * Compute the value of the `X-Signature` header Ring sends with every webhook:
 * `sha256=` + lowercase hex HMAC-SHA256 of the raw request body, keyed with the
 * partner HMAC signing key.
 *
 * Uses the dependency-free HMAC in `sha256.js` so the very same code runs in
 * Node and in the browser (the hosted demo); it is tested against `node:crypto`.
 *
 * @param {string} key  HMAC signing key issued at partner onboarding
 * @param {Uint8Array|string} rawBody  the body bytes exactly as received
 */
export function signBody(key, rawBody) {
  return PREFIX + toHex(hmacSha256(bytes(key), bytes(rawBody)));
}

/** Constant-time comparison of two equal-length strings. */
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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
  return safeEqual(received, expected);
}
