import { h, icon, clear, store } from './dom.js';
import { ApiError, post } from './api.js';
import { toast } from './toast.js';

const RATE_LABELS = { 2: 'Slow', 6: 'Normal', 20: 'Fast', 60: 'Zoom' };
const JUMPS = [
  { minute: 7 * 60, label: '7 AM' },
  { minute: 9 * 60, label: '9 AM' },
  { minute: 10 * 60 + 30, label: '10:30 AM' },
  { minute: 13 * 60, label: '1 PM' },
  { minute: 17 * 60 + 30, label: '5:30 PM' },
  { minute: 21 * 60, label: '9 PM' },
];

async function call(path, body) {
  try {
    await post(path, body);
  } catch (err) {
    toast(err instanceof ApiError ? err.message : 'The demo controls could not reach the server.', 'warn');
  }
}

/**
 * The presenter dock. Everything here controls the SIMULATION: the clock, the
 * scenario, and things that "happen" at Margaret's house. The family and
 * person views above it are the real product.
 */
export function createDock(host) {
  let built = false;
  const refs = {};
  let collapsed = store.get('hearthbeat.dock') === 'collapsed';

  function build(demo, insideIds) {
    clear(host);
    refs.clock = h('span', { class: 'dock-clock', 'aria-label': 'Simulated time' }, demo.clock);
    refs.play = h('button', { class: 'btn btn-primary play-btn', type: 'button' });
    refs.play.addEventListener('click', () => call('/api/demo/play', { running: !refs.running }));

    refs.rates = h(
      'div',
      { class: 'chips', role: 'radiogroup', 'aria-label': 'Speed' },
      demo.rates.map((r) =>
        h('button', { class: 'chip', type: 'button', role: 'radio', 'data-rate': r, onclick: () => call('/api/demo/rate', { rate: r }) }, RATE_LABELS[r] ?? `${r}x`),
      ),
    );

    refs.scenarios = h(
      'div',
      { class: 'chips', role: 'group', 'aria-label': 'Scenario' },
      demo.scenarios.map((s) =>
        h('button', { class: 'chip', type: 'button', 'data-id': s.id, 'aria-pressed': 'false', onclick: () => call('/api/demo/scenario', { id: s.id }) }, s.label),
      ),
    );
    refs.blurb = h('p', { class: 'scenario-blurb' });

    refs.jumps = h(
      'div',
      { class: 'chips', role: 'group', 'aria-label': 'Jump to a time' },
      JUMPS.map((j) => h('button', { class: 'chip', type: 'button', 'data-minute': j.minute, onclick: () => call('/api/demo/jump', { minute: j.minute }) }, j.label)),
    );

    refs.triggers = h(
      'div',
      { class: 'chips', role: 'group', 'aria-label': 'Make something happen' },
      demo.triggers.map((t) => h('button', { class: 'chip chip-action', type: 'button', onclick: () => call('/api/demo/trigger', { id: t.id }) }, t.label)),
      h('button', {
        class: 'chip',
        type: 'button',
        'aria-pressed': 'false',
        'data-offline': 'inside',
        onclick: () => {
          const off = refs.insideOffline;
          return Promise.all(insideIds.map((id) => call('/api/demo/offline', { deviceId: id, offline: !off })));
        },
      }, 'Cameras offline'),
    );

    refs.toggle = h('button', { class: 'btn btn-quiet dock-toggle', type: 'button', 'aria-expanded': String(!collapsed) }, collapsed ? 'Show controls' : 'Hide controls');
    refs.toggle.addEventListener('click', () => {
      collapsed = !collapsed;
      store.set('hearthbeat.dock', collapsed ? 'collapsed' : 'open');
      host.dataset.collapsed = String(collapsed);
      refs.toggle.textContent = collapsed ? 'Show controls' : 'Hide controls';
      refs.toggle.setAttribute('aria-expanded', String(!collapsed));
    });

    host.dataset.collapsed = String(collapsed);
    host.append(
      h(
        'div',
        { class: 'dock-inner' },
        h(
          'div',
          { class: 'dock-row' },
          h('span', { class: 'dock-title' }, 'Demo director'),
          h('span', { class: 'dock-sim' }, 'Simulated Ring data'),
          refs.clock,
          refs.play,
          refs.rates,
          refs.toggle,
        ),
        h(
          'div',
          { class: 'dock-body' },
          h('div', { class: 'dock-row' }, h('span', { class: 'dock-title' }, 'Day'), refs.scenarios, refs.blurb),
          h('div', { class: 'dock-row' }, h('span', { class: 'dock-title' }, 'Skip to'), refs.jumps),
          h('div', { class: 'dock-row' }, h('span', { class: 'dock-title' }, 'Make it happen'), refs.triggers),
        ),
      ),
    );
    built = true;
  }

  return {
    /** Create or refresh the dock from the server's `demo` description. */
    sync(demo, devices) {
      host.hidden = false;
      const insideIds = devices.filter((d) => d.role === 'inside').map((d) => d.id);
      if (!built) build(demo, insideIds);

      refs.running = demo.running;
      refs.clock.textContent = demo.clock;
      clear(refs.play).append(icon(demo.running ? 'pause' : 'play'), demo.running ? 'Pause' : 'Play day');
      refs.play.setAttribute('aria-label', demo.running ? 'Pause the simulated day' : 'Play the simulated day');

      for (const b of refs.rates.children) b.setAttribute('aria-checked', String(Number(b.dataset.rate) === demo.rate));
      for (const b of refs.scenarios.children) b.setAttribute('aria-pressed', String(b.dataset.id === demo.scenario));
      const current = demo.scenarios.find((s) => s.id === demo.scenario);
      refs.blurb.textContent = current ? current.blurb : '';
      for (const b of refs.jumps.children) b.disabled = Number(b.dataset.minute) <= demo.minute;

      refs.insideOffline = insideIds.length > 0 && insideIds.every((id) => demo.offline.includes(id));
      const offBtn = refs.triggers.querySelector('[data-offline]');
      offBtn.setAttribute('aria-pressed', String(refs.insideOffline));
    },
  };
}
