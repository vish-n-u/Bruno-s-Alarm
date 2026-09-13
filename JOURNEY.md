# Bruno's Alarm — the journey so far

A running record of what this project is, what's been built, the technology choices and
why, the dead ends that ate real time, and what's deliberately been left out. Written for
future-you (or anyone else) to get oriented without re-deriving all of this from git
history and old conversations.

## The idea

Bruno is a real dog who reliably howls twice a day — 6AM and 6PM — reacting to a nearby
church bell. The app's pitch: a dog that's more punctual than most alarm clocks, streamed
live to people near enough to watch it happen, and served as a recent recording to
everyone else. The original build plan (`bruno-app-build-plan.md`) laid this out in four
phases: validate the idea cheaply (Phase 0, a camera + social clips), a website MVP (Phase
1), native apps (Phase 2), and scaling up video infra only if it takes off (Phase 3).

**Phase 0 (buying the camera, posting clips to validate interest) was explicitly skipped** —
the decision early on was to build the software first and validate content later, not the
order the original plan recommended. Worth knowing: there is still no real camera, no real
livestream, and no real footage of Bruno anywhere in this project. Everything video-related
runs on placeholder content by design.

## Website (`/` — Next.js)

**What it does:** countdown to the next session (timezone-aware), a video panel that shows
live-or-recorded content, and a "notify me" button using Web Push.

**Stack, and why:**
- **Next.js 15 + TypeScript**, deployable to Vercel — chosen for "one codebase, frontend +
  backend API routes" simplicity over standing up a separate backend service.
- **Web Push (`web-push` + VAPID keys)**, not Firebase Cloud Messaging — avoids needing an
  external Firebase project just to send notifications; works natively in the browser.
- **Flat JSON files** (`data/subscriptions.json`, `data/status.json`) instead of a real
  database — deliberately minimal for an MVP with a handful of users. Documented, known
  limitation: **not durable on serverless hosts** (Vercel resets the filesystem between
  invocations) — would need a real datastore (Postgres, Upstash Redis, etc.) before this
  matters at any real scale.
- **`googleapis`** (YouTube Data API v3) — added later to automate creating the twice-daily
  YouTube Live broadcast and detecting when it's actually live, instead of hand-typing video
  IDs. Runs in a **mock mode** by default (no real Google credentials configured yet) that
  fully exercises the pipeline using the same clock-based logic the site always had, so
  everything is testable without ever touching the real YouTube API. Flip to real mode by
  filling in four env vars (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REFRESH_TOKEN`/
  `YOUTUBE_CHANNEL_ID`) — zero frontend code changes needed.
- **GitHub Actions, not Vercel Cron**, for the 5-minute scheduling loop — Vercel's free tier
  caps Cron Jobs at once a day, which can't express "check every 5 minutes."

**Never deployed anywhere.** This entire site has only ever run on `localhost`. There is no
production URL for it yet.

## Mobile app (`mobile/` — Expo / React Native)

**What it does:** the same countdown + video + notify-me idea, but with a genuinely working
Android alarm — not just a notification, an actual alarm that rings through Do Not Disturb
and silent mode, wakes the screen over the lock screen, with a video panel embedded right on
the ringing screen.

### The alarm: three attempts, one that actually worked

1. **`expo-notifications` (Tier 0)** — plain local notifications. Reliable-ish, but respects
   silent mode/DND like any normal app notification. Still what iOS runs today.
2. **`react-native-notify-kit`** (a maintained fork of Notifee, since the original was
   archived) — full-screen intent + `AlarmManager`'s `SET_ALARM_CLOCK`. This *looked* right
   and even wakes the device, but failed two ways on a real device: no sound through
   DND/silent (a notification channel's sound — even one tagged `AudioAttributes.USAGE_ALARM`
   — still routes through the notification-posting pipeline, which DND can gate upstream of
   the audio stream mattering), and the screen woke for a second then reverted to the lock
   screen instead of staying up. Confirmed the real-world proof this was the wrong shape:
   installing **Alarmy** with nothing but notification permission granted rang through DND
   and locked-screen with zero extra setup — proving the problem was architectural, not a
   missing permission or an OEM quirk.
3. **`react-native-alarmageddon`** — a small, purpose-built alarm library. Verified directly
   against its source that it plays sound with its own `MediaPlayer` on the real
   `AudioAttributes.USAGE_ALARM` stream (not through a notification), the same technique real
   alarm-clock apps use. This is what's actually running now. Paired with a small custom
   Expo config plugin (`plugins/withLockScreenAlarmActivity.js`) adding
   `android:showWhenLocked`/`android:turnScreenOn` to `MainActivity`, since even the right
   library doesn't make the launched activity *stay* visible over the lock screen on its own.

A second custom config plugin, `plugins/withIPv4GradleFix.js`, exists purely because this
dev machine's network can't route IPv6 but Maven's CDN returns IPv6-first DNS records,
which made native builds fail intermittently with "No such host is known." Forces the
Gradle JVM to prefer IPv4. Irrelevant on a machine with working IPv6; harmless either way.

**The alarm sound itself was still generic until a real Bruno recording arrived.** Once a
real video of Bruno howling (`assets/videos/Bruno Howl Alarm.mp4`) was added for testing,
the alarm still played a stock ringtone — `react-native-alarmageddon` plays its own sound
via a native `MediaPlayer`, but only from a static bundled resource named exactly
`alarm_default` (checked directly in its `AlarmReceiver.kt`); with none present, it fell
back to the system's default alarm tone. A third config plugin,
`plugins/withAlarmSound.js`, now copies `assets/audio/alarm_default.mp3` (the audio track
extracted from that same video via ffmpeg) into the right native location on every
prebuild, so the alarm's own reliable, DND-bypassing sound is Bruno's real howl instead of
a generic ringtone. Confirmed working on a real device.

One real architectural limit surfaced by this: that native alarm sound **can't be dynamic**
(no live-vs-recorded swap) — it's a build-time-bundled file, which is exactly what makes it
reliable before the JS/React tree or any network request has even started. The ringing
screen's `VideoPanel` stays muted deliberately, even though it's now unmuted-capable —
letting the video's own audio also play would overlap/echo against the looping native sound
for the entire ringing duration (it only stops on Stop/Snooze), not just briefly. So today:
the **visual** on the ringing screen correctly shows live vs. recorded, but the **sound** is
always this one representative howl clip. Making the ringing sound genuinely live-aware
would mean re-architecting how/when the native alarm's own sound gets silenced once real
audio takes over — scoped as a separate, riskier follow-up, not bundled into this fix.

**iOS has no real alarm yet** — deferred on purpose. Apple's Critical Alerts entitlement
(the obvious fix) is essentially unobtainable for a novelty app; the real technique
third-party iOS alarm apps use is a background-audio-session trick, which is a genuine
native-development effort of its own, plus needs a real iPhone and a paid Apple Developer
account just to test. Full writeup: `mobile/docs/ios-real-alarm.md`.

### The video: three attempts at replacing YouTube, one that actually worked — then YouTube got reopened

1. **YouTube embed via `react-native-webview`** — failed outright. First hit "Error 153"
   (YouTube's embed player wants an HTTP Referer header; adding one via the WebView's
   `headers` prop didn't fix it). Switching to an HTML-page-with-`<iframe>`-and-a-spoofed-
   `baseUrl` workaround got past that, straight into a *different* error, "152-4" — a
   real GitHub issue confirmed this specific hand-rolled technique is a fundamental
   limitation: a native WebView's synthetic page isn't good enough for YouTube's embed
   check, even with the right headers/origin. Full trail:
   `mobile/docs/youtube-embed-error-153.md`.
2. **A "well-known" public sample video URL** (Google's `gtv-videos-bucket` test bucket) —
   also failed. Google locked that bucket down at some point; it now 403s for everyone,
   not just this app.
3. **A bundled local video file** (`mobile/assets/videos/sample.mp4`, played via
   `expo-video`) — what's still running in the shipped app today. Zero network dependency,
   can't go dead, can't hit an embed policy.

One real bug worth remembering from this chase: after wiring up the bundled-asset fallback,
the video *still* didn't play — turned out the dead sample URL was still sitting in
`.env.local`, so the `envVar || bundledAsset` fallback never actually triggered (a set env
var pointing at a dead URL is still truthy). Found via `adb logcat`, not code reading —
worth reaching for device logs earlier in a debugging loop like this next time.

**YouTube embedding got reopened after that conclusion turned out to be too broad.** The
"needs a real public domain" finding was true for the *hand-rolled WebView* technique
above, but not for every way of embedding YouTube: `react-native-youtube-iframe` — a
dedicated wrapper around the real IFrame Player API — already defaults to loading its
player page from a real, publicly hosted domain it ships and maintains itself
(`lonelycpp.github.io`, confirmed directly in its source), so it never hits the wall the
DIY attempt did. Installed it, wired up a small test panel
(`mobile/components/YoutubeEmbedTest.tsx`) playing a known-embeddable public video, rebuilt
the native app, and confirmed it plays correctly on the real device.

That proved the embedding *mechanism* works — for an ordinary video, and (in a follow-up
test against a real public live stream) for an actual **live** YouTube stream too, playing
correctly on the real device both times.

**But that test is also what killed YouTube for this project — not the embedding
mechanism, ads.** The live test stream showed a YouTube ad, which led to checking *why*.
Per Google's own support page, YouTube has reserved the right, since a 2020 ToS change, to
place ads on any video regardless of monetization status or channel age — there is no
"too new/too small to have ads" protection, and a separate Content ID path lets a rights
holder place ads on content that matches something they own, independent of the creator
entirely. (An earlier version of this doc claimed a new channel "structurally cannot serve
ads" — that was wrong and has been corrected in
`mobile/docs/youtube-embed-error-153.md`.) That also explained why the player's controls
couldn't be hidden during that test: YouTube overrides control-hiding whenever an ad is
eligible to run, on any video, not just ones from monetized channels.

For an app marketed as a genuine, reliable alarm clock, a random ad over Bruno's face at
6AM isn't an acceptable risk, and there's no way to prevent it while using YouTube's
player — full stop, not a bug to work around. Full trail:
`mobile/docs/youtube-embed-error-153.md`.

### The live-streaming plan: Cloudflare Stream (live) + Cloudflare R2 (recorded)

No camera exists yet, so the capture half is still a plan, not code — but the
hosting/backend decision is now settled, and the app-side code for it already exists.

- **Capture**: an old dedicated phone (Redmi Note 9 Pro, keeping the newer daily phone free)
  running **Larix Broadcaster** (free RTMP encoder app), pointed at Bruno, pushing to a
  Cloudflare Stream live input. Manual start/stop twice a day for now (~5:58 AM/PM);
  automating that is a later step, not part of validating the concept. Larix should also
  save a local recording on the phone while it streams — that file gets uploaded to R2
  after each session, rather than round-tripping through Cloudflare Stream's own recording
  feature.
- **Live half → Cloudflare Stream.** Ruled out Mux (functionally equivalent, no reason to
  run two accounts) and YouTube (the ads problem above, unconditional and unfixable).
  Cloudflare Stream has no ad-insertion mechanism at all — the only one of the real options
  that can actually guarantee no ads, because it's dedicated video infrastructure, not a
  consumer ad-supported platform. Cost is now bounded to just the live minutes (~6/day),
  since the higher-traffic replay half no longer runs through it (see below) — genuinely
  cheap even at real scale.
- **Recorded-replay half → Cloudflare R2, not Cloudflare Stream.** The replay is a single
  fixed short clip served identically to everyone for ~23.9 hours a day — exactly the shape
  R2 (object storage + Cloudflare's CDN caching, zero egress fees at any volume) is built
  for, versus Stream's per-video/per-minute-delivered pricing meant for a full video
  platform. At this app's realistic volume this lands close to $0/month even at
  10,000+ users, because free egress means viewer count doesn't move the bill — the one
  thing that did worry the earlier Mux/Cloudflare-Stream-only plan, since replay viewing
  was always going to be the bigger traffic driver than the live window itself. Trade-offs
  accepted deliberately: no adaptive bitrate (fine for one short, well-compressed clip), no
  built-in analytics, no live support (irrelevant, R2 only handles the recorded half).
- **Live-status detection, now implemented**: `mobile/lib/liveStatus.ts` polls Cloudflare
  Stream's public per-input `/lifecycle` endpoint (no API token needed — it's not the
  authenticated account API) to confirm a broadcast is actually connected, rather than
  trusting `isLiveWindow()`'s clock math alone. `VideoPanel.tsx` only treats the session as
  live if both are true: scheduled window *and* Cloudflare confirms a live connection —
  otherwise it falls back to the recorded replay, so a dead/offline camera at 6AM doesn't
  show as "LIVE." If Cloudflare isn't configured yet (env vars unset), it falls back to the
  old clock-only behavior so local testing/the debug "Force LIVE" toggle keep working
  unchanged.
- **Rejected along the way**: routing only the recorded half through YouTube while live
  stayed on Mux/Cloudflare — didn't work, because the embedding constraint investigated
  first was never live-specific, and the ads problem discovered after isn't either; it
  would've just moved the same unresolved risk onto the higher-traffic replay half.

Net: capture (phone + Larix) is a plan; hosting (Cloudflare Stream + R2) is a decision with
code behind it now; what's still needed is a real Cloudflare account, a live input, and an
uploaded R2 file before this can be tested end to end.

### Everything else in the mobile app

- **Onboarding** — a 3-slide intro, deliberately brash/self-aware in tone ("he's a good boy,
  not a Swiss watch"), ending in the notification opt-in.
- **`lib/schedule.ts`** — the 6AM/18:00 IST time math, copied (not shared via a monorepo
  package) between website and mobile since it's ~50 lines of pure `Date` logic.
- **Debug-only tooling still in the app**, meant to be stripped before any real release: a
  "Test alarm in 90s" button and a "Force LIVE" toggle on the home screen.

## What's been deliberately left out / deferred

- **Real camera, real livestream, real Bruno footage** — none of it exists yet. Every video
  shown anywhere in this project is placeholder content.
- **iOS real alarm** — documented plan exists (`mobile/docs/ios-real-alarm.md`), not built.
- **YouTube Live embedding specifically** — the mechanism (via `react-native-youtube-iframe`)
  is now confirmed working for ordinary video; a real live-stream test is what's still
  missing, blocked on an actual live stream existing to test against (see the live-video
  streaming plan below).
- **Mobile ↔ website unification** — these are two entirely separate systems today. The
  website has real backend automation (mock-mode YouTube API); the mobile app has none of
  that and doesn't talk to the website at all.
- **Analytics / crash reporting, ads, messaging with user accounts** — real future
  directions the user has flagged, all deliberately not started. Full notes:
  `mobile/docs/future-features.md`. The messaging feature specifically would require moving
  off the current anonymous, no-accounts, local-only architecture entirely.
- **A real datastore** for the website (currently flat JSON files) — fine for an MVP, not
  fine at any real scale or once deployed to serverless hosting.

## Play Store readiness (in progress)

Already done: `mobile/eas.json` (build profiles for dev/preview/production), a privacy
policy (drafted and published, contact email confirmed as `vishnuna26@gmail.com`), and
confirmed `com.brunosalarm.app` doesn't collide with an existing Play Store listing. The
user already has an active Google Play developer account and a previously published app
(Notera), so the account/process side of publishing isn't new territory.

Still outstanding, roughly split by who does it:
- **Needs the user's Play Console login specifically** (nothing here can be done by an
  assistant): the Content Rating questionnaire, the Data Safety form, the "Alarms &
  reminders" special-permission declaration, and the actual store submission.
- **Can still be done ahead of time**: a real app icon (still Expo's default placeholder
  art), store listing copy/screenshots (need the debug buttons removed first), and a
  release-build test to catch React Native's common release-mode gotcha — code
  minification (R8/ProGuard) sometimes silently breaks native modules that rely on
  reflection, which hasn't been verified against an actual signed release build yet (only
  debug builds have been tested so far).
