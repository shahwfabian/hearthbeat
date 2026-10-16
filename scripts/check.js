#!/usr/bin/env node
/**
 * Project hygiene checks, run by `npm run check` before the tests.
 *
 *  1. Every .js file parses (node --check).
 *  2. The page obeys its own Content Security Policy: no inline <script>, no
 *     style="" attributes, no innerHTML in browser code.
 *  3. No secrets are committed: .env is ignored and .env.example holds only placeholders.
 *  4. Relative links in Markdown files point at files that exist.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const fail = (msg) => problems.push(msg);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'data'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(root);
const rel = (f) => relative(root, f).replaceAll('\\', '/');

// 1. Syntax
for (const f of files.filter((f) => f.endsWith('.js'))) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) fail(`${rel(f)}: syntax error\n${r.stderr.trim()}`);
}

// 2. CSP friendliness
for (const f of files.filter((f) => rel(f).startsWith('public/'))) {
  const text = readFileSync(f, 'utf8');
  if (f.endsWith('.html')) {
    if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(text)) fail(`${rel(f)}: inline <script> is blocked by the CSP`);
    if (/\sstyle\s*=/.test(text)) fail(`${rel(f)}: inline style attribute is blocked by the CSP`);
    if (/\son[a-z]+\s*=/i.test(text)) fail(`${rel(f)}: inline event handler is blocked by the CSP`);
  }
  if (f.endsWith('.js') && /\.innerHTML\s*=|insertAdjacentHTML/.test(text)) {
    fail(`${rel(f)}: use textContent/DOM helpers, not innerHTML`);
  }
}

// 3. Secrets
const gitignore = existsSync(join(root, '.gitignore')) ? readFileSync(join(root, '.gitignore'), 'utf8') : '';
if (!/^\.env$/m.test(gitignore)) fail('.gitignore must ignore .env');
const example = existsSync(join(root, '.env.example')) ? readFileSync(join(root, '.env.example'), 'utf8') : '';
for (const line of example.split(/\r?\n/)) {
  const m = line.match(/^(RING_ACCESS_TOKEN|RING_HMAC_KEY)=(.*)$/);
  if (m && !/^your_.*_here$/.test(m[2])) fail(`.env.example: ${m[1]} must be a placeholder`);
}
if (files.some((f) => rel(f) === '.env')) fail('.env exists in the project tree; it must never be committed');

// 4. Markdown links
for (const f of files.filter((f) => f.endsWith('.md'))) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/\]\((?!https?:|#|mailto:)([^)\s]+)\)/g)) {
    const target = resolve(dirname(f), m[1].split('#')[0]);
    if (!existsSync(target)) fail(`${rel(f)}: broken link ${m[1]}`);
  }
}

if (problems.length) {
  console.error(`\ncheck failed with ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}
console.log(`check passed (${files.length} files scanned)`);
