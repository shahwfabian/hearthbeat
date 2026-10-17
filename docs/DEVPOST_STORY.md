## Inspiration

Anyone looking after an ageing parent from a distance asks one question every day: *does today look normal?*
Camera apps answer a different question, and for the person being watched they feel like surveillance.
Families want reassurance. Parents want dignity.

Ring's developer materials list elderly care as an intended use, and the Ring Appstore content policy asks
for easy access to monitoring activity and forbids covert third-party access. We wanted to see how far a
caring product could go using **only event metadata**, with the other person's dignity as the starting point.

## What it does

Hearthbeat answers "does today look like a usual day?" using only **when** a Ring device noticed movement.
It never opens video, audio or snapshots.

* **Rhythm Ring.** A 24 hour clock. The outer band is the person's usual day, learned from two weeks of Ring
  Event History. The inner band is today. Point at it, or use the arrow keys, to read any half hour in words.
* **One plain answer, with its working.** "Looks like a usual day", "Quieter than usual" or "Worth a call",
  and always a "Why am I seeing this?" that names the rule and the numbers. It says "can't see right now"
  when devices are offline and "still learning" before it has enough history. It is not a medical alert.
* **Gentle chime.** Instead of an alarm, one tap plays a soft sound on their Ring Chime through the chime
  audio playback endpoint. Nothing is recorded.
* **Visual doorbell.** Doorbell presses become a large, high-contrast banner (flashing is optional and
  respects reduced motion) for anyone who cannot hear the chime.
* **Their side of the story.** The person being cared for has their own page. They see everything the family
  sees, an **access log** of every look and every chime, a **pause switch** that really stops collection (and
  the server refuses chimes while paused), and **delete everything**.
* **Under the hood.** A live panel of every Ring API call and webhook the page depends on: paths, status codes,
  signature verification. Never tokens, never message bodies.
* **Interactive demo.** A built-in director panel lets anyone play a simulated day, jump to the key moment of
  five scenarios, and make things happen: a doorbell press, a package, cameras going offline.

![The family view when a quiet morning is eased by a doorbell press](https://raw.githubusercontent.com/shahwfabian/hearthbeat/main/docs/screenshots/family-eased.png)

## How we built it

Node.js 22 with **no runtime dependencies**: a plain `node:http` server, plain ES modules and SVG in the
browser, and the built-in test runner.

* A `RingClient` for the documented Ring Partner API: devices with `?include=`, Event History with composite
  `event_types` and `links.next` paging, and chime playback following the documented sequence (capabilities,
  status and configurations, then `POST .../media/audio/playback`), with retries, backoff and `Retry-After`.
* A webhook receiver that verifies the `X-Signature` HMAC-SHA256 over the **raw body bytes** with a
  constant-time comparison, parses v1.1 payloads, de-duplicates on `meta.request_id`, and answers with
  Ring-friendly status codes.
* A small, explainable rules engine (late start, long quiet spell, restless night) with floors on every
  tolerance, so a very regular routine can never produce a hair-trigger alert, and a recent visitor eases the
  message and says why.
* A consent-first design: the pause switch drops events at the source, every family action is logged for the
  person to read, and the page is protected against cross-site requests and DNS rebinding because it runs on
  someone's own computer.
* A strict Content Security Policy, keyboard-operable controls, a light and a dark theme, and no inline script.

**Demo mode** runs against a local simulator of the documented endpoints that we wrote ourselves. A
simulated clock emits **signed webhooks over real HTTP** to the app's own endpoint, so signature checking,
parsing and de-duplication all run for real. **Live mode** points the same client at
`https://api.amazonvision.com` with a Ring Developer Playground token and polls Event History.

## Challenges we ran into

* **A doorbell is not a wellbeing sensor.** Learning a routine from comings and goings is indirect, so the
  rhythm uses *indoor* device motion, doorway events are kept for visitors, and the product says plainly that
  it notices changes in routine and cannot tell whether someone is well.
* **Avoiding false alarms.** Tolerances have floors, visitors ease messages, and offline devices produce
  "can't see right now" instead of a falsely calm "all quiet".
* **Making consent structural, not decorative.** Pause really stops collection and the server enforces it.
* **Demoing without a device.** We could not find an official Ring simulator in Ring's documentation, so we
  built our own and labelled it as a simulation everywhere it appears.

## Accomplishments that we're proud of

More than 190 automated tests, including an end-to-end suite that drives the real Ring client against the
simulator, delivers signed webhooks through the real HTTP server, checks consent and cross-site protection,
and replays every demo scenario across 60 different calendar days so the story never goes off-script.

## What we learned

Ring's event surface is richer than "motion alert". Event History, sub-typed motion, button presses, device
state and chime playback together are enough for a respectful caretaking product. We also learned how much
the *shape of consent* matters: showing the person being cared for everything the family sees changed the whole
design.

## What's next for Hearthbeat

Account linking with Ring's one-way HMAC nonce flow, a registered app on Ring's staging environment,
multiple caregivers with per-person consent, and Ring's certification process.

## Honest limitations

* The demo runs against **our own simulator**, written from Ring's published API documentation. It is not an
  official Ring simulator, and the app, the video and this text say so. Live mode is written against the same
  documentation and tested against the simulator; the authors have **not** run it on a real Ring account.
* Real webhooks need a registered Ring app (for the signing key) and a public HTTPS URL.
* Not a medical alert device, and not tested with real older adults.

## AI assistance disclosure

This project was written with the help of an AI coding assistant, in small steps that the commit history shows.
The concept, scope decisions and final review are the submitter's responsibility.

## Try it

Requires Node.js 22 or newer. No install step and no credentials:

```
git clone https://github.com/shahwfabian/hearthbeat.git
cd hearthbeat
npm start
```

Then open http://127.0.0.1:3000 and follow the 60 second walkthrough in the README.
