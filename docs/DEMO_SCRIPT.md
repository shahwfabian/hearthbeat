# Demo video script (target 2:35, limit 3:00)

Rules from the hackathon: under 3 minutes, public on YouTube or Vimeo, shows the project working through
a Ring simulator or an actual Ring device, no third-party trademarks or copyrighted music. Record with
no music at all (or music you own), do not show Ring logos, and keep the screen at 1080p.

**Before recording**
* `npm start`, open http://127.0.0.1:3000, press **Got it** on the intro, leave the dock open.
* Browser zoom 100%, dark or light theme, notifications off.
* If you have a Ring account and device, record the live segment in step 6 from `npm run live`.
  See "Which Ring source to show" below.

| Time | On screen | Say |
|---|---|---|
| 0:00 | Thumbnail for 3 seconds, then the family view | "Anyone who looks after an ageing parent asks one question every day: does today look normal? Cameras answer a different question, and they feel like spying." |
| 0:15 | Point at the headline and the ring | "Hearthbeat answers it using only when a Ring device noticed movement. No video, no audio, no snapshots. The outer band is Margaret's usual day, learned from two weeks of Ring Event History. The inner band is today." |
| 0:35 | Hover the ring, then press the keyboard arrows | "Point at any half hour and it tells you in plain words what is usual. It works with the keyboard too." |
| 0:45 | Dock: pick **A slow morning**, press **Skip to 10:30 AM** | "Now a slow morning. Margaret hasn't moved yet. An hour past her usual time it says quieter than usual. Two hours past, it says worth a call." |
| 1:05 | Open **Why am I seeing this?** | "It always shows its working: her usual first movement, the tolerance, how late it is. No black box, no medical claims." |
| 1:15 | Click **Send a gentle chime**, confirm, show the toast | "Instead of an alarm, Dana taps once. This plays a soft sound on Margaret's Ring Chime through the chime audio playback endpoint. Nothing is recorded." |
| 1:30 | Dock: **Dana visits** then **Skip to** the visit (use Play at Zoom speed until 9:55 AM) | "Here Dana turns up. The doorbell press arrives as a signed Ring webhook, verified over the raw body." The visual doorbell banner appears. |
| 1:45 | Banner, then the eased note on the status card | "For anyone who can't hear the chime it becomes a big visual alert. And Hearthbeat eases its message, because a visit explains a quiet spell." |
| 1:55 | Switch to **Margaret's view** | "Here is the part I care most about. Margaret has her own page. Everything Dana can see, she can see." |
| 2:05 | Point at the access log (shows the chime and the views) | "Every look and every chime is in an access log." |
| 2:12 | Click the sharing switch, confirm. Switch to **Dana's view** | "And Margaret holds the off switch. One tap and Dana sees only that sharing is paused, and the chime button is disabled." |
| 2:25 | Back to the thumbnail or the README | "Hearthbeat: a calm answer for families, built on Ring events, where the person being cared for stays in charge. Code and setup are in the repo." |

## Which Ring source to show

The rules say the video must show the project working through **a simulator or an actual Ring device you
have for testing**.

* **Best:** record step 0:45 to 1:30 in live mode with your own Ring device (see [LIVE_MODE.md](LIVE_MODE.md))
  so judges see a real device in the loop. Say plainly which parts are live.
* **Fallback:** demo mode uses *our own* mock of the documented Ring API and says "Simulated demo" on
  screen. We could not find an official Ring simulator in Ring's documentation, so say that clearly rather
  than implying the mock is Ring's. Judges may treat this differently, which is a risk to weigh.

## Recording tips

* Use the **Normal** speed for the first scenario so viewers can follow the clock; use **Zoom** to cross
  gaps quickly.
* If a take goes wrong, `A usual day` in the dock resets the whole day and the access log.
* Keep the cursor still while talking. Zoom the browser to 110% if text looks small on a phone.
