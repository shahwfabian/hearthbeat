/**
 * Small seeded random number generator (mulberry32). The household simulator
 * must be deterministic: the same seed always produces the same "day", so demos
 * are repeatable and tests never flake.
 */

export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    /** Float in [0, 1) */
    next,
    /** Integer in [min, max] inclusive */
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    /** True with probability p */
    chance: (p) => next() < p,
    /** Pick one element */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

/** Turn any string into a numeric seed (FNV-1a). */
export function seedFrom(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
