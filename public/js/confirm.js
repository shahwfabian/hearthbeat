/**
 * Ask before anything with consequences. Uses the native <dialog>, which
 * traps focus, closes on Escape, and is announced by screen readers.
 * Resolves to true when the person confirms.
 */
export function confirmAction({ title, body, confirmLabel }) {
  const dialog = document.getElementById('confirm');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-body').textContent = body;
  document.getElementById('confirm-ok').textContent = confirmLabel;
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
    dialog.returnValue = 'cancel';
    dialog.showModal();
  });
}
