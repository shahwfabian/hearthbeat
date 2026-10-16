# Written request for clarification (ready to send)

**You send this, from your own email.** Nothing here has been sent for you.

Why: the Official Rules say that if an entrant believes a term "is or may be ambiguous, they must submit a
written request for clarification" before the deadline, and give **support@devpost.com** for questions.
A written answer is your best protection on the Ring track's simulator requirement.

## Before you send (2 minutes)

* [ ] Replace the two `<...>` fields (your Devpost username and your name).
* [ ] The `LICENSE` file says "Fabian Shah". That surname was inferred from your GitHub handle, so confirm
      it, or change the copyright line to your real name.
* [ ] Open https://github.com/shahwfabian/hearthbeat in a private window and confirm it loads and shows
      "MIT license" in the About box.
* [ ] Send it today. Deadline: **Friday 23 October 2026, 12:00 pm Pacific**.
* [ ] Keep any reply. If it is in writing from Devpost or Amazon, mention it in your submission text.

## Email

**To:** support@devpost.com
**Subject:** Clarification request: Ring track "simulator" requirement (Build, Ship, Shape: Amazon Developer Hackathon)

Hello,

I am entering the Ring track of the Build, Ship, Shape: Amazon Developer Hackathon and need a
clarification on the demo requirement before the 23 October deadline.

The Official Rules say the Ring demo video "must show the project working through a simulator or an actual
Ring device you have for testing," and that "any Ring API, SDK, simulator, or device listed in Ring's
developer documentation is acceptable."

I do not own a Ring device, and I could not find an official Ring simulator or sandbox in Ring's developer
documentation. I have built a local simulator of the documented Ring Partner API endpoints (devices, Event
History, chime audio playback, and signed v1.1 webhooks), written from the public documentation and clearly
labelled as a simulation in the app, the video and the submission text. My application's real Ring client
and webhook receiver run against it, and the same client can be run against https://api.amazonvision.com
in live mode with a Playground token.

Could you please confirm:

1. Does a self-built simulator of the documented Ring API, clearly disclosed as such, satisfy the
   "simulator" requirement for the Ring track?
2. If not, is there an official Ring simulator, sandbox account, or test device available to participants?

Repository (public, MIT licensed): https://github.com/shahwfabian/hearthbeat

Thank you for your help.

<your name>
Devpost username: <your Devpost username>

## Shorter version for the hackathon's Discussions tab

> Question for the organisers: the Ring track says the demo must show the project working "through a
> simulator or an actual Ring device." I can't find an official Ring simulator or sandbox in Ring's docs and
> don't own a device. Would a self-built simulator of the documented Ring API (clearly disclosed as a
> simulation) count? Or is there an official simulator or test account we can use? Thanks!

## Optional third question

If you want to ask about the Open Source mini challenge too: "The Open Source challenge asks for a new,
additional open-source project or a contribution alongside the primary submission. Does the MIT-licensed
repository that is itself the primary submission qualify, or does it need to be a separate contribution?"
