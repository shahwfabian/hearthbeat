import { h, icon, store, clear } from './dom.js';

const FLASH_KEY = 'hearthbeat.flash';

/** Respect the operating system's "reduce motion" setting unless the person opts in. */
export function flashEnabled() {
  const saved = store.get(FLASH_KEY);
  if (saved === 'on') return true;
  if (saved === 'off') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function setFlash(on) {
  store.set(FLASH_KEY, on ? 'on' : 'off');
}

let hideTimer = null;

/**
 * The visual doorbell: a large, high-contrast banner for anyone who cannot
 * hear the chime. It is an ARIA alert, optionally flashes, and can vibrate a phone.
 */
export function showVisitor({ text, time, doorbell }) {
  const banner = document.getElementById('visitor-banner');
  clear(banner).append(
    icon(doorbell ? 'bell' : 'person'),
    h('div', {}, text, h('span', { class: 'vb-time' }, `at ${time}`)),
    h('button', { class: 'btn', type: 'button', onclick: () => hideVisitor() }, 'Dismiss'),
  );
  banner.hidden = false;
  banner.classList.remove('flash');
  if (flashEnabled()) {
    void banner.offsetWidth; // restart the animation
    banner.classList.add('flash');
  }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideVisitor, 20_000);
}

export function hideVisitor() {
  const banner = document.getElementById('visitor-banner');
  banner.hidden = true;
  banner.classList.remove('flash');
}
