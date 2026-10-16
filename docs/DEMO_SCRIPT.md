# Demo video script (demo mode, target 2:45, hard limit 3:00)

Rules from the hackathon: under 3 minutes, public on YouTube or Vimeo, shows the project working through
a Ring simulator or an actual Ring device, no third-party trademarks or copyrighted music. Record with no
music at all, show no Ring logos, and use 1080p.

This script is for **demo mode**, and it discloses that plainly. Read [VIDEO_PLAN.md](VIDEO_PLAN.md) first:
it explains the risk, what to send to Devpost, and how to add a real-device clip if you can.

**Before recording**
* `npm start`, open http://127.0.0.1:3000/?intro=0, leave the demo director panel open.
* Open `server/ring/client.js` and `server/ring/receiver.js` in an editor tab, and a terminal in the repo.
* Browser zoom 100%, notifications off, dark or light theme (either works).

| Time | On screen | Say |
|---|---|---|
| 0:00 | Thumbnail 3 s, then the family view | "Anyone who looks after an ageing parent asks one question every day: does today look normal? Cameras answer a different question, and they feel like spying." |
| 0:12 | Still on the family view; point at the **Simulated demo** badge | "Disclosure first. I don't own a Ring device, and Ring doesn't document an official simulator, so this runs against a simulator I wrote from Ring's published API documentation." |
| 0:25 | Headline, then the ring | "Hearthbeat answers the question using only when a Ring device noticed movement. No video, audio or snapshots. The outer band is Margaret's usual day, learned from two weeks of Event History. The inner band is today." |
| 0:42 | Hover the ring, press the arrow keys | "Point at any half hour and it says what is usual. It works with the keyboard too." |
| 0:50 | Dock: **A slow morning**, **Key moment** | "A slow morning. An hour past her usual time it says quieter than usual. Two hours past, worth a call." |
| 1:05 | Open **Why am I seeing this?** | "It always shows its working. No black box, no medical claims." |
| 1:13 | **Send a gentle chime**, confirm, toast | "Instead of an alarm, Dana taps once. This plays a soft sound on Margaret's Ring Chime through the chime audio playback endpoint. Nothing is recorded." |
| 1:28 | Dock: **Dana visits**, **Key moment**, then **Play day**. Banner appears | "Dana arrives. The doorbell press comes in as a signed webhook, and for anyone who can't hear the chime it becomes a big visual alert. Hearthbeat notices a visit explains a quiet spell and eases its message." |
| 1:48 | Scroll to **Under the hood** | "Here are the calls behind that, as they happen. Each is a real HTTP request to Ring's documented paths: devices, Event History with paging, chime playback. This one is the webhook with its signature verified." |
| 2:00 | Switch to **Margaret's view**, point at the access log | "Margaret has her own page. Everything Dana can see, she can see, and every look and every chime is in this log." |
| 2:12 | Click the sharing switch and confirm. Switch to **Dana's view** | "And Margaret holds the off switch. One tap, and Dana sees only that sharing is paused, and the chime is disabled." |
| 2:24 | Editor: `client.js` showing `DEFAULT_BASE_URL`; terminal: `npm run check` green | "The same client points at Ring's real API with a token; that path is written from the docs and tested against my simulator. I haven't been able to run it on a real device. 180-plus tests pass." |
| 2:40 | Thumbnail or README | "Hearthbeat: a calm answer for families, built on Ring events, where the person being cared for stays in charge." |

## If you have a real device

Replace 0:12 with a short live clip: run `npm run live`, show the **LIVE** label in Under the hood and real
paths returning 200, and say which parts are live. Keep the disclosure for anything still simulated.

## Recording tips

* Use **Normal** speed so viewers can follow the clock; **Zoom** crosses long gaps.
* If a take goes wrong, **A usual day** in the dock resets the day, the access log and the call log.
* Keep the cursor still while talking. If text looks small, zoom the browser to 110%.
* Time it with a stopwatch. If you run long, cut the keyboard-arrows beat at 0:42 first.
