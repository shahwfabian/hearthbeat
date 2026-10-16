/**
 * Tiny DOM helpers. Everything is built with createElement and textContent,
 * never innerHTML, so text that came from the server cannot become markup.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * h('button', { class: 'btn', onclick: fn }, 'Label', childNode)
 * `class` sets className, `on*` attaches listeners, `true` adds a bare
 * attribute, `false`/null/undefined skip it.
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  append(el, children);
  return el;
}

/** Create an SVG element in the SVG namespace. */
export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    el.setAttribute(key, String(value));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** An icon from the sprite in index.html. */
export function icon(name, label) {
  const el = svg('svg', { class: 'icon', 'aria-hidden': label ? null : 'true', role: label ? 'img' : null, 'aria-label': label ?? null });
  el.append(svg('use', { href: `#i-${name}` }));
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** localStorage that never throws (private windows, blocked storage). */
export const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable: the page still works */
    }
  },
};
