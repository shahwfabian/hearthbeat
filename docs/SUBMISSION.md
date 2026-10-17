# Devpost submission pack

Everything needed for the "Build, Ship, Shape: Amazon Developer Hackathon" form, in the order the
official rules list it. Deadline: **Friday 23 October 2026, 12:00 pm Pacific**.

Nothing in this file is a placeholder: copy each section into the matching Devpost field as written.
The only things not done in this repository are the ones that happen on Devpost and on YouTube or Vimeo:
recording and uploading the video, and pressing Submit.

## Checklist

| Requirement (from the official rules) | Status |
|---|---|
| Primary track: **Ring** | Ready |
| Working app using Ring APIs, shown through a simulator or an actual Ring device | Code ready. **Risk: our simulator is self-built, not an official Ring one. Read [VIDEO_PLAN.md](VIDEO_PLAN.md) and send the [clarification email](CLARIFICATION_EMAIL.md)** |
| Text description | Below |
| Public GitHub repo with an open source license detectable in the About section | Done: https://github.com/shahwfabian/hearthbeat is public and GitHub detects "MIT License" |
| Clear setup and run instructions in the repo | [README](../README.md) |
| Runtime use of Ring technology in code (imported and actually called) | `server/ring/client.js` is called by the Hub in both modes; `server/ring/receiver.js` handles webhooks |
| Demo video under 3 minutes, public on YouTube or Vimeo | Script ready; **you record and upload** |
| No third-party trademarks or copyrighted music in the video | Thumbnail and UI contain no logos; use no music |
| Product feedback for each tool, API or SDK used | Below |
| Friction log (optional, up to 10% bonus) | Below |
| Mini challenges | See below |
| Eligibility (age of majority, not in an excluded country, no conflict of interest) | Attested by the submitter on the Devpost form |

## Devpost form: General info (paste exactly)

| Field | Limit | Value | Length |
|---|---|---|---|
| Project name | 60 characters | `Hearthbeat` | 10 |
| Elevator pitch | 200 characters | `A calm, video-free answer to "does today look like a usual day?" for families, built on Ring events. The person being cared for sees everything the family sees and holds the off switch.` | 185 |
| Thumbnail | JPG, PNG or GIF, 5 MB max, 3:2 recommended | [`docs/thumbnail.png`](thumbnail.png): 1500 x 1000 (exactly 3:2), 0.8 MB | |

Use **Edit thumbnail** on that form and upload `docs/thumbnail.png`. The artwork contains no logos or
third-party marks. A second image for the gallery: `docs/screenshots/under-the-hood.png`.

## Devpost form: Project Story (paste exactly)

**About the project** (Markdown): paste the entire contents of [`DEVPOST_STORY.md`](DEVPOST_STORY.md). It already
has the Inspiration, what it does, how it was built, challenges, accomplishments, what we learned, what is
next, the honest limitations and the AI disclosure. It uses one screenshot, hosted from the public repository.

**Built with** (up to 25 tags; add each as its own tag): `nodejs`, `javascript`, `html5`, `css3`, `svg`,
`ring-partner-api`, `webhooks`, `hmac-sha256`, `server-sent-events`, `json-api`, `github-actions`,
`content-security-policy`.

**"Try it out" links** (add each with "Add another link"):

1. https://github.com/shahwfabian/hearthbeat
2. https://github.com/shahwfabian/hearthbeat#try-it-in-60-seconds

The app needs a Node server, so there is no hosted demo URL; the repository link and the video are the
ways to try it. Add the video link in its own field on the Devpost form after you upload it.

## Name and tagline

**Hearthbeat**: a calm answer to "does today look like a usual day?", built on Ring events, with no video, ever.

## Short description (for the project card)

Hearthbeat helps families look after an older relative without cameras feeling like surveillance. It uses
only when a Ring device noticed movement to learn a person's usual day, then tells the family gently when
a day looks different, and why. The person being cared for has their own page: they see everything the
family sees, who looked, and they hold the off switch.

## Full description

The single source of truth is [`DEVPOST_STORY.md`](DEVPOST_STORY.md) (see the Project Story section above). It is
not repeated here, so the two can never disagree.

## Tracks and mini challenges

* **Primary track:** Ring.
* **AWS Builder:** not entered (no AWS services are used).
* **Open Source:** not entered. The rules describe this challenge as a *new, additional* open source
  project or a contribution to a public repository *alongside* the primary submission. Our single repository
  is the primary submission itself (it is MIT licensed), so we are not claiming it twice.

## Product feedback (required)

> Basis for this feedback: reading Ring's developer documentation, studying the public sample repository,
> and building and testing against the documented API shapes. We did **not** have a registered Ring app or
> a Ring device in the build environment, so we cannot comment on real-device latency, reliability or the
> Playground itself.

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

**Would you build with these devices and services again?** **Yes.** The event surface (Event History,
sub-typed motion, button presses, device state, chime playback) is enough to build respectful,
non-security products, and the documentation's practical webhook guidance made the integration design
straightforward. We would want an official simulator before building more.

## Friction log

Entries are from reading the documentation and the public sample repository (`AmazonAppDev/ring-api-helloworld`)
on 16 October 2026. We did not exercise a live account, so each entry is about documentation and sample code,
not device behaviour. Documentation changes over time.

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
| Motion sub type included in each Event History record (the documentation's example record shows only `motion`, and sub types are reached through the `event_types` filter) | Avoids one request per sub type when learning routines | Nice-to-have |
| Optional consented backfill window on first link | Pattern-learning apps otherwise start blind for days | Nice-to-have |
| Longer-lived Playground tokens or in-page refresh | 30 minutes is short for a demo session | Nice-to-have |

## AI assistance disclosure

The official rules we reviewed do not require an AI disclosure, but we include one so it is never in doubt:
this project was written with the help of an AI coding assistant, in small steps that the commit history
shows. The concept, scope decisions and final review are the submitter's responsibility.
