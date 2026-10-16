/**
 * Helpers for the JSON:API compound documents the Ring API returns when you
 * ask for `?include=status,capabilities,configurations,location`.
 *
 * Related resources appear in a top-level `included` array. Match them to a
 * device using the `type` + `id` pair in `relationships.<name>.data`.
 */

/** Build a lookup keyed by `type:id` for a document's `included` array. */
export function indexIncluded(doc) {
  const map = new Map();
  for (const res of doc?.included ?? []) map.set(`${res.type}:${res.id}`, res);
  return map;
}

/**
 * Get the attributes of a related resource, or null when it was not included
 * (resources that were not requested still appear in `relationships` with
 * only links, so absence is normal).
 */
export function relatedAttributes(index, resource, relName) {
  const ref = resource?.relationships?.[relName]?.data;
  if (!ref || Array.isArray(ref)) return null;
  return index.get(`${ref.type}:${ref.id}`)?.attributes ?? null;
}
