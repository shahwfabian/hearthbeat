# Making the demo-mode video defensible

**The rule that matters** (Ring track, official rules): *"The demo video must show the project working
through a simulator or an actual Ring device you have for testing."* The same rules also say
*"Any Ring API, SDK, simulator, or device listed in Ring's developer documentation is acceptable."*

**The gap:** we searched Ring's documentation and found no official simulator or sandbox with synthetic
devices (the API page says there is no official SDK; the Playground issues a short-lived token for an
account's real devices). Our demo mode runs against a simulator **we wrote** from the documented API.
That may satisfy a generous reading ("a simulator") and may not satisfy a strict one ("listed in Ring's
documentation"). Nobody outside Amazon can settle that for you, so the plan below does three things:

1. **Ask**, in writing, before the deadline (the rules explicitly invite this).
2. **Be unmistakably honest** in the video, so the worst case is "weaker evidence", never "misleading".
3. **Make the simulation as strong as evidence can be**, so a fair judge can see the Ring API surface is
   really being exercised.

## Step 1: ask now (5 minutes)

The rules say: *"If at any time prior to the deadline, an Entrant or prospective Entrant believes that any
term in the Official Rules is or may be ambiguous, they must submit a written request for clarification."*
and give **support@devpost.com**. A ready-to-send draft is in
[CLARIFICATION_EMAIL.md](CLARIFICATION_EMAIL.md). A reply in writing is your best protection. Send it
today; the deadline is Friday 23 October, 12:00 pm Pacific.

## Step 2: look for a real device (optional, strongest)

If any of these is possible in the next few days, it beats everything else, even for a 20 second clip:

| Option | What it takes | Notes |
|---|---|---|
| A relative or friend's Ring doorbell or camera | They sign in to the Ring Developer Playground **on their own computer** and generate the token; you record their screen share, or sit beside them | Never ask for or share a Ring password. A token is a credential: use it for the recording, then let it expire (about 30 minutes). Get their on-camera consent. This also matches the app's own consent story |
| A cheap new or used device (for example an indoor camera or a Ring Chime) | Ring says an active Ring Protection plan is required for cloud features and history. Check Ring's current pricing and trial terms yourself | Delivery time matters with 7 days left. Only the camera/doorbell is needed to show Event History; a Chime is only needed for the nudge |
| Ask Amazon | In the email, ask whether participants can get test devices or a sandbox account | Costs nothing |

If you get a device, record the live clip with `npm run live` ([LIVE_MODE.md](LIVE_MODE.md)) and use the
live version of steps 3 and 4 in the shot list below.

## Step 3: if you stay on demo mode, shoot it like this

You can record from the hosted demo, https://hearthbeat-delta.vercel.app, or from `npm start`. The hosted one
runs everything inside the page, so the **Under the hood** panel names its host as "inside this browser tab".

### Say it plainly, twice

* In the first 20 seconds: **"I don't own a Ring device, so this demo runs against a simulator I wrote
  from Ring's published API documentation. Ring doesn't document an official simulator."**
* At the end, during the code shot: **"Pointing the same client at Ring's real API is one environment
  variable. That path is written from the docs and tested against the simulator; I haven't been able to
  run it on a real device."**

Do not say "connected to Ring", "live Ring data", or "working with a Ring device". Do say "simulated".
The interface already shows a "Simulated demo" badge, and the new **Under the hood** panel labels the API
as "our local mock of the documented endpoints, not Ring".

### Evidence shots that make the simulation credible (about 35 seconds in total)

1. **Under the hood panel** (scroll to the bottom of Dana's view, 12 seconds). Trigger a doorbell press and
   a chime, and narrate what appears: *"Each line is a real HTTP call. These go to Ring's documented
   paths: `GET /v1/devices` with include, Event History with `event_types` and paging, and chime playback.
   This line is a webhook arriving with a verified HMAC signature."*
2. **The Ring client in the editor** (`server/ring/client.js`, 8 seconds). Show `DEFAULT_BASE_URL =
   'https://api.amazonvision.com'` and say the demo only changes the base URL.
3. **The tests** (`npm run check` in a terminal, 8 seconds). Show the green summary. Say: *"The same
   client is tested end to end against the simulator, and webhook signatures are verified over the raw
   body, exactly as Ring documents."*
4. **Webhook verification** (`server/ring/receiver.js`, 7 seconds). Show the order: verify, parse,
   de-duplicate, respond.

### Words to avoid

* "Real-time Ring events" (they are simulated).
* "Integrated with my Ring" (you have none).
* Any claim about latency or reliability on real devices.

### YouTube/Vimeo description (paste this)

> Hearthbeat: a consent-first, video-free way for families to tell whether a day looks usual, built for the
> Ring track of Build, Ship, Shape: Amazon Developer Hackathon.
> Disclosure: this demo runs against a simulator I wrote from Ring's published API documentation (no
> official Ring simulator is documented, and I do not own a Ring device). Live mode uses the same client
> against api.amazonvision.com but has not been run on a real account.
> Code: https://github.com/shahwfabian/hearthbeat

## Step 4: say the same thing on Devpost

The text description and product feedback already state the limitation
([SUBMISSION.md](SUBMISSION.md#honest-limitations)). Keep that wording. Judges may read only the text,
images and video, so the disclosure must be consistent in all three.

## Honest odds

Stage One is a pass/fail check that the project "reasonably fits the theme and reasonably applies the
required APIs/SDKs". Hearthbeat's code applies the Ring APIs substantively and creatively, but a strict
judge could still mark a self-built simulator as not meeting the "simulator or actual Ring device"
requirement. A written answer from Devpost, or even a short real-device clip, removes most of that risk.
