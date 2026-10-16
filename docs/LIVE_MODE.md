# Live mode: using a real Ring account

Demo mode needs nothing. Live mode reads real Event History from a Ring account and can send a real chime.

> **Status of this path:** the live code path is written against Ring's published API documentation and
> exercised in tests against our mock of those endpoints. It has not been run against a real Ring account
> by the authors of this prototype. Expect to find small differences; the
> [friction log](SUBMISSION.md#friction-log) records the places we expect them.

## What you need

* A Ring account with a camera or doorbell and an active Ring Protection plan (Ring documents this as
  required for cloud features and the Event History API). Ring currently supports devices located in the US.
* A Ring Developer account, to generate a Playground token.
* Optional: a Ring Chime, for the nudge (needs the Chime Controls capability on your app registration).

## Steps

1. Open the [Ring Developer Playground](https://developer.amazon.com/ring/console/playground) and click
   **Generate Token**. The token lasts about 30 minutes.
2. Copy `.env.example` to `.env` and paste the token into `RING_ACCESS_TOKEN`.
3. Run `npm run live`. On first run it prints the devices on the account (id and name) and exits.
4. Put the ids into `.env`:
   * `RING_INSIDE_DEVICE_IDS`: indoor devices. Their motion builds the Rhythm Ring.
   * `RING_DOORWAY_DEVICE_IDS`: doorbell or porch camera. Visitors and the visual doorbell.
   * `RING_CHIME_DEVICE_ID`: a Ring Chime (optional).
   * `PERSON_NAME` and `CAREGIVER_NAME`: the names shown on screen.
5. Run `npm run live` again and open http://127.0.0.1:3000.

Hearthbeat reads the last 14 days of history, then polls every 30 seconds
(`POLL_INTERVAL_MS`). Only events after the account owner authorised your app are available, so a brand
new link starts in the "learning" state until about five days of activity exist.

## A note on consent

Only connect a Ring account whose owner has agreed. Hearthbeat is designed for the person being cared for
to see everything the family sees (the "Margaret's view" tab). Do not use it to watch anyone who does
not know about it: that breaks Ring's content policy as well as basic decency.

## Receiving real webhooks

Webhook receiving is implemented (`POST /webhooks/ring`, HMAC verification, replay protection) and tested.
Using it for real needs a registered Ring app, which provides the signing key, and a public HTTPS URL:

1. Register an app in the Ring Developer Console and obtain the HMAC signing key.
2. Put the key in `RING_HMAC_KEY`.
3. Expose the server over HTTPS (any tunnel or host) and register `https://<host>/webhooks/ring` as the
   webhook URL.

Without a key the endpoint answers `503` rather than accepting unsigned data.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Ring rejected the access token" | Playground tokens expire after about 30 minutes. Generate a new one and restart. |
| Status stays at "Still learning" | Fewer than five days of history with at least three events each. Wait, or choose a busier indoor device. |
| Chime button says the chime is snoozed or offline | Snooze is controlled in the Ring app; Hearthbeat can only read it. |
| Empty history right after linking | Ring only returns events after consent was granted. |
