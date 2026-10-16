import { h } from './dom.js';

/** Show a short message. kind: 'info' | 'ok' | 'warn'. Announced politely to screen readers. */
export function toast(message, kind = 'info', ms = 5000) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = h('div', { class: 'toast', 'data-kind': kind }, message);
  host.append(el);
  setTimeout(() => el.remove(), ms);
}
