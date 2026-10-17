import { CHIME_SLOTS, DEMO_TOKEN, DEVICES, deviceById } from './household.js';

/**
 * A local stand-in for the parts of the Ring Partner API that Hearthbeat uses.
 *
 * IMPORTANT: this is our own simulation, written from Ring's published API
 * documentation. It is not an official Ring simulator and it is not Ring.
 * It exists so the app can be run and demonstrated without a Ring account.
 * Responses follow the documented JSON:API shapes.
 *
 * Implemented: devices (+include), status, capabilities, configurations,
 * location, event history (+filters, paging) and chime audio playback.
 * Deliberately NOT implemented: live video, clips, snapshots. Hearthbeat never
 * touches media.
 */

const PAGE_SIZE = 25;
/** A response is just `{ status, body }`; the caller decides how to deliver it (Node HTTP, or in memory). */
const json = (status, body) => ({ status, body });
const problem = (status, title) => json(status, { errors: [{ status: String(status), title }] });

function capabilitiesFor(device) {
  if (device.role === 'chime') {
    return {
      video: { configurations: null, codecs: null, ratio: null, max_resolution: null, supported_resolutions: null },
      motion_detection: { configurations: null },
      image_enhancements: { configurations: null },
      audio: { customizable_slots: CHIME_SLOTS.length },
    };
  }
  return {
    video: { configurations: ['resolution_mode'], codecs: ['AVC'], ratio: '16:9', max_resolution: 1080, supported_resolutions: [1080] },
    motion_detection: { configurations: ['enabled', 'motion_zones'] },
    image_enhancements: { configurations: ['color_night_vision', 'hdr', 'ir_led_night_vision', 'privacy_zones'] },
  };
}

function configurationsFor(device) {
  if (device.role === 'chime') {
    return {
      motion_detection: { enabled: null },
      audio: { customizable_slots: CHIME_SLOTS.map((s) => ({ ...s, audio_url: null })) },
    };
  }
  return {
    motion_detection: { enabled: true, motion_zones: [] },
    image_enhancements: { privacy_zones: [] },
    audio: null,
  };
}

/**
 * @param {import('./world.js').DemoWorld} world
 * @param {{ token?: string, onPlayback?: (entry: object) => void }} [opts]
 */
export function createMockHandler(world, { token = DEMO_TOKEN, onPlayback } = {}) {
  const resource = (device) => ({
    type: 'devices',
    id: device.id,
    attributes: { name: device.name },
    relationships: {
      status: {
        data: { type: 'device-status', id: `status.${device.id}` },
        links: { related: `/v1/devices/${device.id}/status` },
      },
      capabilities: {
        data: { type: 'device-capabilities', id: `cap.${device.id}` },
        links: { related: `/v1/devices/${device.id}/capabilities` },
      },
      configurations: {
        data: { type: 'device-configurations', id: `cfg.${device.id}` },
        links: { related: `/v1/devices/${device.id}/configurations` },
      },
      location: {
        data: { type: 'locations', id: `loc.${device.id}` },
        links: { related: `/v1/devices/${device.id}/location` },
      },
    },
  });

  const statusAttrs = (device) => ({
    online: world.online.get(device.id) !== false,
    ...(device.role === 'chime' ? { audio: { snooze: { active: false, until: null } } } : {}),
  });

  const included = (device, wanted) => {
    const out = [];
    if (wanted.has('status')) {
      out.push({ type: 'device-status', id: `status.${device.id}`, attributes: statusAttrs(device) });
    }
    if (wanted.has('capabilities')) {
      out.push({ type: 'device-capabilities', id: `cap.${device.id}`, attributes: capabilitiesFor(device) });
    }
    if (wanted.has('configurations')) {
      out.push({ type: 'device-configurations', id: `cfg.${device.id}`, attributes: configurationsFor(device) });
    }
    if (wanted.has('location')) {
      out.push({ type: 'locations', id: `loc.${device.id}`, attributes: { country: 'US', state: 'IL' } });
    }
    return out;
  };

  const meta = () => ({ time: new Date(world.simNow).toISOString() });

  /**
   * @param {{ method: string, url: string, authorization?: string, bodyText?: string }} request
   * @returns {Promise<{ status: number, body: object }>}
   */
  return async function handle({ method, url: rawUrl, authorization, bodyText }) {
    try {
      const url = new URL(rawUrl, 'http://mock.ring.local');
      if (authorization !== `Bearer ${token}`) return problem(401, 'Unauthorized');

      const path = url.pathname;
      const wanted = new Set((url.searchParams.get('include') ?? '').split(',').filter(Boolean));

      if (method === 'GET' && path === '/v1/devices') {
        const devices = DEVICES;
        return json(200, {
          meta: meta(),
          data: devices.map(resource),
          ...(wanted.size ? { included: devices.flatMap((d) => included(d, wanted)) } : {}),
        });
      }

      let m = path.match(/^\/v1\/devices\/([^/]+)$/);
      if (method === 'GET' && m) {
        const device = deviceById(decodeURIComponent(m[1]));
        if (!device) return problem(404, 'Device not found');
        return json(200, {
          meta: meta(),
          data: resource(device),
          ...(wanted.size ? { included: included(device, wanted) } : {}),
        });
      }

      m = path.match(/^\/v1\/devices\/([^/]+)\/(status|capabilities|configurations|location)$/);
      if (method === 'GET' && m) {
        const device = deviceById(decodeURIComponent(m[1]));
        if (!device) return problem(404, 'Device not found');
        const [inc] = included(device, new Set([m[2]]));
        return json(200, { meta: meta(), data: { type: inc.type, id: inc.id, attributes: inc.attributes } });
      }

      m = path.match(/^\/v1\/history\/devices\/([^/]+)\/events$/);
      if (method === 'GET' && m) {
        const deviceId = decodeURIComponent(m[1]);
        if (!deviceById(deviceId)) return problem(404, 'Device not found');
        const cursor = url.searchParams.get('page[key]');
        const before = cursor ? Date.parse(cursor) : Infinity;
        if (cursor && Number.isNaN(before)) return problem(400, 'Malformed page[key]');
        const eventTypes = url.searchParams.get('event_types') ?? undefined;
        const { rows, more } = world.historyFor(deviceId, { eventTypes, before, limit: PAGE_SIZE });
        const body = {
          data: rows.map((e) => ({
            type: 'history-events',
            id: e.id,
            attributes: {
              event_type:
                e.kind === 'doorbell' ? 'ding' : e.subType ? `${e.kind}.${e.subType}` : e.kind,
              is_third_party_reviewed: false,
              start: e.ts,
              end: e.ts + 20_000,
            },
            relationships: { source: { data: { type: 'devices', id: e.deviceId } } },
          })),
        };
        if (more) {
          const qs = new URLSearchParams();
          if (eventTypes) qs.set('event_types', eventTypes);
          qs.set('page[key]', new Date(rows[rows.length - 1].ts).toISOString());
          body.links = { next: `/v1/history/devices/${deviceId}/events?${qs}` };
        }
        return json(200, body);
      }

      m = path.match(/^\/v1\/devices\/([^/]+)\/media\/audio\/playback$/);
      if (method === 'POST' && m) {
        const device = deviceById(decodeURIComponent(m[1]));
        if (!device) return problem(404, 'Device not found');
        if (device.role !== 'chime') return problem(400, 'Device cannot play audio');
        const body = bodyText ? JSON.parse(bodyText) : null;
        const ref = body?.data?.attributes?.audio_ref;
        if (body?.data?.type !== 'audio' || typeof ref !== 'string') {
          return problem(400, 'Expected a JSON:API audio document with attributes.audio_ref');
        }
        const entry = world.playAudio(device.id, ref);
        if (!entry) return problem(400, 'Unknown audio_ref');
        onPlayback?.(entry);
        return json(200, {
          data: { type: 'audio', id: ref, attributes: { status: 'completed' } },
          meta: { time: new Date().toISOString() },
        });
      }

      return problem(404, 'No such endpoint in the Hearthbeat demo API');
    } catch (err) {
      return problem(err instanceof SyntaxError ? 400 : 500, err instanceof SyntaxError ? 'Malformed JSON' : 'Internal error');
    }
  };
}
