# Devpost submission pack

Everything needed for the "Build, Ship, Shape: Amazon Developer Hackathon" form, in the order the
official rules list it. Deadline: **Friday 23 October 2026, 12:00 pm Pacific**.

Sections marked **CONFIRM** contain statements only the submitter can truthfully make.

## Checklist

| Requirement (from the official rules) | Status |
|---|---|
| Primary track: **Ring** | Ready |
| Working app using Ring APIs, shown through a simulator or an actual Ring device | Code ready. **Video must show it; see the note in [DEMO_SCRIPT.md](DEMO_SCRIPT.md#which-ring-source-to-show)** |
| Text description | Below |
| Public GitHub repo with an open source license detectable in the About section | MIT `LICENSE` is in the repo. After the repo is public, confirm GitHub shows "MIT license" in About |
| Clear setup and run instructions in the repo | [README](../README.md) |
| Runtime use of Ring technology in code (imported and actually called) | `server/ring/client.js` is called by the Hub in both modes; `server/ring/receiver.js` handles webhooks |
| Demo video under 3 minutes, public on YouTube or Vimeo | Script ready; **you record and upload** |
| No third-party trademarks or copyrighted music in the video | Thumbnail and UI contain no logos; use no music |
| Product feedback for each tool, API or SDK used | Below. **CONFIRM** |
| Friction log (optional, up to 10% bonus) | Below |
| Mini challenges | See below |
| Eligibility (age of majority, not in an excluded country, no conflict of interest) | **CONFIRM** |

## Name and tagline

**Hearthbeat**: a calm answer to "does today look like a usual day?", built on Ring events, with no video, ever.

## Short description (for the project card)

Hearthbeat helps families look after an older relative without cameras feeling like surveillance. It uses
only when a Ring device noticed movement to learn a person's usual day, then tells the family gently when
a day looks different, and why. The person being cared for has their own page: they see everything the
family sees, who looked, and they hold the off switch.

## Full description

### Inspiration
Anyone caring for an ageing parent asks one question every day: does today look normal? Camera apps
answer a different question, and for the person being watched they feel like surveillance. Ring's
developer materials list elderly care among the intended uses, and the Ring Appstore content policy asks
for easy access to monitoring activity. We wanted to see how far a caring product could go using only
event metadata, with the other person's dignity as the starting point.

### What it does
* **Rhythm Ring:** a 24 hour clock. The outer band is the person's usual day, learned from two weeks of
  Event History. The inner band is today. Point at it, or use the arrow keys, to read any half hour in words.
* **One plain answer:** "Looks like a usual day", "Quieter than usual", or "Worth a call", and always a
  "Why am I seeing this?" that names the rule and the numbers. It refuses to judge when it cannot see
  (devices offline) or has not learned enough yet.
* **Gentle chime:** instead of an alarm, one tap plays a soft sound on their Ring Chime through the chime
  audio playback endpoint. No video, nothing recorded.
* **Visual doorbell:** doorbell presses become a large, high-contrast banner with optional flashing, for
  anyone who cannot hear the chime.
* **Their side of the story:** the person has their own page showing exactly what the family sees, an
  access log of every look and every chime, a pause switch that really stops collection, and delete-all.
* **Interactive demo:** a built-in director panel lets anyone play a simulated day, jump to key moments,
  and make things happen (a doorbell press, a package, cameras going offline) to watch the story change.

### How we built it
Node.js 22 with no runtime dependencies. A `RingClient` for the documented Ring Partner API (devices with
`include`, Event History with composite `event_types` and `links.next` paging, chime playback following the
documented capabilities → status → configurations → playback sequence); a webhook receiver that verifies
`X-Signature` HMAC-SHA256 over the raw body, parses v1.1 payloads and de-duplicates on `meta.request_id`;
a small explainable rules engine; and a vanilla-JS interface with SVG, a strict CSP and keyboard support.
In demo mode a local mock of the documented endpoints stands in for Ring and a simulator sends **signed
webhooks over real HTTP**, so the production code path is the one being exercised.

### Challenges
* Learning a routine from a doorbell and cameras is inherently indirect. We use *indoor* device motion
  for the rhythm and keep doorway events for visitors, and we are explicit that Hearthbeat notices changes
  in routine, not wellbeing.
* Avoiding false alarms: tolerances have floors, visitors ease messages, and offline devices produce
  "can't see right now" instead of "all quiet".
* Making consent structural rather than decorative: the pause switch drops events at the source, and the
  server refuses chimes while paused.

### Accomplishments
Over 180 automated tests including an end-to-end suite that drives the real Ring client against the mock
API, signed webhooks through the HTTP server, and every demo scenario across 60 different calendar days.

### What we learned
Ring's event surface is richer than "motion alert": Event History, sub-typed motion, button presses,
device state and chime playback together are enough for a respectful caretaking product.

### What's next
Account linking with Ring's one-way HMAC nonce flow, a registered app on Ring's staging environment,
multiple caregivers with per-person consent, and Ring certification.

### Honest limitations
* Demo mode uses **our own mock** of the documented API, not an official Ring simulator (we found none in
  Ring's documentation). Live mode is written against the docs and tested against the mock; it has not been
  run against a real Ring account by the authors. **CONFIRM or update before submitting.**
* Webhook receiving works but needs a registered Ring app and a public HTTPS URL to use for real.
* Not a medical alert device and not tested with real older adults.

## Tracks and mini challenges

* **Primary track:** Ring.
* **AWS Builder:** not entered (no AWS services are used).
* **Open Source:** the repository is MIT licensed and created in the hackathon window. The rules describe
  this challenge as a *new, additional* open source project or a contribution to a public repository
  alongside the primary submission, so decide whether this repo itself qualifies or whether you want to add
  a separate contribution (for example, fixes to the stale links and webhook payloads noted in the friction
  log below, as a pull request to the public sample repository). **CONFIRM.**

## Product feedback (required)

> Basis for this feedback: reading Ring's developer documentation, studying the public sample repository,
> and building and testing against the documented API shapes. We did **not** have a registered Ring app or
> a Ring device in the build environment, so we cannot comment on real-device latency, reliability or the
> Playground itself. **CONFIRM** this still matches what you did before submitting, and edit freely.

**Which tools, APIs and SDKs did you use, and for what?**
Ring Partner API documentation (devices, status, Event History, webhook v1.1 and signature scheme, chime
playback), the public `ring-api-helloworld` sample for payload shapes, and the Ring Appstore content policy.

**What worked well?**
* A consistent JSON:API design with `?include=` compound documents made device discovery a single call.
* The webhook guidance is unusually practical: the raw-body warning, retry schedule, idempotency advice and
  status-code semantics saved us from mistakes before we made them.
* The chime documentation is precise about the required sequence and honest about what is not available.
* The content policy is clear about covert access and access logs, which shaped our consent design.

**What needs work?**
* Docs pages load sections on demand, so text extraction of the API page returns only the overview until each
  section is opened. This hurts automated and AI-assisted reading, which Ring explicitly encourages.
* Stale links and sample code: see the friction log.
* No documented simulator or sandbox with synthetic events, although the hackathon asks for demos on a
  simulator or a real device.
* A new account link has no event history, so any app that learns a routine has a cold start.

**Onboarding (zero to hello world):** documentation and sample were easy to find from developer.ring.com.
We did not complete a live hello world; see the basis note above.

**Would you build with these devices and services again?** Draft: **Yes**, because the event surface
supports respectful non-security products. **CONFIRM** this is your honest answer.

## Friction log

Entries are from reading the documentation and the public sample repository on 16 October 2026. Please
re-check each one before submitting, because documentation changes.

| # | Task | Steps | Expected | Actual | Severity | Workaround | Suggestion |
|---|---|---|---|---|---|---|---|
| 1 | Follow the webhook link from the sample repo | Opened `developer.amazon.com/docs/ring/notifications.html`, linked from the sample README and its `.env.example` | The webhook documentation | HTTP 404 "Page not found". The content now lives under `api-documentation.html#notifications` | Medium | Use the anchor on the API page | Redirect old URLs; update the sample |
| 2 | Match the sample's webhook handling to the docs | Compared `lib/schemas/webhook.ts` and the webhook route in the sample with the v1.1 docs | Same payload shape and auth | Sample uses `meta.version` 1.0 with no `account_id`, an enum with `person_detected`, optional `thumbnail_url`/`bounding_box`, no `button_press` or `sub_type`, and a Bearer secret instead of `X-Signature` HMAC | High (a developer copying the sample will build an insecure, wrong handler) | Implemented from the docs, not the sample | Update the sample to v1.1 with HMAC verification |
| 3 | Decide between webhooks and polling | Read the sample's `events` route and the docs | One consistent statement | The sample says Ring has no polling API for events; the docs describe the Event History API and recommend it as a webhook alternative | Medium | Used Event History | Fix the sample comment |
| 4 | Parse motion sub types across surfaces | Compared the webhook `sub_type` values with Event History filter values | One vocabulary | Webhook: `human, vehicle, package_delivery, other_motion`. Event History filters: `motion.human, motion.vehicle, motion.animal, motion.other_motion` | Low | Treat both as open vocabularies and pass unknown values through | Publish one table of sub types per surface |
| 5 | Learn a routine for a new user | Read the Event History section | Some backfill | Results are time-gated to the consent date, so a new link starts empty | Medium (by design, but it surprised us) | A "still learning" state in the product | Call this out near the top of the history docs and in onboarding guidance |
| 6 | Hand a hackathon judge a demo without a device | Searched the docs for a simulator or sandbox | A documented way to generate test events | The API page states there is no official SDK and documents no simulator. The Playground gives a 30 minute token | Medium | Built our own mock of the documented endpoints and said so | Provide an official event simulator and webhook replay |
| 7 | Read the API reference with an automated tool | Fetched the API page text | Whole reference | Only the overview; sections appear after clicking each one | Low | Opened each section | Server-render the sections or provide a single-page or OpenAPI form |

## Feature requests

| Request | Why it matters | Priority |
|---|---|---|
| Official simulator that emits signed v1.1 webhooks and serves fake Event History | Lets every developer demo without hardware and lets judges verify | Important |
| Event History records that include motion sub type in the record itself | Avoids one request per sub type when learning routines | Nice-to-have |
| Optional consented backfill window on first link | Pattern-learning apps otherwise start blind for days | Nice-to-have |
| Longer-lived Playground tokens or in-page refresh | 30 minutes is short for a demo session | Nice-to-have |

## AI assistance disclosure

The official rules we reviewed do not require an AI disclosure, but we include one so it is never in doubt:
this project was written with the help of an AI coding assistant. The commit history shows the incremental
development. The concept, scope decisions and final review are the submitter's responsibility. **CONFIRM** you
reviewed the code and are comfortable with this wording.
