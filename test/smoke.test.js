import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../server/index.js', import.meta.url));

/** Start the real entry point as a child process and wait for its "running at" line. */
function boot(env = {}, args = []) {
  const child = spawn(process.execPath, [entry, ...args], {
    env: { ...process.env, PORT: '0', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  let err = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (err += d));
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`did not start in time\n${out}\n${err}`)), 15_000);
    const poll = setInterval(() => {
      const m = out.match(/running at (http:\/\/[^\s]+)/);
      if (m) {
        clearTimeout(timer);
        clearInterval(poll);
        resolve(m[1]);
      }
    }, 50);
    child.on('exit', (code) => {
      clearTimeout(timer);
      clearInterval(poll);
      reject(new Error(`exited early (${code})\n${out}\n${err}`));
    });
  });
  ready.catch(() => {}); // callers that never await it must not trigger an unhandled rejection
  return { child, ready, output: () => ({ out, err }) };
}

test('`npm start` boots in demo mode with no configuration and serves the app', async () => {
  const { child, ready } = boot({ RING_ACCESS_TOKEN: '', RING_MODE: '' });
  try {
    const base = await ready;
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<title>Hearthbeat<\/title>/);
    const state = await (await fetch(`${base}/api/state?as=family`)).json();
    assert.equal(state.mode, 'demo');
    assert.equal(state.demo.simulated, true);
    for (const asset of ['/css/tokens.css', '/js/main.js', '/js/ring-clock.js', '/favicon.svg']) {
      assert.equal((await fetch(`${base}${asset}`)).status, 200, asset);
    }
  } finally {
    child.kill();
  }
});

test('live mode without a token exits with a helpful message instead of crashing', async () => {
  const { child } = boot({ RING_ACCESS_TOKEN: '' }, ['--live']);
  const code = await new Promise((resolve) => child.on('exit', resolve));
  assert.equal(code, 1);
});
