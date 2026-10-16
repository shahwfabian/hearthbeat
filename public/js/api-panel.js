import { h, icon } from './dom.js';

/**
 * "Under the hood": the Ring API calls and webhooks this page is running on,
 * live. Metadata only (no tokens, no bodies). In demo mode the banner says, in
 * plain words, that the API is our own simulation and not Ring.
 */
export function renderApiPanel(api) {
  const { target, log } = api;
  const simulated = target?.simulated !== false;

  const head = h(
    'p',
    { class: simulated ? 'api-target api-sim' : 'api-target api-live' },
    simulated ? 'SIMULATED' : 'LIVE',
    h('span', {}, ' ', target?.label ?? 'Ring Partner API'),
    h('code', {}, target?.host ?? ''),
  );

  const rows = log.length
    ? h(
        'ol',
        { class: 'api-log', 'aria-label': 'Recent Ring API calls and webhooks, newest first' },
        log.map((e) =>
          h(
            'li',
            { class: 'api-row', 'data-dir': e.dir },
            h('time', { class: 'api-time' }, e.time),
            h('span', { class: 'api-dir', title: e.dir === 'out' ? 'Hearthbeat calls Ring' : 'Ring calls Hearthbeat' }, e.dir === 'out' ? 'to Ring' : 'from Ring'),
            h('code', { class: 'api-call' }, `${e.method} ${e.path}`),
            h('span', { class: statusClass(e.status) }, String(e.status || 'error')),
            h('span', { class: 'api-note' }, [e.detail, e.note, e.ms !== null && e.ms !== undefined ? `${e.ms} ms` : ''].filter(Boolean).join(' · ')),
          ),
        ),
      )
    : h('p', { class: 'empty' }, 'No calls yet.');

  return h(
    'section',
    { class: 'card area-api', 'aria-labelledby': 'api-title' },
    h('h2', { id: 'api-title' }, icon('shield'), ' Under the hood: Ring API calls'),
    h('p', { class: 'card-sub' }, 'Every request this page depends on, as it happens. Tokens and message bodies are never shown or stored.'),
    head,
    rows,
  );
}

function statusClass(status) {
  if (!status) return 'api-status api-bad';
  return status >= 400 ? 'api-status api-bad' : 'api-status api-ok';
}
