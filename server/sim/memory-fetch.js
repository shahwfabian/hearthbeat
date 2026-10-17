/**
 * A `fetch` replacement that answers from the mock Ring API in memory, with no
 * network and no server. The hosted browser demo uses it so the real RingClient
 * runs unchanged: it still builds URLs, sets the bearer header, retries and
 * parses JSON:API; only the transport is swapped.
 *
 * @param {(req: { method: string, url: string, authorization?: string, bodyText?: string }) => Promise<{ status: number, body: object }>} handle
 * @returns {typeof fetch}
 */
export function memoryFetch(handle) {
  return async (input, init = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers ?? {});
    const out = await handle({
      method: init.method ?? 'GET',
      url: url.pathname + url.search,
      authorization: headers.get('authorization') ?? undefined,
      bodyText: init.body ? String(init.body) : '',
    });
    return new Response(JSON.stringify(out.body), {
      status: out.status,
      headers: { 'Content-Type': 'application/vnd.api+json' },
    });
  };
}
