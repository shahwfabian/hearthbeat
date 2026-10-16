# Privacy and consent

Hearthbeat is built for a sensitive situation: a family member keeping an eye on an older relative.
That is exactly where a product can slide from caring into surveillance, so the design starts from the
other person's point of view.

## What Hearthbeat uses

* When a Ring camera or doorbell noticed movement (a time, and which device)
* When the doorbell was pressed
* Whether a Ring device is online or offline

## What it never uses

Video, live view, clips, audio, snapshots, thumbnails, faces, names, or who anyone is. The app never
calls Ring's media endpoints. Its event type (`HomeEvent` in `server/core/events.js`) has nowhere to put
media, and the interface lists these promises on the person's own page.

## Who is in control

| Question | Answer in Hearthbeat |
|---|---|
| Does the person know it is on? | They link their own Ring account. Their page ("Margaret's view") shows everything the family sees. |
| Can they see who looked? | Yes. The access log lists every view and every chime, newest first. |
| Can they switch it off? | Yes. One big switch pauses sharing. While paused nothing new is kept and the family sees only "paused". |
| Can they delete it? | Yes. "Delete everything Hearthbeat remembers" erases all events and the learned routine. |
| Can the family override a pause? | No. The chime button is disabled and the server refuses with 403. |
| Is it a medical alert? | No, and the interface says so on every status card. |

## Alignment with the Ring Appstore content policy

Ring's Permitted Content Policy prohibits covert third-party access and asks that customers can easily
see monitoring activity. Hearthbeat is designed to match: access is never covert (the person has their
own page), activity is visible (the access log), and nothing is compiled across accounts, no faces or
identities are derived, and no media is touched. This is our reading of the policy while building a
hackathon prototype, not a certification: a real launch would go through Ring's own review.

## Data handling

* Events live in memory only. Nothing is written to disk by default.
* Stored fields: event id, timestamp, device id, kind (motion or doorbell), and a coarse sub type.
* Demo mode uses fictional people and generated data. No real person's data appears anywhere in this repository.
* Tokens and keys come from environment variables and are never logged or committed.

## Things we chose not to build

* No face or person recognition, no "who was that".
* No location history, no movement trails across devices or accounts.
* No sharing of one person's data with anyone other than the family member they linked.
* No "silent mode" for the family. Every nudge is announced in the access log.
