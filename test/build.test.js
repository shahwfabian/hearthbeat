import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECURITY_HEADERS } from '../server/http.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');

before(() => {
  const r = spawnSync(process.execPath, [join(root, 'scripts/build-web.js')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f, out);
    else out.push(f);
  }
  return out;
}

test('the web build ships the interface and the browser-safe engine', () => {
  for (const f of ['index.html', 'js/main.js', 'css/tokens.css', 'engine/local.js', 'engine/hub.js', 'engine/api.js', 'engine/ring/client.js', 'engine/sim/runtime.js']) {
    assert.ok(existsSync(join(dist, f)), f);
  }
});

test('the hosted build is switched to run the app inside the page', () => {
  assert.match(readFileSync(join(dist, 'js/mode.js'), 'utf8'), /STATIC = true/);
  assert.match(readFileSync(join(root, 'public/js/mode.js'), 'utf8'), /STATIC = false/, 'the source copy stays false for Node');
});

test('nothing in the bundle imports Node, and Node-only files are left out', () => {
  assert.ok(!existsSync(join(dist, 'engine/sim/mock-api.js')));
  for (const f of walk(dist).filter((f) => f.endsWith('.js'))) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /from\s+['"]node:|import\(\s*['"]node:|require\(/, f);
  }
});

test('every import inside the bundle resolves to a file that was shipped', () => {
  for (const f of walk(dist).filter((f) => f.endsWith('.js'))) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      if (!spec.startsWith('.') && !spec.startsWith('/')) continue;
      const target = spec.startsWith('/') ? join(dist, spec) : join(f, '..', spec);
      assert.ok(existsSync(target), `${f} imports ${spec}`);
    }
  }
});

test('the hosting headers match the server\'s Content Security Policy exactly', () => {
  const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  const headers = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]));
  assert.equal(headers['Content-Security-Policy'], SECURITY_HEADERS['Content-Security-Policy']);
  assert.equal(headers['X-Content-Type-Options'], SECURITY_HEADERS['X-Content-Type-Options']);
  assert.equal(headers['Referrer-Policy'], SECURITY_HEADERS['Referrer-Policy']);
});
