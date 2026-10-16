import { h, icon } from './dom.js';

/** Today's events in plain words, newest first. */
export function renderTimeline(rows) {
  if (!rows.length) {
    return h('p', { class: 'empty' }, 'Nothing yet today. Quiet is normal early in the morning.');
  }
  return h(
    'ul',
    { class: 'timeline', 'aria-label': 'Today so far, newest first' },
    rows.map((r) =>
      h(
        'li',
        { class: 'tl-row', 'data-role': r.role },
        h('span', { class: 'tl-icon' }, icon(r.icon)),
        h('span', { class: 'tl-text' }, r.text),
        h('time', { class: 'tl-time' }, r.time),
      ),
    ),
  );
}
