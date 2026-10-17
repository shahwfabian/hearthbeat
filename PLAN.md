# Hearthbeat: build plan

Hackathon: Build, Ship, Shape: Amazon Developer Hackathon 2026, **Ring track**.
Submission deadline: Fri 23 Oct 2026, 12:00 pm PT. Demo video must be under 3 minutes.

## Constraints taken from the official rules and Ring docs

| Source | Constraint | What we do about it |
|---|---|---|
| Devpost rules | Ring track needs a working app that uses Ring APIs, SDKs, simulators or devices, shown working in the video | A real Ring API client (`server/ring/client.js`) is imported and called at runtime in both modes |
| Devpost rules | Repo needs setup/run instructions and an open source license (or private + shared) | MIT license, README, zero-dependency `npm start` |
| Devpost rules | Video under 3 min, public on YouTube/Vimeo, no third-party trademarks or copyrighted music | `docs/DEMO_SCRIPT.md` is timed to 2:30, no logos, no music |
| Devpost rules | Product feedback required; friction log earns up to 10% bonus | `docs/SUBMISSION.md` has both, based only on what we actually did |
| Judging | Tech implementation, design, potential impact, quality of the idea (equal weights) | See scoring below |
| Judging | "Creative" Ring ideas are non-security: caretaking, accessibility, event-driven triggers | Caretaking plus accessibility |
| Ring content policy 1.2.2 | No covert third-party access; customers must get easy access to monitoring activity or access logs | Two-sided design: the person being cared for sees everything the family sees, an access log, and a pause switch |
| Ring API docs | No official SDK or simulator is documented; Playground issues 30-minute tokens | Live mode uses a Playground token. Demo mode uses our own spec-conformant mock API and says so on screen |
| Ring API docs | Webhooks: HTTPS POST, `X-Signature: sha256=<hex HMAC over raw body>`, v1.1 payload, dedupe on `meta.request_id`, answer within 5 s | Implemented in `server/ring/webhook.js` and exercised by tests |

## Concepts considered

Scored 1 to 5 against the four judging criteria plus feasibility and privacy.

| Concept | Tech | Design | Impact | Idea | Feasible | Privacy | Total |
|---|---|---|---|---|---|---|---|
| Package-theft alert board | 3 | 3 | 3 | 1 | 5 | 3 | 18 |
| Visual doorbell for deaf and hard-of-hearing households | 3 | 4 | 4 | 3 | 5 | 4 | 23 |
| Neighbourhood porch-pirate map | 3 | 3 | 3 | 2 | 4 | 1 | 16 |
| **Hearthbeat**: video-free daily rhythm for family caretaking, with a visual doorbell and a gentle chime nudge, built consent-first | 4 | 5 | 5 | 5 | 4 | 5 | **28** |

## Chosen concept: Hearthbeat

Families who care for an older relative want one answer: "does today look like a normal day?"
Cameras answer a different question and feel like surveillance. Hearthbeat uses **only event
metadata** (motion, doorbell presses, online/offline). It never opens video, audio or snapshots.

1. **Rhythm Ring**: a 24 hour clock. A faint outer band is the person's learned usual day (from the
   Event History API). The bright inner band is today.
2. **Plain-language status**: "Looks like a usual day", "Quieter than usual", "Worth a call". Every status
   has a "why" that names the exact rule and the numbers behind it.
3. **Gentle chime nudge**: one tap plays a friendly sound on their Ring Chime (Chime Controls, audio
   playback endpoint). No video, no spying, just "someone is thinking of you".
4. **Visual doorbell**: doorbell presses become a large, high contrast, flashing-optional banner for
   anyone who cannot hear the chime.
5. **Their side of the story**: the person being cared for gets their own view: what is shared, what
   is never shared, a live access log, and a pause switch.

## Honest scope

* Runs entirely without Ring credentials in **demo mode** (a mock of the documented API, labelled
  as a simulation in the UI and docs).
* **Live mode** talks to `https://api.amazonvision.com` with a Playground token and polls Event History
  (the documented alternative to webhooks). Webhook receiving is built and tested, but a public HTTPS URL
  and registered app are needed to use it for real.
* Not a medical alert device. Copy says so everywhere it matters.

## Status

All milestones below are complete. The only steps that remain are outside the repository: recording and
uploading the demo video, and submitting the form on Devpost (see `docs/SUBMISSION.md`).

## Milestones

1. Scaffold, plan, license.
2. Ring layer: signature verification, webhook parsing, API client.
3. Mock Ring API and household simulator.
4. Rhythm engine (baseline, status rules) with tests.
5. Server: SSE, consent, access log, nudge.
6. Interface: Rhythm Ring, controls, both views, visual doorbell.
7. Thumbnail, README, demo script, submission text.
8. Full test run, browser verification, push.
