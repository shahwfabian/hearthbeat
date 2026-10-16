#!/usr/bin/env node
/**
 * Renders docs/thumbnail.svg to docs/thumbnail.png (1500 x 1000) using a
 * locally installed Chromium-based browser in headless mode. No npm packages.
 *
 *   node scripts/render-thumbnail.js [path-to-browser]
 *
 * Looks for Microsoft Edge, Google Chrome or Chromium in the usual places, or
 * uses the path you pass (or the BROWSER environment variable).
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  process.argv[2],
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const browser = candidates.find((p) => existsSync(p));
if (!browser) {
  console.error('No Chromium-based browser found. Pass its path: node scripts/render-thumbnail.js <path>');
  process.exit(1);
}

const svg = pathToFileURL(resolve(root, 'docs/thumbnail.svg')).href;
const out = resolve(root, 'docs/thumbnail.png');
const r = spawnSync(
  browser,
  ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1500,1000', '--timeout=4000', `--screenshot=${out}`, svg],
  { encoding: 'utf8', timeout: 60_000 },
);
if (r.status !== 0 || !existsSync(out)) {
  console.error(r.stderr || 'Rendering failed');
  process.exit(1);
}
console.log('wrote docs/thumbnail.png');
