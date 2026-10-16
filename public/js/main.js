import { clear, store } from './dom.js';
import { connectEvents, getState } from './api.js';
import { createRing } from './ring-clock.js';
import { createFamilyView } from './family-view.js';
import { createPersonView } from './person-view.js';
import { createDock } from './dock.js';
import { showVisitor } from './doorbell.js';
import { toast } from './toast.js';

const viewHost = document.getElementById('view');
const tabs = {
  family: document.getElementById('tab-family'),
  person: document.getElementById('tab-person'),
};
const badge = document.getElementById('mode-badge');
const intro = document.getElementById('intro');
const dock = createDock(document.getElementById('dock'));

const ring = createRing();
const views = { family: createFamilyView(ring), person: createPersonView() };

let viewer = store.get('hearthbeat.viewer') === 'person' ? 'person' : 'family';
let lastState = null;
let inflight = false;
let dirty = false;
let timer = null;
let offlineToastShown = false;

function paintTabs(state) {
  tabs.family.textContent = `${state.caregiver.name}'s view`;
  tabs.person.textContent = `${state.person.name}'s view`;
  for (const [name, el] of Object.entries(tabs)) {
    const selected = name === viewer;
    el.setAttribute('aria-selected', String(selected));
    el.tabIndex = selected ? 0 : -1;
  }
}

function paintBadge(state) {
  if (state.mode === 'demo') {
    badge.textContent = 'Simulated demo';
    badge.hidden = false;
  } else {
    badge.textContent = 'Live Ring account';
    badge.hidden = false;
  }
}

function render(state) {
  paintTabs(state);
  paintBadge(state);
  const view = views[viewer];
  // Re-render the active view only; the other is rebuilt when selected.
  if (viewHost.firstChild !== view.element) {
    clear(viewHost).append(view.element);
  }
  view.render(state);
  if (state.demo) dock.sync(state.demo, state.devices);
  if (viewer === 'family') document.title = `${state.status.headline} · Hearthbeat`;
  else document.title = `${state.person.name}'s page · Hearthbeat`;
}

async function refresh() {
  if (inflight) {
    dirty = true;
    return;
  }
  inflight = true;
  try {
    lastState = await getState(viewer);
    render(lastState);
  } catch {
    toast('Could not reach Hearthbeat. Retrying…', 'warn');
  } finally {
    inflight = false;
    if (dirty) {
      dirty = false;
      schedule();
    }
  }
}

/** Coalesce bursts of events (a skipped hour can deliver dozens) into one refresh. */
function schedule(delay = 120) {
  clearTimeout(timer);
  timer = setTimeout(refresh, delay);
}

function selectViewer(next, focus = false) {
  if (next === viewer) return;
  viewer = next;
  store.set('hearthbeat.viewer', viewer);
  clear(viewHost);
  if (lastState) paintTabs(lastState);
  if (focus) tabs[viewer].focus();
  refresh();
}

tabs.family.addEventListener('click', () => selectViewer('family'));
tabs.person.addEventListener('click', () => selectViewer('person'));
for (const el of Object.values(tabs)) {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      selectViewer(viewer === 'family' ? 'person' : 'family', true);
    }
  });
}

if (store.get('hearthbeat.intro') !== 'seen') {
  intro.hidden = false;
  document.getElementById('intro-close').addEventListener('click', () => {
    intro.hidden = true;
    store.set('hearthbeat.intro', 'seen');
  });
}

connectEvents(
  (msg) => {
    if (msg.type === 'visitor') showVisitor(msg);
    if (msg.type === 'nudge' && viewer === 'person' && lastState) {
      toast(`${lastState.caregiver.name} sent you a gentle chime. Nothing to do, it is just hello.`, 'ok', 8000);
    }
    schedule(msg.type === 'clock' ? 300 : 120);
  },
  (connected) => {
    if (connected) {
      if (offlineToastShown) toast('Live updates are back.', 'ok', 2500);
      offlineToastShown = false;
      schedule(0);
    } else if (!offlineToastShown) {
      offlineToastShown = true;
      toast('Live updates paused. Reconnecting…', 'warn', 4000);
    }
  },
);

refresh();
