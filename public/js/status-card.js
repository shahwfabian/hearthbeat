import { h, icon } from './dom.js';

/** The view is redrawn on every live update, so remember whether the reader opened the explanation. */
let whyOpen = false;

const PILL = {
  typical: { icon: 'check', label: 'All looks usual' },
  quiet: { icon: 'clock', label: 'Quieter than usual' },
  checkin: { icon: 'phone', label: 'Worth a call' },
  learning: { icon: 'clock', label: 'Getting to know them' },
  blind: { icon: 'plug', label: "Can't see right now" },
  paused: { icon: 'pause', label: 'Sharing paused' },
};

/**
 * The one answer: how is today going? Words and an icon carry the meaning, never
 * colour alone. "Why am I seeing this?" shows the exact rule and numbers.
 */
export function renderStatusCard(status, { personName, who }) {
  const pill = PILL[status.level] ?? PILL.typical;
  const card = h(
    'section',
    { class: 'card status', 'data-level': status.level, 'aria-labelledby': 'status-headline' },
    h('span', { class: 'status-pill' }, icon(pill.icon), pill.label),
    h('h2', { class: 'status-headline', id: 'status-headline' }, status.headline),
    h('p', { class: 'status-detail' }, status.detail),
  );

  if (status.context) card.append(h('p', { class: 'note' }, status.context));

  const reasons = status.findings ?? [];
  const learning = status.learning;
  const items = reasons.map((f) => h('li', {}, f.why));
  if (status.level === 'typical' || status.level === 'learning') {
    items.push(
      h('li', {}, `Usual rhythm learned from ${learning.daysObserved} recent day${learning.daysObserved === 1 ? '' : 's'} of Ring activity.`),
    );
  }
  if (items.length) {
    card.append(
      h(
        'details',
        { class: 'why', open: whyOpen, ontoggle: (e) => { whyOpen = e.target.open; } },
        h('summary', {}, 'Why am I seeing this?'),
        h('ul', { class: 'why-list' }, items),
      ),
    );
  }

  card.append(
    h(
      'p',
      { class: 'disclaimer' },
      who === 'person'
        ? `This is exactly what the family sees about ${personName === 'You' ? 'you' : personName}. It is not a medical alert.`
        : 'Hearthbeat notices changes in routine. It cannot tell whether someone is well, and it is not a medical alert or emergency service.',
    ),
  );
  return card;
}
