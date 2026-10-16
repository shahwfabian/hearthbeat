import { h, icon, clear } from './dom.js';
import { renderStatusCard } from './status-card.js';
import { renderTimeline } from './timeline.js';
import { confirmAction } from './confirm.js';
import { ApiError, post } from './api.js';
import { toast } from './toast.js';
import { renderApiPanel } from './api-panel.js';

/**
 * The family member's view: one clear answer, the Rhythm Ring, a way to say
 * hello with a chime, and today in plain words.
 */
export function createFamilyView(ringComponent) {
  const root = h('div', { class: 'view-grid' });

  async function sendChime(state) {
    const ok = await confirmAction({
      title: `Send ${state.person.name} a gentle chime?`,
      body: 'This plays a soft sound on the Ring Chime in their home, like a friendly knock. It does not show or record anything, and they will see in their access log that you sent it.',
      confirmLabel: 'Send chime',
    });
    if (!ok) return;
    try {
      const out = await post('/api/nudge');
      toast(`Sent${out.sound ? ` "${out.sound}"` : ''} to ${state.person.name}'s chime.`, 'ok');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not reach Hearthbeat. Please try again.', 'warn', 7000);
    }
  }

  function render(state) {
    const { status, person } = state;
    clear(root);

    const status$ = renderStatusCard(status, { personName: person.name, who: 'family' });
    status$.classList.add('area-status');
    root.append(status$);

    const ringCard = h('section', { class: 'card area-ring', 'aria-labelledby': 'ring-title' }, h('h2', { id: 'ring-title' }, `${person.name}'s day, as a clock`));
    if (status.ring) {
      ringComponent.update({
        ring: status.ring,
        level: status.level,
        doors: status.visitors,
        name: person.name,
      });
      ringCard.append(h('p', { class: 'card-sub' }, 'The outer band is a usual day. The inner band is today. Point at it to read any half hour.'), ringComponent.element);
    } else {
      ringCard.append(h('p', { class: 'empty' }, `${person.name} has paused sharing, so there is nothing to draw.`));
    }
    root.append(ringCard);

    const nudge = h(
      'section',
      { class: 'card nudge area-nudge', 'aria-labelledby': 'nudge-title' },
      h('h2', { id: 'nudge-title' }, 'Say hello, without a call'),
      h('p', { class: 'hint' }, `Plays a soft sound on ${person.name}'s hallway chime. No video, no listening, nothing recorded.`),
      h(
        'button',
        { class: 'btn btn-warm', type: 'button', disabled: !state.canNudge, onclick: () => sendChime(state) },
        icon('chime'),
        'Send a gentle chime',
      ),
      !state.canNudge ? h('p', { class: 'hint' }, state.sharing.on ? 'No Ring Chime is set up for this home.' : `${person.name} has paused sharing, so chimes are off.`) : null,
    );
    root.append(nudge);

    const today = h(
      'section',
      { class: 'card area-timeline', 'aria-labelledby': 'tl-title' },
      h('h2', { id: 'tl-title' }, 'Today, in plain words'),
      renderTimeline(state.timeline),
    );
    root.append(today);

    if (state.api) root.append(renderApiPanel(state.api));
  }

  return { element: root, render };
}
