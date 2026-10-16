import { h, icon, clear } from './dom.js';
import { renderStatusCard } from './status-card.js';
import { renderTimeline } from './timeline.js';
import { confirmAction } from './confirm.js';
import { ApiError, post } from './api.js';
import { flashEnabled, setFlash } from './doorbell.js';
import { toast } from './toast.js';

/**
 * The view for the person being cared for. It shows everything the family can
 * see, who has looked, and puts the controls in their hands: pause sharing,
 * delete everything. Ring's content policy requires that customers can easily
 * see monitoring activity; this is that, front and centre.
 */
export function createPersonView() {
  const root = h('div', { class: 'view-grid' });

  async function run(action, okMessage) {
    try {
      await action();
      if (okMessage) toast(okMessage, 'ok');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not reach Hearthbeat. Please try again.', 'warn', 7000);
    }
  }

  function render(state) {
    const { person, caregiver, sharing, status, privacy } = state;
    clear(root);

    const intro = h(
      'section',
      { class: 'card area-ring' },
      h('h2', {}, `Hello ${person.name}. This is your page.`),
      h(
        'p',
        { class: 'card-sub' },
        `${caregiver.name} uses Hearthbeat to see whether your day looks like a usual day. Everything ${caregiver.name} can see is on this page, and you are in charge of it.`,
      ),
    );

    const toggle = h(
      'button',
      {
        class: 'big-toggle',
        type: 'button',
        role: 'switch',
        'aria-checked': String(sharing.on),
        onclick: async () => {
          if (sharing.on) {
            const ok = await confirmAction({
              title: 'Pause sharing?',
              body: `${caregiver.name} will see only that sharing is paused. Hearthbeat will stop keeping new activity until you turn sharing back on. You can resume at any time.`,
              confirmLabel: 'Pause sharing',
            });
            if (!ok) return;
          }
          await run(() => post('/api/sharing', { on: !sharing.on }), sharing.on ? 'Sharing paused.' : 'Sharing resumed.');
        },
      },
      h('span', { class: 'knob' }, icon(sharing.on ? 'check' : 'pause')),
      h('span', {}, sharing.on ? `Sharing with ${caregiver.name}: On` : `Sharing with ${caregiver.name}: Paused`),
    );
    intro.append(
      h('div', { class: 'switch-row' }, toggle),
      sharing.on
        ? null
        : h('p', { class: 'hint' }, `Paused. ${sharing.dropped} thing${sharing.dropped === 1 ? '' : 's'} that happened since then ${sharing.dropped === 1 ? 'was' : 'were'} not kept.`),
    );
    root.append(intro);

    const seen = renderStatusCard(status, { personName: person.name, who: 'person' });
    seen.classList.add('area-status');
    root.append(seen);

    const lists = h(
      'section',
      { class: 'card area-nudge', 'aria-labelledby': 'priv-title' },
      h('h2', { id: 'priv-title' }, 'What Hearthbeat uses, and never uses'),
      h(
        'div',
        { class: 'two-col' },
        h('div', {}, h('h3', {}, 'Uses'), h('ul', { class: 'list-ok' }, privacy.collects.map((t) => h('li', {}, icon('check'), t)))),
        h(
          'div',
          {},
          h('h3', {}, 'Never uses'),
          h('ul', { class: 'list-no' }, privacy.never.map((t) => h('li', {}, icon('shield'), t))),
        ),
      ),
    );
    root.append(lists);

    const log = h(
      'section',
      { class: 'card area-timeline', 'aria-labelledby': 'log-title' },
      h('h2', { id: 'log-title' }, 'Who looked, and what they did'),
      state.accessLog.length
        ? h(
            'ul',
            { class: 'log', 'aria-label': 'Access log, newest first' },
            state.accessLog.map((e) =>
              h(
                'li',
                {},
                h('time', { class: 'when' }, e.time),
                h('span', {}, `${e.who} ${e.action}`, e.detail ? h('span', { class: 'detail' }, e.detail) : null),
              ),
            ),
          )
        : h('p', { class: 'empty' }, `No one has looked yet. Anything ${caregiver.name} does will appear here.`),
    );
    root.append(log);

    const controls = h(
      'section',
      { class: 'card area-more', 'aria-labelledby': 'ctl-title' },
      h('h2', { id: 'ctl-title' }, 'Your controls'),
      h(
        'div',
        { class: 'control-list' },
        h(
          'label',
          { class: 'check-row' },
          h('input', {
            type: 'checkbox',
            checked: flashEnabled(),
            onchange: (e) => setFlash(e.target.checked),
          }),
          h('span', {}, h('strong', {}, 'Flash the screen when someone rings'), h('small', {}, 'The visual doorbell. Turn off if flashing bothers you.')),
        ),
        h(
          'button',
          {
            class: 'btn btn-danger',
            type: 'button',
            onclick: async () => {
              const ok = await confirmAction({
                title: 'Delete everything Hearthbeat remembers?',
                body: 'This erases every remembered event and the learned usual day. Hearthbeat will start learning again from today.',
                confirmLabel: 'Delete it all',
              });
              if (ok) await run(() => post('/api/forget'), 'Everything was deleted.');
            },
          },
          'Delete everything Hearthbeat remembers',
        ),
      ),
    );
    root.append(controls);

    if (state.timeline.length) {
      root.append(
        h(
          'section',
          { class: 'card area-more', 'aria-labelledby': 'mytl-title' },
          h('h2', { id: 'mytl-title' }, 'Today, in plain words'),
          renderTimeline(state.timeline),
        ),
      );
    }
  }

  return { element: root, render };
}
