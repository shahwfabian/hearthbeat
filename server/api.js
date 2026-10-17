import { HubError } from './hub.js';
import { buildSnapshot } from './snapshot.js';

/**
 * The application API, independent of how requests arrive. The Node server
 * (`server/http.js`) calls it for real HTTP requests; the hosted browser demo
 * (`public/js/local-app.js`) calls it directly in the page. One implementation,
 * so the hosted demo cannot drift from the app you run locally.
 *
 * Returns `{ status, body }`, or `null` when the path is not an application route.
 * Throws HubError for expected refusals (paused, bad input, cooldown...).
 *
 * @param {{ hub: import('./hub.js').Hub, demo: import('./sim/runtime.js').DemoRuntime|null }} ctx
 * @param {{ method: string, pathname: string, viewer: 'family'|'person', getBody: () => Promise<any> }} req
 */
export async function handleApi({ hub, demo }, { method, pathname, viewer, getBody }) {
  if (method === 'GET' && pathname === '/api/state') {
    if (viewer === 'family') hub.recordFamilyView();
    return { status: 200, body: buildSnapshot(hub, demo, viewer) };
  }

  if (method === 'POST' && pathname === '/api/nudge') {
    const out = await hub.nudge(hub.caregiverName);
    return { status: 200, body: { ok: true, sound: out.sound } };
  }

  if (method === 'POST' && pathname === '/api/sharing') {
    const body = await getBody();
    if (typeof body.on !== 'boolean') throw new HubError('bad-request', '"on" must be true or false', 400);
    hub.setSharing(body.on);
    return { status: 200, body: { ok: true, sharing: hub.sharing } };
  }

  if (method === 'POST' && pathname === '/api/forget') {
    hub.forget();
    return { status: 200, body: { ok: true } };
  }

  if (pathname.startsWith('/api/demo/')) {
    if (!demo) throw new HubError('not-demo', 'Demo controls are only available in demo mode', 404);
    if (method !== 'POST') throw new HubError('method', 'Use POST', 405);
    const body = await getBody();
    try {
      switch (pathname.slice('/api/demo/'.length)) {
        case 'play':
          demo.setRunning(body.running !== false);
          break;
        case 'rate':
          demo.setRate(Number(body.rate));
          break;
        case 'jump':
          await demo.jumpTo(Number(body.minute));
          break;
        case 'scenario':
          await demo.resetDay(String(body.id));
          break;
        case 'trigger':
          await demo.trigger(String(body.id));
          break;
        case 'offline':
          await demo.setOffline(String(body.deviceId), body.offline !== false);
          break;
        default:
          throw new HubError('not-found', 'Unknown demo action', 404);
      }
    } catch (err) {
      if (err instanceof RangeError) throw new HubError('bad-request', err.message, 400);
      throw err;
    }
    return { status: 200, body: { ok: true, demo: demo.describe() } };
  }

  return null;
}
