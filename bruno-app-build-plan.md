# Bruno — Build Plan

A twice-daily "howl alarm" app: Bruno's real-time reaction to the 6AM/6PM church bell, streamed live to nearby users and served as a recent recording to everyone else, with an alarm-style notification.

---

## Phase 0 — Validate (1-2 weeks, ~$30-50)

Goal: prove the content is actually compelling before building anything.

1. Buy **one TP-Link Tapo camera** (C220 indoor/pan-tilt, or an outdoor Tapo model if Bruno's spot is exposed). Point it at wherever Bruno reliably howls.
2. Record a few 6AM/6PM sessions manually (phone screen-record the Tapo app, or save clips via microSD).
3. Post 3-5 clips on Instagram Reels / YouTube Shorts / X over a week or two.
4. Watch for: do people actually watch to the end? Do they comment, share, come back the next day?

**Decision gate:** if engagement is basically zero after a fair try, stop here — you've spent $30-50 and two weeks, not months of dev time. If there's real pull, move to Phase 1.

---

## Phase 1 — MVP: "Bruno Alarm" without a native app (1-3 weeks)

Goal: deliver the core experience (alarm + video) with the least engineering possible.

### 1.1 Camera → YouTube pipeline
- Enable **RTMP output** on the Tapo camera (via Tapo app settings or ONVIF/RTSP → relay to RTMP if the camera only does RTSP).
  - If Tapo only exposes RTSP (not RTMP directly), run a small always-on relay (a Raspberry Pi or a cheap always-on PC/mini-server at home, or a small cloud VM) using **FFmpeg** to pull the RTSP stream and re-push it as RTMP to YouTube's ingest URL. One command, runs on a schedule.
- Schedule the relay to go live ~10-15 min around 6AM and 6PM only (via cron/Task Scheduler), not 24/7.
- Stream key comes from YouTube Studio → Go Live → Stream.
- Confirm your YouTube channel has live streaming unlocked (may need 24hr wait + verification the first time, and possibly 50+ subscribers on mobile — desktop/API streaming doesn't have that restriction, so this shouldn't block you).

### 1.2 Auto-archive
- YouTube automatically converts the ended livestream into a normal VOD on your channel. This alone solves your "recorded version for other timezones" problem — no separate storage system needed for Phase 1.

### 1.3 The "alarm" without native app complexity
- Build a simple website (not an app yet) with:
  - A page showing "next Bruno session in: [countdown]" per the visitor's local time zone (JS `Intl.DateTimeFormat` handles this trivially).
  - An embedded YouTube player showing either the live stream (if it's India's 6AM/6PM window) or the latest VOD otherwise.
  - A "notify me" button using **Web Push notifications** (works on Android Chrome and desktop; iOS Safari web push support is limited/newer, so treat iOS as best-effort here).
- This gets you a shareable link, real usage data, and zero app store friction — people can try it same-day.

**Stack suggestion for the website:**
- Frontend: plain HTML/CSS/JS or a lightweight framework (Next.js if you want to grow it later)
- Hosting: Vercel or Cloudflare Pages (free tier is plenty at this scale)
- Push notifications: Firebase Cloud Messaging (free, handles the timezone-aware scheduling if you pair it with a small backend cron)
- Backend (minimal): a small Node/Python service (or a few serverless functions) that:
  - Triggers the FFmpeg relay at 6AM/6PM IST
  - Sends push notifications to subscribed users, scheduled per their timezone offset (so everyone effectively gets "their" 6AM/6PM, even if it's really just the same recorded clip)

**Decision gate:** once the website has real recurring visitors/subscribers, move to native apps. Don't build iOS/Android before this.

---

## Phase 2 — Native apps (once validated)

Only build this once Phase 1 shows real retention.

### Android
- Framework: React Native or Flutter (one codebase, ship both platforms) — or native Kotlin if you want the cleanest `AlarmManager` control.
- Alarm mechanism: `AlarmManager.setExactAndAllowWhileIdle()` + a `BroadcastReceiver` that fires a full-screen notification/activity at 6AM/6PM local time, similar to how alarm clock apps work.
- Video: embed via YouTube's Android Player API (or a WebView with the YouTube iframe embed as a simpler fallback).

### iOS
- Same framework choice (React Native/Flutter) for shared code, or native Swift.
- True "alarm that sounds through silent mode" requires Apple's **Critical Alerts entitlement** — this needs a special request to Apple with justification; it's commonly granted for things like medical/safety apps and sometimes rejected for novelty apps. Plan B: a strong local notification (not silenced by DND-bypass, but still reliable) is the realistic default — don't bank on Critical Alerts being approved.
- Video: YouTube iOS Player API or WKWebView with the iframe embed.

### Shared backend needs at this stage
- User accounts (or just anonymous device tokens) to manage per-timezone notification scheduling
- A lightweight admin view for you to confirm each day's stream/recording went out correctly
- Basic analytics (how many opened, how many watched to completion) — Firebase Analytics or Mixpanel free tier is enough

---

## Phase 3 — Only if it's genuinely taking off

- Move off YouTube-embedded video to your own player (Cloudflare Stream/Mux) if you want ad-free, fully branded playback — expect real delivery costs at this point, offset via subscription or ads (see earlier cost breakdown).
- Consider a proper dedicated streaming-grade camera if the Tapo's RTSP reliability becomes a bottleneck.
- Multi-language / regional push notification copy if international audience grows.

---

## Costs at a glance

| Stage | Approx. cost |
|---|---|
| Phase 0 (camera + testing) | $30-50 one-time |
| Phase 1 (website MVP) | ~$0-10/month (free tiers) |
| Phase 2 (native apps) | $99/year (Apple Dev) + $25 one-time (Google Play) |
| Phase 3 (own video infra, if it scales) | $10-300+/month depending on audience |

---

## Immediate next steps for you

1. Order the Tapo camera (or whichever camera you land on) so it's waiting when you're home.
2. When home: connect it to WiFi, confirm RTSP/RTMP access works, and do a manual test stream to YouTube.
3. Set up the YouTube channel now (channel creation + live streaming eligibility can take a day to unlock, so do this in parallel while waiting for the camera).
4. Once camera + YouTube live both work, build the Phase 1 website — that's the fastest path to knowing if this idea has legs.
