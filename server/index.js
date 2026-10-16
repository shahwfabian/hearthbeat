import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { loadEnvFile } from './env.js';
import { ConfigError, loadConfig, rolesFromLive } from './config.js';
import { createApp } from './http.js';
import { DemoRuntime } from './demo.js';
import { Hub } from './hub.js';
import { RingAuthError, RingClient } from './ring/client.js';
import { DEMO_HMAC_KEY } from './sim/household.js';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url)).replace(/[\\/]$/, '');

async function listen(server, cfg) {
  server.listen(cfg.port, cfg.host);
  try {
    await once(server, 'listening');
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `
Port ${cfg.port} is already in use. Pick another one, for example:
` +
          '  macOS/Linux:  PORT=3001 npm start
' +
          '  PowerShell:   $env:PORT=3001; npm start
' +
          '  cmd.exe:      set PORT=3001 && npm start
',
      );
      process.exit(1);
    }
    throw err;
  }
  return server.address().port;
}

/** Demo mode: nothing to configure. A simulated Ring account feeds the real app code. */
async function startDemo(cfg) {
  const server = createApp({ hmacKey: DEMO_HMAC_KEY, publicDir });
  const port = await listen(server, cfg);

  const demo = new DemoRuntime({ tz: cfg.tz, webhookUrl: () => `http://127.0.0.1:${port}/webhooks/ring` });
  await demo.start();
  server.attach(demo.hub, demo);

  console.log(`\nHearthbeat (demo mode) is running at http://${cfg.host}:${port}`);
  console.log('Everything on screen is simulated. Ring data comes from a local mock of the documented API.\n');
  return { server, demo };
}

/** Live mode: a real Ring Playground token, real devices, Event History polling. */
async function startLive(cfg) {
  const { live } = cfg;
  const ring = new RingClient({ token: live.token, ...(live.baseUrl ? { baseUrl: live.baseUrl } : {}) });

  if (live.inside.length === 0) {
    const devices = await ring.listDevices();
    console.log('\nNo RING_INSIDE_DEVICE_IDS set yet. Devices on this Ring account:\n');
    for (const d of devices) console.log(`  ${d.id}   ${d.name}   ${d.online === false ? '(offline)' : ''}`);
    console.log(
      '\nPut the ids of indoor devices in RING_INSIDE_DEVICE_IDS, door devices in RING_DOORWAY_DEVICE_IDS,\n' +
        'and (optionally) a Ring Chime in RING_CHIME_DEVICE_ID, then run `npm run live` again.\n',
    );
    process.exit(0);
  }

  const hub = new Hub({
    ring,
    now: () => Date.now(),
    tz: cfg.tz,
    mode: 'live',
    personName: process.env.PERSON_NAME || 'Your loved one',
    caregiverName: process.env.CAREGIVER_NAME || 'You',
    roles: rolesFromLive(live),
  });

  const server = createApp({ hmacKey: live.hmacKey, publicDir });
  const port = await listen(server, cfg);
  server.attach(hub, null);

  const summary = await hub.loadHistory();
  console.log(`\nHearthbeat (live) is running at http://${cfg.host}:${port}`);
  console.log(`Loaded ${summary.events} events from ${summary.devices} Ring devices.`);

  const timer = setInterval(async () => {
    try {
      await hub.poll();
    } catch (err) {
      if (err instanceof RingAuthError) {
        console.error('Ring token expired. Generate a new Playground token and restart.');
        clearInterval(timer);
      } else {
        console.error(`Poll failed (will retry): ${err.message}`);
      }
    }
  }, live.pollMs);
  return { server, hub };
}

async function main() {
  loadEnvFile();
  let cfg;
  try {
    cfg = loadConfig(process.argv.slice(2), process.env);
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`\nConfiguration problem: ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }
  return cfg.mode === 'demo' ? startDemo(cfg) : startLive(cfg);
}

main().catch((err) => {
  if (err instanceof RingAuthError) {
    console.error('\nRing rejected the access token. Playground tokens last about 30 minutes: generate a fresh one.\n');
  } else {
    console.error(err);
  }
  process.exit(1);
});
