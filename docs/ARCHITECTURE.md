# Architecture

Hearthbeat is a small Node.js app with **no runtime dependencies**. The server is plain `node:http`,
the browser code is plain ES modules, and tests use the built-in `node:test` runner.

```
                      Ring Partner API (https://api.amazonvision.com)
                                   ▲  GET devices, history, status      ▲ webhooks (signed)
                                   │  POST audio playback               │
  ┌────────────────────────────────┴────────────┐              ┌────────┴─────────┐
  │ server/ring/client.js    RingClient          │              │ server/ring/      │
  │   retries, JSON:API, history paging, chime   │              │ receiver.js       │
  └───────────────────────┬──────────────────────┘              │ signing.js        │
                          │                                     │ webhook.js        │
                          ▼                                     └────────┬─────────┘
                ┌───────────────────────────────────────────────────────▼──────┐
                │ server/hub.js   Hub                                           │
                │  events in memory · pause switch · access log · nudge guards  │
                └───────┬───────────────────────────────┬──────────────────────┘
                        │ pure functions                │ SSE + JSON
                        ▼                               ▼
   server/core/baseline.js  rules.js  status.js    server/http.js  → public/ (browser UI)
   (learn the usual day · judge today · explain)
```

## Two modes, one code path

| | Demo mode (`npm start`) | Live mode (`npm run live`) |
|---|---|---|
| Ring API | `server/sim/mock-api.js`, a local stand-in for the documented endpoints | `https://api.amazonvision.com` |
| Auth | fixed demo token | Developer Playground token (about 30 minutes) |
| Past events | 14 generated days served through `GET /v1/history/devices/{id}/events` | the account's real Event History |
| New events | simulated clock emits **signed webhooks** to `/webhooks/ring` | polling Event History every 30 s (documented alternative to webhooks) |
| Chime | mock `POST /v1/devices/{id}/media/audio/playback` | the real endpoint |

The `Hub`, the rules, the HTTP server and the whole interface are identical in both modes. In demo
mode the simulator is just another client of those same entry points: it sends real HTTP requests with
real HMAC signatures, so the signature check, the parser and the de-duplication all run for real.

> The mock API is our own simulation, written from Ring's public documentation. It is not an official
> Ring simulator. The interface labels demo mode as "Simulated demo" at all times.

## The Ring surface we touch

| Ring capability | Where | Why |
|---|---|---|
| `GET /v1/devices?include=status,capabilities` | `RingClient.listDevices` | find devices, online state, and which device is a chime (`audio.customizable_slots > 0`) |
| `GET /v1/devices/{id}/status` | `RingClient.getStatus` | online and snooze state |
| `GET /v1/history/devices/{id}/events` with `event_types`, `page[key]` | `RingClient.getEventHistory` | learn the usual day, and poll in live mode |
| `GET /v1/devices/{id}?include=capabilities,configurations,status` then `POST …/media/audio/playback` | `RingClient.playChime` | the "gentle chime" nudge, following the documented sequence |
| Webhooks v1.1 (`motion_detected`, `button_press`, `device_online`, `device_offline`) with `X-Signature: sha256=…` | `server/ring/receiver.js` | real-time doorbell and activity events |

**Deliberately not used:** live video (WHEP/RTSP), clips, snapshots. Hearthbeat never requests media.

## The rhythm engine (`server/core`)

All pure functions, fully unit-tested, no I/O.

* `baseline.js` turns the last 14 complete days of *inside* motion events into: a 48-slot usual
  profile, the median wake-up time and its spread (MAD), the 90th percentile of the longest quiet spell
  while awake, and night-time movement. Today never teaches the baseline.
* `rules.js` has three small rules, each returning a plain-language reason with its numbers:
  * **late-start**: no movement long after the usual wake-up, with a tolerance of at least an hour.
  * **long-quiet**: a daytime silence clearly longer than their own longest usual one (at least 90 min).
  * **restless-night**: unusually many movements between 1 and 4 am (a gentle note only, until noon).
* `status.js` combines them into `learning | blind | typical | quiet | checkin`. A recent visitor
  eases "worth a call" to "quiet" and says why. If every inside device is offline, it refuses to judge
  ("can't see right now") rather than mistaking a data gap for a quiet day.

Floors on the tolerances mean a very regular routine can never produce a hair-trigger alert.

## Consent by construction

* `Hub.setSharing(false)` makes `ingest` drop everything; the family view shows only "paused".
* `Hub.nudge` refuses while sharing is paused and has a 10 minute cooldown; `RingClient.playChime` also
  checks that the device is a chime, is online, and is not snoozed.
* Every family action goes into the access log, which the person can read at any time.
* `Hub.forget` erases all remembered events.
* The `HomeEvent` type has no field that could hold media. There is no code path that stores any.

## Security notes

* Webhook signatures are verified over the **raw body bytes** with a constant-time comparison.
* The server binds to `127.0.0.1` by default.
* Content Security Policy: `default-src 'self'`, no inline script or style. `scripts/check.js` enforces
  this on the markup, and the browser code builds the DOM with `textContent`, never `innerHTML`.
* Request bodies are capped at 64 KB; static files are served with a path-traversal guard.
* Secrets live in `.env` (git-ignored). `.env.example` holds placeholders only, and `npm run check`
  fails if a real-looking value is committed.
