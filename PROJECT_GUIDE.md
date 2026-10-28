# Bruno's Alarm — Project Guide

The single document to read before touching this project. It explains what the product is,
how every piece works, how to build and ship it, the traps that have already cost time, and
what's still open. Written 28 Sep 2026, last updated **5 Oct 2026**; check `git log` for
anything newer.

---

## 0. Where we are (snapshot, 5 Oct 2026)

**App version:** `versionCode` **49** (Android, 28 Oct, production release). Built locally; the newest .aab is at
`mobile/android/app/build/outputs/bundle/release/app-release.aab`.

**Phones:** OPPO CPH2737 (owner's main test phone, on v31) and Samsung Galaxy A35 SM-A356E
(on v32). Both run release builds signed with the upload key.

**Google Play:** personal developer account → Google requires a **closed test with ≥ 12 testers
for 14 days** before production. Done in Play Console: content rating, data safety, target
audience, store listing assets, full-screen intent + exact alarm declarations (core function =
alarm), **Advertising ID = No** (requires v25+ bundles), foreground-service issue removed (v27+).
Next: run the closed test (feedback form: `mobile/docs/tester-feedback-form.gs`, a Google Apps
Script that creates the form), then apply for production.

**What changed 2–5 Oct (v20 → v32), all on `main`:**
- Bruno's Pack chat tab live, shown/hidden from Firestore `config/app.packEnabled`; newest-200
  message limit on the server; 🐾 DEV badge from `config/app.developerIds` (§4.5).
- Onboarding uses a transparent cut-out photo (`assets/bruno-cutout.png`).
- Firebase Analytics product events (§4.6); advertising ID removed (v25); expo-audio background
  service removed (v27).
- Settings → About: "About Bruno's Alarm" card and "Contact us" (contact@brunos-alarm.com).
- **v29:** alarm no longer keeps the phone's audio after Stop (Live tab was silent); Live tab no
  longer flips LIVE ↔ REPLAY at stream start or on one failed check (§4.3).
- **v30:** always-visible sound button on the Live tab ("Tap for sound" / "Sound on").
- **v31:** stopped alarms are removed from the saved list (Settings showed them as "pending").
- **v34:** when a stream ends, the replay continues near where the viewer was instead of restarting.
- **v33:** Live tab no longer flashes the saved howl clip before a stream loads ("Connecting to Bruno…").
- **v32:** NO INTERNET screen on the Live tab when offline around a session (`expo-network`).
- Camera: the streaming phone now sends true portrait 1080×1920 (§10 item 2) — the old blur was
  the encoder pillarboxing portrait into a landscape frame, not Cloudflare.
- Removed the failing legacy GitHub Actions cron (`.github/workflows/cron.yml`).

**Waiting on the owner:**
- Run the on-device checklist (alarms locked/swiped, snooze, sound after an alarm, Live tab with
  a real stream incl. start/stop and NO INTERNET, Pack, Contact us) — see §10 item 10.
- Measure the new alarm-download size after a real session (§10 item 2).
- Decide whether the privacy policy / terms / website contact switches from
  `vishnuna26@gmail.com` to `contact@brunos-alarm.com` (the app already uses the new one).
- iPhone: needs an Apple Developer account + Firebase `GoogleService-Info.plist`; work so far is
  on the `ios` branch (§11).

---

## 1. What the product is

Bruno is a real dog who howls at a church bell twice a day, at **06:00 and 18:00 India
Standard Time (IST, UTC+5:30, no DST)**. A phone camera streams him live at those times.

The product has three parts:

| Part | What it does | Where it lives |
|---|---|---|
| **Android app** (Expo / React Native) | Real alarm clock that rings with Bruno's howl, live video, live chat | `mobile/` |
| **Website + small backend** (Next.js on Vercel) | Landing page, Privacy, Terms, and one API the app calls for the latest recording | repo root (`app/`, `lib/`) |
| **Firebase backend** | Live chat (Firestore + Cloud Functions), "Bruno is live" push alerts, analytics/crash reports | `functions/`, `firestore.rules` |

Video runs on **Cloudflare Stream** (live) and **Cloudflare R2** (saved recordings).

What a user sees in the app:
- **Home tab** — their alarms, a card for "Bruno's daily alarm" (while it's off: a one-tap
  "Turn on" offer with "Not now", which hides it for good; once on: the alarm's times), a `+`
  button to add their own alarm, a gear to Settings. Animated sky that follows the real time of day.
- **Live tab** — the live camera when Bruno is on (LIVE badge top-left, sound button top-right,
  starts muted), a 5-minute REPLAY after a stream ends, a "NO SIGNAL" test card when he isn't
  live, "NO INTERNET" when the phone is offline around a session, and a live chat overlay.
- **Bruno's Pack tab** — one always-open chat room; shown only while Firestore
  `config/app.packEnabled` is true.
- **Onboarding** (first launch) — three short slides telling one story, main thing first:
  "An alarm clock with a real dog." → "Pick any time." (newest howl, rings on silent; a
  "Hear Bruno" button plays the bundled howl on media volume) → "Catch him live, too." (his times in the user's timezone, live + chat). Last button
  The last button ("Let's go", since 12 Oct) and Skip both just go to Home; the new-alarm sheet is no longer opened automatically. No questions,
  no permissions. (An earlier version led with the live stream and never said it was an alarm —
  the owner found it confusing, 30 Sep.)
- **Settings** — Bruno's daily alarm toggle, "Ring when Bruno goes live" toggle (Android),
  About (About Bruno's Alarm card, Contact us → contact@brunos-alarm.com), Privacy/Terms
  links, version, list of scheduled alarms. **Tap "Version" 7× to unlock a hidden Debug
  section** (test alarm in 90s, force-live, preview onboarding, my chat id, saved-recording
  status, weather preview, run background refresh, clear all alarms). Force-live resets when
  the app restarts.

Status: **Android beta**, being submitted to Google Play (package `com.brunosalarm.app`).
iOS code paths exist but iOS has never been built or shipped (no `ios/` folder) — see §11 for
the current plan (AlarmKit, cloud builds via EAS).

---

## 2. Repository layout

```
/                         Next.js website + API (deployed to Vercel from GitHub main)
  app/page.tsx            Landing page
  app/privacy, app/terms  Legal pages (the app's Settings links here)
  app/_components/        Site header/footer, schedule board, time-of-day theme sync
  app/site.ts             Contact email, Play Store URL + PLAY_STORE_LIVE flag, effective dates
  app/api/latest-recording/route.ts   ← the only API the mobile app uses (see §6)
  app/api/{cron,subscribe,status}     LEGACY (old YouTube/web-push website) — unused
  app/{Countdown,VideoPanel,NotifyButton}.tsx  LEGACY — unused since the landing page rewrite
  lib/                    Shared web helpers (schedule.ts; the rest is legacy)
  public/                 bruno.jpg (site photo), sw.js (legacy web push)
functions/                Firebase Cloud Functions (TypeScript)
  src/index.ts            sendChatMessage, cleanupOldChat, cloudflareLiveWebhook
  src/chatName.ts         Chat display-name cleaning (+ chatName.test.ts)
firestore.rules           Firestore security rules
firebase.json             Firebase config (predeploy runs the function tests)
mobile/                   The Expo app
  App.tsx                 Root: fonts, onboarding gate, alarm-ringing takeover, tab navigator
  components/             HomeScreen, Onboarding, AlarmRingingScreen, VideoPanel, LiveChat, …
  screens/                LiveScreen, SettingsScreen, CustomAlarmScreen, BrunosPackScreen, …
  lib/                    All logic (see §4)
  plugins/                Expo config plugins that customise the native Android project (see §5)
  patches/                patch-package patch for react-native-alarmageddon (see §5)
  docs/                   Topic notes: play-store-checklist, hidden-features, ios-*, live-chat-setup, …
  assets/                 icon.png (app icon master), bruno-cutout.png (onboarding, transparent),
                          bruno-photo.jpg (permission-dialog lock-screen illustration),
                          play-store-icon.png + play-feature-graphic.png (store listing),
                          videos/ (bundled fallback howl), audio/, animations/
  privacy-policy.txt/.html, terms-of-service.txt/.html   Source copies of the legal text
  credentials/            Release keystore — GITIGNORED, only on this machine (see §9)
  android/                Generated native project — GITIGNORED (see §5)
JOURNEY.md, bruno-app-build-plan.md   Historical notes from earlier phases
```

---

## 3. Accounts and services

| Service | Used for | Identifier |
|---|---|---|
| GitHub | Code | `vish-n-u/Bruno-s-Alarm`, branch `main` |
| Vercel | Website + `/api/latest-recording` | `https://brunos-alarm.com` (www 308-redirects to it; `https://bruno-s-alarm.vercel.app` must keep working, see D22). DNS: Cloudflare CNAMEs, DNS only — **auto-deploys on every push to `main`** (~1–2 min) |
| Firebase | Chat, push, analytics, crash reports | project `bruno-s-howl` |
| Cloudflare Stream | Live video + automatic recordings | one Live Input (UID in env vars) |
| Cloudflare R2 | Public copies of recordings for phones to download | bucket served at `https://media.brunos-alarm.com` |
| Google Play Console | Store listing | package `com.brunosalarm.app` |
| Expo / EAS | Project ID only (builds are done locally, not on EAS) | owner `vishnuna123` |
| Camera streaming app | The phone app that streams Bruno to Cloudflare (RTMP/SRT) | Since 2 Oct: a new app sending true portrait, no watermark — see §10 item 2 |

Contact email: the app's Settings uses **`contact@brunos-alarm.com`** (since v26). The privacy
policy, terms and website (`app/site.ts` `CONTACT_EMAIL`) still say `vishnuna26@gmail.com` —
the owner hasn't decided yet whether to switch them (Play shows the policy's address).

### Environment variables (names only — values live in the files/dashboards, never in chat or git)

- **Root `.env.local`** (and the same names in Vercel's project settings):
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_LIVE_INPUT_UID`,
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`,
  plus legacy YouTube/VAPID/CRON/STATUS vars that the current product doesn't need.
- **`mobile/.env.local`** (inlined into the app at build time — nothing secret here):
  `EXPO_PUBLIC_CF_STREAM_CUSTOMER_CODE`, `EXPO_PUBLIC_CF_LIVE_INPUT_UID`,
  `EXPO_PUBLIC_LIVE_VIDEO_URL`, `EXPO_PUBLIC_VOD_VIDEO_URL`, `EXPO_PUBLIC_BACKEND_URL`.
- **`functions/.env`**: `CF_WEBHOOK_SECRET` (shared secret Cloudflare sends in the
  `cf-webhook-auth` header), `CF_LIVE_INPUT_UID`.

### Costs (decided 29 Sep: keep as is for now)

- **R2** (the alarm clip): free downloads, ~3 small files stored → pennies. That's why the alarm
  clip is served from R2 rather than straight from Stream.
- **Cloudflare Stream** is the real cost: roughly $1 per 1,000 minutes *watched* (live + the
  5-minute replay — the replay can double or triple watch minutes) and roughly $5 per 1,000
  minutes *stored* (every stream is recorded, tests included). Check Cloudflare's current pricing.
- **Recordings auto-delete after 30 days** (Live Input `deleteRecordingAfterDays: 30`, verified
  11 Oct: all recordings carry a `scheduledDeletion`). Stored minutes stay ~one month's worth
  (~45–60 min), well inside the prepaid 1,000. Download any clip you want to keep before then.
- First invoice (9 Sep–8 Oct): **$7.08** = $5 storage block + $1 viewing block (80 min watched)
  + 18% GST; R2 $0. Expect about that monthly until viewing passes 1,000 min/month.
- Levers if it grows: shorten or drop the replay (`REPLAY_MS` in `screens/LiveScreen.tsx`),
  use a separate test input.

---

## 4. How the Android app works

### 4.1 The alarm engine (the most important and most fragile part)

- Alarms are real Android alarms via **`react-native-alarmageddon`** (patched, §5). It uses
  `AlarmManager` exact alarms, a full-screen intent to show over the lock screen, and its own
  native `MediaPlayer` on the **alarm audio stream (`USAGE_ALARM`)**. That is what makes it ring
  through silent mode and Do Not Disturb. Notification-channel sounds do **not** do this — that
  approach was tried and failed; don't go back to it.
- The ringing UI is the app's own `MainActivity` shown over the lock screen
  (`plugins/withLockScreenAlarmActivity.js`), rendered as `components/AlarmRingingScreen.tsx`:
  full-screen Bruno video (muted) + **Stop** and **Snooze 10 min**, plus a
  **"Watch Bruno live"** button when he's live (stops the alarm, opens the Live tab).
- **Sound and video always come from the same clip** (decided 29 Sep, "Option A"):
  - Every Android alarm is scheduled with the same fixed sound path
    (`getAlarmSoundFilePath()`); the native player plays that file if it exists and plays,
    else the built-in howl.
  - The ringing video (`components/AlarmClipVideo.tsx`, not VideoPanel) applies the same rule
    (`getAlarmClipVideoUri()`): the saved file if present, else the bundled
    `Bruno Howl Alarm.mp4` — the same 35 s clip the built-in howl is taken from (new clip 8 Oct; drop the clip in unchanged (owner prefers the original file) and copy its audio to `assets/audio/alarm_default.mp3` AND `android/app/src/main/res/raw/`). If the saved file
    won't play, it switches to the built-in clip too (the native player would have).
  - It never shows the live stream, never downloads, and the saved file is never replaced while
    an alarm rings (`setAlarmRinging()` in `lib/alarmSound.ts`).
  - Sync: the video starts where the sound is, from when the alarm started
    (`getRingStartedAt()`: the id's timestamp, or the saved snooze time). Two separate players,
    so ~1 s, not frame-perfect. Re-syncs when the screen comes back on.
  - Saved clips that aren't from a real session (legacy test clips) are deleted
    (`removeInvalidSavedRecording()`), so alarms fall back to the built-in howl.
  - Alarms set by versions before 16 are re-scheduled once on launch
    (`lib/alarmSoundMigration.ts`, never while an alarm rings). An alarm that rings before the
    app is first opened after updating can still mismatch once.
- Alarm IDs encode their type and time: `bruno-session-<ms>`, `bruno-custom-<…>-<ms>`,
  `bruno-live-<ms>`, `bruno-test-<ms>`. The ringing screen's title depends on the prefix:
  live → "Bruno is live!", session → "It's Bruno time", custom → "Your Bruno alarm".
- Android has no "repeat daily" in this library, so the app **pre-schedules a rolling batch**
  and tops it up whenever the app opens or a toggle changes:
  - **Bruno's daily alarm** (`lib/notifications.ts`, `scheduleUpcomingSessions`): next **14**
    sessions (~1 week). Toggle in Settings (`components/NotifyToggle.tsx`). Scheduled on the
    clock — they fire at 06:00/18:00 IST whether or not the camera is actually live.
  - **Custom alarms** (`lib/customAlarm.ts`): user-chosen times with repeat modes
    (once / every day / weekdays / custom days), next **14** days each. Edited in
    `components/EditCustomAlarmModal.tsx` (custom scroll-wheel picker that marks Bruno's slots).
- **Permissions** (`lib/alarmPermissions.ts`): notifications, exact alarms ("Alarms &
  reminders"), full-screen intent. Asked when the user first turns on an alarm, with plain
  explanations, and **only if actually missing** — normally all three are already granted, so
  nothing is shown. Onboarding no longer asks for anything.
  - The dialogs are the app's own, not system Alerts: `askPermission()` in `lib/dialog.ts`,
    rendered by `components/AppDialogHost.tsx` (mounted once in `App.tsx`). **Every** user-facing
    pop-up in the app goes through `showDialog()` there (chat Report/Block menu, "Clear all
    alarms?", "Pick at least one day"); only debug tools still use `Alert`. Each is a looping illustration (`components/PermissionIllustration.tsx`: a mini
    switch flips on, then the payoff — e.g. Bruno filling a locked phone) + a title + one short
    line (+ "1 of 2" when chained) — the owner wants these as short as possible. Copy for
    every prompt lives in `PROMPTS` in `lib/alarmPermissions.ts`.
  - Full-screen intent (Android 14+) is what puts the ringing screen over the lock screen. Play
    grants it automatically to apps whose Play Console "Full-screen intent" declaration says
    *alarm* (that's why Alarmy never asks). Keep that declaration filled in, or Play revokes it
    and every user would get the "Show alarms over the lock screen" prompt.
  - `USE_EXACT_ALARM` is likewise auto-granted to declared alarm apps.
- Audio focus: the patched AlarmReceiver keeps the exact `AudioFocusRequest` it requested and
  abandons **that** object on stop (v29). Before, it abandoned a freshly built request, which
  Android ignores — the app held focus forever after Stop and the Live tab went silent
  (verified with `adb shell dumpsys audio` → "Audio Focus stack entries").
- Saved-alarm list: the library keeps every scheduled alarm in SharedPreferences
  (`rn_alarm_module_alarms`, read by `listAlarms()`) and originally only removed it on cancel, so
  alarms that already rang stayed "pending" in Settings. Since v31 the patched AlarmReceiver
  removes it on Stop and on the 600 s auto-stop (not on snooze), and Settings'
  `getAllScheduledAlarms()` also hides anything more than a minute in the past.
- The patched library auto-stops a ringing alarm after **600 s** and has a volume guard; the
  ringing screen also swallows the hardware volume keys (`plugins/withVolumeKeyBlock.js`).

### 4.2 The alarm sound = Bruno's latest recording

- `lib/alarmSound.ts` asks the backend (`/api/latest-recording`, §6) for the newest recording,
  downloads the MP4 to the phone (`alarm_sound_latest.mp4` in the app's documents folder), and
  passes that path to every scheduled alarm as `soundPath`. `MediaPlayer` plays only its audio.
- The same file is shown as the video on the ringing screen and as the Live tab's replay.
- If there's no download yet, alarms use the **bundled** howl (`plugins/withAlarmSound.js`
  puts it in the APK as the `alarm_default` raw resource). The alarm never needs the network
  at the moment it rings.
- Refresh triggers: scheduling, app coming to foreground (max once per 5 min), a background
  task every ~15 min (`lib/backgroundRefresh.ts`), and the ringing/Live screens. "Not ready"
  answers are retried after ~1, 3 and 8 minutes. A download is only saved after it completes
  and its size matches.
- The backend only hands out recordings of real sessions (§6), so test streams don't reach alarms.

### 4.3 Live video and the Live tab

- `components/VideoPanel.tsx` plays either the Cloudflare **live HLS** feed or the saved
  recording. It decides "live" by polling Cloudflare's public
  `…cloudflarestream.com/<liveInputUID>/lifecycle` endpoint every **15 s**
  (`lib/liveStatus.ts`). The Live tab polls all day (catches off-schedule streams); the ringing
  screen only asks near session times.
- It watches the live video's playback position once a second:
  - when Cloudflare says the broadcast stopped, it keeps playing until the viewer's remaining
    footage runs out (video still for 3 s, or 30 s max), then reports "not live";
  - while still live, a video that hasn't moved for 15 s is reloaded (max 3 times in a row).
- Leaving the app pauses the video; coming back to a live stream reloads it at the live moment.
- If the live player errors, it falls back to the recording.
- When a new recording downloads, the player reloads it (`onAlarmRecordingChanged` in
  `lib/alarmSound.ts`) — the file path never changes because scheduled alarms point at it.
- `screens/LiveScreen.tsx`: live → video + LIVE badge + chat. When a stream ends, it replays
  **that stream's own recording** (Cloudflare HLS by its `videoUID`,
  `getCloudflareRecordingManifestUrl()`) for **5 minutes** with a grey REPLAY badge and chat
  closed, then shows the "NO SIGNAL" card with the next session time. If the replay can't play
  (Cloudflare not ready yet), it goes straight to NO SIGNAL. It never replays the phone's saved
  clip (that was the old behaviour and showed old/test clips).

- **Live tab robustness (v29):** `getCloudflareLiveStatus()` returns `reachable: false` for a
  failed/timed-out request ("unknown", not "off"); VideoPanel only ends a stream it's showing
  after **2 "not live" answers in a row** (second one 5 s later), and a live-feed **playback
  error is retried every 3 s up to 10 times** before falling back — a new stream isn't playable
  for its first seconds and encoder reconnects cause gaps. Before this, either one caused the
  LIVE ↔ REPLAY flip-flopping seen on 4 Oct.

- **Stream end → replay continues (v34):** when the camera stops, Cloudflare drops the live feed
  immediately (the live-input manifest returns **204**), so a viewer ~30 s behind only has a few
  buffered seconds left. The replay (the stream's recording) is then started that far before its
  end instead of from 0: `player.currentOffsetFromLive + 8 s` when the player reports it (usually
  null — Cloudflare's playlists have no PROGRAM-DATE-TIME), otherwise 30 s
  (`DEFAULT_LIVE_DELAY_S`). If the recording is still processing (too short), it starts from 0.
- **No hidden clip (v33):** the Live tab's player plays **nothing** when Bruno isn't live and
  there's no replay (it used to play the saved howl clip under NO SIGNAL, which flashed on
  screen when a stream started). A black "Connecting to Bruno…" / "Loading the replay…" screen
  covers the player until the new source's first frame (`onFirstFrameRender`, with a
  playback-position backup).
- **No internet (v32):** `screens/LiveScreen.tsx` uses `expo-network`'s `useNetworkState()`. If
  the phone is offline (`isConnected` or `isInternetReachable` is `false`) **and** Bruno is/was
  live or it's around a session (`isNearLiveWindow()`), the tab shows a NO INTERNET screen (same
  style as NO SIGNAL) instead of a frozen video; chat and the LIVE badge are hidden meanwhile.
  Outside session time an offline phone still just sees NO SIGNAL.

### 4.4 "Ring when Bruno goes live" (optional, Android)

- `lib/liveAlerts.ts` subscribes the device to the FCM topic `live`.
- When Cloudflare reports the stream connected, the backend webhook (§7) sends a visible push
  and a data push. `lib/liveAlertRinger.ts` (registered at app entry, `index.ts`) turns the
  data push into a real `bruno-live-` alarm via `ringForLiveStart` in `lib/notifications.ts`,
  skipping it if a daily alarm is about to ring anyway or a live alarm just rang.
- Less reliable than the daily alarm by nature (needs the OS to wake the app for a push).
  `components/LiveAlarmSetupSheet.tsx` is one line + a "Turn it on" button;
  its "Turn on" runs `ensureLiveAlarmPermissions()` (`lib/alarmPermissions.ts`): the normal
  alarm permissions, then — only if the app is battery-restricted (native
  `isIgnoringBatteryOptimizations`, added by the alarmageddon patch) — offers the app's settings
  page to set Battery → Unrestricted. Skippable.

### 4.5 Live chat

- `components/LiveChat.tsx` + `lib/chat.ts`. Only shown and subscribed while live.
- Identity: Firebase **Anonymous Auth** (no accounts). Display name = an optional name typed on
  the one-time "Before you chat" screen (`components/ChatTermsGate.tsx`, shown before the first
  message; older versions asked during onboarding and that saved name is kept), otherwise the
  server's generated "Viewer NNNN"; the server re-cleans it (`functions/src/chatName.ts`: strips
  control chars, collapses spaces, max 24 chars, replaces profane or staff-impersonating names).
- **Writes only through the `sendChatMessage` Cloud Function**; Firestore rules forbid direct
  client writes. The function enforces: max 200 characters, profanity filter, **1 message per
  3 s per device**, **500 messages per session**.
- One-time rules gate before first send (`components/ChatTermsGate.tsx`); report a message
  (`components/ReportMessageModal.tsx` → `reports` collection) and block a viewer (local only).
- Chat room ID = `stream-<videoUID>`, where `videoUID` is Cloudflare's ID for the current
  broadcast (returned by the `lifecycle` check, same on every phone), so each stream gets its
  own room. Falls back to the clock-based `currentSessionId()` (`YYYY-MM-DD-AM|PM`) only when
  there's no ID (debug force-live). App versions before 15 still use the clock-based room.
  If the camera drops and Cloudflare starts a new recording, the chat starts a new room.
- Messages are deleted by `cleanupOldChat` ~2 hours after a room goes quiet.
- **Live chat switch** (24 Oct): `config/app.liveChatEnabled` — currently **false** (off for launch).
  Off = the Live tab shows no chat (v48+) and the server refuses live messages from any version.
- **Howl ratings** (v47): "Watch his last howl" shows "Rate this howl" (1–5 paws) and the average.
  Callable `rateHowl` (functions/src/index.ts) keeps `howlRatings/{videoUid}` = { count, sum }
  plus `votes/{deviceUid}`; rules: summary public-read, a vote readable only by its own phone,
  no client writes. App: `lib/howlRatings.ts`, `components/LastHowlPlayer.tsx`. Analytics
  `howl_rated`. (A test doc `howlRatings/000…0` with 2 votes exists from the 20 Oct test.)
- **Bruno's Pack** — a persistent always-open chat tab (`screens/BrunosPackScreen.tsx`, room id
  `brunos-pack`) — added to the app in v20/v21. **Shown or hidden for everyone from the server:**
  Firestore doc `config/app`, boolean field `packEnabled` (edit in the Firebase console →
  Firestore Database). `mobile/lib/appConfig.ts` listens to it (changes reach open apps within
  seconds; last value cached for offline launches; missing doc/field = hidden). `sendChatMessage`
  also refuses Pack messages while it's off (30 s cache), so older builds can't post either.
  `config/*` is public-read, no client writes (`firestore.rules`).
  **Each user can also hide the tab on their own phone** (since v44 code, 13 Oct): Settings →
  Chat → "Show Bruno's Pack tab", offered only while `packEnabled` is on. Stored locally
  (`lib/packPreference.ts`, AsyncStorage `bruno-pack-tab-hidden`); the tab shows only when the
  owner's switch is on AND the user hasn't hidden it. Analytics: `pack_tab_shown|hidden`.
- **DEV badge:** `config/app.developerIds` (array of strings) lists chat ids (anonymous Firebase
  uids) that get a paw "DEV" pill next to their name in both chats (`components/DevBadge.tsx`).
  Trusted because a message's `deviceId` is stamped by `sendChatMessage`, never the app. Applies
  to old messages too. A phone's id: Settings → tap Version 7× → "> my chat id" (Share/copy).
  Reinstalling the app gives that phone a new id.
  Same function, rules, rate limit, terms gate, report/block as live chat. It's exempt from the
  500-per-session cap and from `cleanupOldChat`; instead `trimPersistentRoom` in
  `functions/src/index.ts` keeps only the **newest 200 messages** (after each Pack message: a
  count query, then deletes the oldest extras, archiving any reports on them first). Privacy
  policy, terms and landing page updated to describe both chats (effective 2 Oct 2026).

### 4.6 Other pieces

- **Theme** (`lib/theme.ts`): seven palettes chosen by the *real clock*, not system dark mode
  — dawn (05:00–06:30, dark sky + warm glow around the sun in `Sky.tsx`), morning, afternoon
  (11:00–16:00), golden hour (16:00–17:00), evening/sunset (17:00–18:30), dusk (18:30–19:30),
  night. Dawn, dusk and night are dark (light status bar). No em dashes in user-facing copy
  (owner's rule, 7 Oct). Fonts: Anton (headlines), Bricolage
  Grotesque (body), Courier Prime (numbers), Caveat (handwritten accents). The website uses
  the same palettes and fonts.
- `components/Touchable.tsx`: the one press component (scale + haptic). Built on
  `Animated.createAnimatedComponent(Pressable)` so the style (incl. absolute positioning) lives
  on the pressable itself — splitting it caused a "button doesn't respond" bug before.
- `lib/schedule.ts`: all IST session maths. `sessionTimesLabel()` gives Bruno's two times in
  the device's own timezone — use it in any copy instead of writing "6AM & 6PM".
- Analytics/crashes: Firebase Analytics + Crashlytics (`lib/analytics.ts`). Since v24 the app
  sends product events through `track.*` (all names/params in that one file), viewed in the
  Firebase console → Analytics (Explore → funnel/path explorations for "what did they do before
  uninstalling"). Firebase adds first_open, session_start, user_engagement (time on screen),
  app_remove (uninstall, Android) on its own. Nothing personal is sent (no names, chat text, ids).
  - Screens: `screen_view` for every navigator screen (App.tsx `onStateChange`) plus
    `Onboarding` and `AlarmRinging`.
  - `onboarding_complete` {set_first_alarm}; `daily_alarm_on|off` {source: settings|home_card};
    `custom_alarm_saved` {is_new, repeat}, `custom_alarm_on|off`, `custom_alarm_deleted`;
    `live_alarm_on|off`.
  - Ringing screen: `alarm_rang`, `alarm_stopped` {seconds_ringing}, `alarm_snoozed`,
    `alarm_watch_live` — all with {alarm_type: session|custom|live|test}. Only counted when the
    ringing screen shows (not when stopped from the notification).
  - `live_watched` {state: live|replay} when it starts showing on an open Live tab.
  - Chat {room: live|pack}: `chat_terms_accepted`, `chat_message_sent`, `chat_message_reported`,
    `chat_user_blocked`.
  - `permission_prompt` {setting, opened_settings} for each of the app's permission dialogs.
  - **No advertising ID** (since v25): `mobile/firebase.json` sets
    `google_analytics_adid_collection_enabled: false`, and `app.json` `blockedPermissions`
    removes `AD_ID` + `ACCESS_ADSERVICES_AD_ID/ATTRIBUTION` (the generated android manifest was
    also patched by hand, since `android/` isn't re-prebuilt). Play Console → App content →
    Advertising ID is answered **No**. Keep it that way unless ads are added.
  - **No typed foreground service** (since v27): `expo-audio` is configured with
    `enableBackgroundPlayback: false` (it was on by default and only ever needed for the old
    iPhone keep-awake engine), which drops `FOREGROUND_SERVICE_MEDIA_PLAYBACK` and its
    `AudioControlsService` — so Play's "Foreground service permissions" declaration isn't needed.
    Alarm sound is unaffected (react-native-alarmageddon plays it natively, no foreground
    service). Plain `FOREGROUND_SERVICE` remains from WorkManager (background refresh); that's
    untyped and doesn't need the declaration.
  - To watch events live while testing: `adb shell setprop debug.firebase.analytics.app
    com.brunosalarm.app`, then Firebase console → Analytics → DebugView.
- Weather-reactive sky exists but is hidden (`WEATHER_HINTS_ENABLED = false` in `lib/weather.ts`).

---

## 5. The native Android project, plugins and patch

- `mobile/android/` is **generated** by `npx expo prebuild` and is **gitignored**. It exists
  on this machine and is what Gradle builds, but a fresh clone must regenerate it. Every
  customisation therefore lives in a **config plugin** in `mobile/plugins/` (registered in
  `app.json`):
  `withLockScreenAlarmActivity` (show over lock screen), `withVolumeKeyBlock`,
  `withAlarmSound` (bundled howl), `withReleaseSigning` (use the real keystore),
  `withFirebaseMessagingColorFix` (manifest merge conflict), `withIPv4GradleFix`
  (this machine's network breaks on IPv6 Maven mirrors).
- `mobile/patches/react-native-alarmageddon+2.1.1.patch` (applied by `postinstall:
  patch-package`) adds: `soundPath` support, auto-stop 60 → 600 s, a volume guard,
  `canScheduleExactAlarms`/`canUseFullScreenIntent`/`isIgnoringBatteryOptimizations`, releasing
  the **same** audio-focus request on stop (v29), removing stopped alarms from the saved list
  (v31), and diagnostic logging (audio-focus changes, MediaPlayer error/completion) for an
  unexplained report of an alarm stopping ~22 s in.
- **Regenerating the patch:** `npx patch-package react-native-alarmageddon` does **not** work
  here — the published package itself ships an `android/build/` folder, so the diff fills with
  build files (and Windows "Filename too long" errors). What works (used 1–4 Oct): edit the files
  in `node_modules/react-native-alarmageddon`, then diff the 4 patched files against a clean copy
  from npm and write the patch by hand:
  ```bash
  mkdir tmp && cd tmp && npm pack react-native-alarmageddon@2.1.1 && tar -xzf *.tgz
  P=node_modules/react-native-alarmageddon
  for f in android/src/main/java/com/rnalarmmodule/AlarmModule.kt \
           android/src/main/java/com/rnalarmmodule/AlarmReceiver.kt lib/index.d.ts src/index.ts; do
    mkdir -p "orig/$P/$(dirname $f)" "new/$P/$(dirname $f)"
    cp "package/$f" "orig/$P/$f"; cp "../mobile/$P/$f" "new/$P/$f"; done
  git diff --no-index --src-prefix=a/ --dst-prefix=b/ orig new \
    | sed -e 's#a/orig/#a/#g' -e 's#b/new/#b/#g' > ../mobile/patches/react-native-alarmageddon+2.1.1.patch
  cd ../mobile && npx patch-package --reverse && npx patch-package   # must both print ✔
  ```

---

## 6. The website and `/api/latest-recording`

- Next.js 15 App Router at the repo root. Pages: `/` (landing), `/privacy`, `/terms`, and a
  secret-protected `/status` (legacy). Deployed automatically by Vercel on push to `main`.
- The site follows the visitor's clock with the app's seven palettes (`app/layout.tsx` inline
  script + `app/_components/PhaseSync.tsx`) and shows a schedule board in the visitor's
  timezone (`app/_components/DepartureBoard.tsx`).
- **Fun pass (28 Oct):** `app/fun.css` + `_components/HeroSky.tsx` (sun/moon on the visitor's clock,
  clouds, a leaf), `LastHowl.tsx` (newest session from `/api/last-howl` — which now also returns
  `thumbnail` + `embedUrl` — played via Cloudflare's iframe, with the rating average read from
  Firestore `howlRatings` REST), `StoryScene.tsx` (SVG + CSS port of the app's About scene; note a
  CSS transform replaces an SVG `transform` attribute, so animated parts sit inside a positioned
  `<g>`). Media in `public/media/` (howl loop ~1 MB, screenshots ~150 KB). Blog: `app/blog/posts.tsx`
  (facts only), `/blog`, `/blog/[slug]`.
- `/privacy` is the **official privacy policy URL** (Play Console + app Settings);
  `/privacy#delete-your-data` is the data-deletion URL; `/terms` is the Terms. Keep
  `mobile/privacy-policy.txt/.html` and `mobile/terms-of-service.txt/.html` in sync with them.
  When the Play listing is public, set `PLAY_STORE_LIVE = true` in `app/site.ts`.
- **`GET /api/latest-recording`** (public, no auth):
  1. Lists the Live Input's recordings from the Cloudflare Stream API (token stays server-side).
  2. Picks the newest recording **of a real session**: `status.state === "ready"`, at least
     30 s long (the owner's rule for the looping alarm; DECISIONS.md D1), and overlapping a scheduled 06:00/18:00 IST session (from 10 min before to
     30 min after). Test streams, broken recordings and off-schedule streams are ignored, so
     they never become anyone's alarm. The rule lives in `overlapsSession()` in `lib/schedule.ts`.
  3. Mirrors that MP4 into R2 once as `alarm-recordings/<videoUID>.mp4` (unique name per
     recording — a fixed name like `latest.mp4` got stuck in Cloudflare's cache and served old
     bytes), keeps the newest 3, and returns `{ url, recordedAt }`.
  4. Returns `202 { error: "not_ready" }` while Cloudflare is still making the MP4. If
     Cloudflare's MP4 generation **failed** (status `error`, which otherwise stays forever), it
     deletes and re-requests it automatically (`requestDownload()`).
  Mirroring exists to avoid Stream's per-minute delivery fees when many phones download.
- **`GET /api/last-howl`** (public): the newest real session **of 20 s or more** as
  `{ uid, recordedAt, duration }`, for the Live tab's "Watch his last howl", which streams it by
  uid (HLS). Separate from the alarm clip on purpose (DECISIONS.md D1a). Session rules for both
  routes live in `lib/sessionRecordings.ts`.

---

## 7. Firebase backend (`functions/`)

- **`sendChatMessage`** (callable) — see §4.5.
- **`cleanupOldChat`** (hourly schedule) — deletes a session's messages ~2 h after its last
  message (reported messages are archived first), never touches the `brunos-pack` room.
- **`cloudflareLiveWebhook`** (HTTP, configured as a Cloudflare Stream webhook):
  - Checks the `cf-webhook-auth` header against `CF_WEBHOOK_SECRET` (constant-time compare).
  - Only reacts to `live_input.connected` / `live_input.disconnected` for our Live Input.
  - Tracks the current stream in Firestore `system/liveSession` so a stream sends **one**
    "Bruno is live" push (a transaction claims it). Disconnect deletes the doc; a stale doc
    (> 3 h) is treated as expired so a missed disconnect can't block alerts forever.
  - Sends a visible FCM push ("🐕 Bruno is live!") and a data push to topic `live`.
- **Firestore rules**: `sessions/*` and their `messages` are public-read, no client writes;
  `rateLimits` private; `reports` create-only for signed-in users; everything else denied.
- **Deploy:** `cd functions && npm run deploy` — runs `tsc` + unit tests (`node --test lib/`)
  first; `firebase.json`'s predeploy also runs the tests. If deploy fails with "Cannot
  determine backend specification … Timeout after 10000", run it with a longer load allowance:
  `FUNCTIONS_DISCOVERY_TIMEOUT=60000 npx firebase deploy --only functions` (worked 2 Oct).

---

## 8. Building, installing, releasing

All builds are **local** (Windows machine, Gradle), not EAS.

```bash
# Typecheck
cd mobile && npx tsc --noEmit                    # app
cd .. && npx tsc --noEmit -p tsconfig.json       # website (slow, ~2 min)

# Dev loop (debug dev client + Metro hot reload)
cd mobile && npx expo run:android                # once, or after native changes
npx expo start                                   # then open the installed app

# Release APK for a phone over USB
cd mobile/android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk

# Release AAB for Google Play
cd mobile/android && ./gradlew bundleRelease
#  → mobile/android/app/build/outputs/bundle/release/app-release.aab (~75 MB)
```

Releasing a new Play build:
1. Bump **`versionCode` in BOTH `mobile/app.json` and `mobile/android/app/build.gradle`**
   (the android folder isn't regenerated automatically). Current: **49**. Play rejects a
   versionCode it has already seen.
2. **Build clean**, or Gradle may reuse a cached JS bundle (Play v39 shipped app.json from v38 —
   its Settings said "(38)"): delete `app/build/generated/res/react`, `app/build/generated/assets/react`,
   `app/build/intermediates/merged_res/release`, `.../packaged_res/release` and `.../intermediates/assets`
   under `mobile/android`, then `./gradlew bundleRelease`. **Verify**: unzip the AAB and
   `strings base/assets/index.android.bundle | grep "<some text you just changed>"`. Settings → Version
   now reads the installed package's own version/build (`expo-application`), so it's always true.
3. Upload in Play Console. Commit the version bump.
4. Store assets: `mobile/assets/play-store-icon.png` (512×512) and
   `mobile/assets/play-feature-graphic.png` (1024×500).
   The feature graphic is rendered by a small Python/Pillow script using the app's fonts from
   `mobile/node_modules/@expo-google-fonts/*` (not committed — easy to recreate).

**Install conflict:** a Play-installed copy is signed by Google's key; a local release build is
signed with the upload key; a debug build (`npx expo run:android`) is signed with the debug key.
None can update another — `adb install` fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`;
uninstall first (this wipes the app's alarms/settings and gives the phone a new chat id). Check
a phone's copy with `adb shell dumpsys package com.brunosalarm.app | grep -E "versionCode|pkgFlags"`
(`DEBUGGABLE` = a debug build).

**Replacing a bundled asset under the same file name** (e.g. the default howl video) is NOT
picked up by an incremental Gradle build: the APK keeps the old copy. Delete
`mobile/android/app/build/generated/res/react`, `.../generated/assets/react`,
`.../intermediates/merged_res/release` and `.../intermediates/packaged_res/release`, rebuild, and
check with `unzip -l app-release.apk | grep mp4` (8 Oct).

**If a release build fails with `ENOTEMPTY … metro-cache`:** delete
`%TEMP%\metro-cache` (PowerShell `Remove-Item -Recurse -Force`) and build again.

Play Console status (as of 5 Oct): content rating done (3+/Everyone, "Users Interact");
Data safety done (Name, Approximate location, Other in-app messages, App interactions, Crash
logs, Diagnostics, Device IDs; nothing shared; encrypted in transit; deletion via
`/privacy#delete-your-data`); target audience 13+; store icon/feature graphic/screenshots
uploaded; full-screen intent + exact alarm declared as "alarm"; Advertising ID declared **No**.
Personal account → closed test (≥ 12 testers, 14 days) before production. See
`mobile/docs/play-store-checklist.md`.

---

## 9. Gotchas that have already cost time

- **The release keystore exists only in `mobile/credentials/` on this machine** (gitignored).
  Back it up somewhere safe. Losing it means a Play upload-key reset through Google.
- **Don't write files with Bash heredocs when they contain backslashes** (regex `\b`, `\s`,
  `\u0000`…). In this environment they were turned into raw control bytes, which silently broke
  production chat-name cleaning. Use the editor's Write/Edit tools for such files.
- **Windows npm scripts don't expand globs** — `node --test lib/*.test.js` fails; use
  `node --test lib/`.
- **Animated + native driver:** animating `fontSize` forces the JS thread and caused lag and
  flicker in the time-picker wheel. Use `transform: scale` and `color` (native-driver safe).
- **Don't use `snapToInterval` for long lists on Android.** React Native converts it to whole
  pixels by dropping the decimal, so on phones with a non-round density (e.g. Samsung A35 at
  2.8125) the 44-unit rows (123.75 px) snapped every 123 px and the looping time wheel drifted
  until it stopped between two numbers. The wheel uses `snapToOffsets` (one stop per row, each
  within a pixel) instead.
- The time picker is a plain clock on purpose — no Bruno times highlighted or hinted (owner
  found it pushy, 29 Sep).
- **`adb` on Git Bash:** use `//sdcard/...` (double slash) to avoid path mangling. For precise
  taps, dump the UI (`adb shell uiautomator dump //sdcard/ui.xml`, `adb pull`) and read element
  bounds instead of estimating from screenshots. The test phone is 1080×2373.
- The phone's log buffer only keeps a few minutes — capture `adb logcat -d` right after a
  problem happens.
- To see what a recording contains: Cloudflare's thumbnail URL works
  (`https://customer-<code>.cloudflarestream.com/<uid>/thumbnails/thumbnail.jpg?time=8s&height=1920`),
  or pull a frame from the R2 copy:
  `ffmpeg -ss 30 -i https://media.brunos-alarm.com/alarm-recordings/<uid>.mp4 -frames:v 1 out.jpg`.
  The size the camera actually *sent* is `input.width/height` on the live input's videos
  (Cloudflare API, `CLOUDFLARE_API_TOKEN` in root `.env.local`).
- **Who holds the phone's audio:** `adb shell dumpsys audio`, section "Audio Focus stack
  entries". After an alarm is stopped, Bruno's Alarm must not be listed (that was the v29 bug).
- `uiautomator dump` fails ("could not get idle state") while the app is animating; use
  screenshots (`adb exec-out screencap -p > s.png`) instead.

---

## 10. Open issues and decided-but-not-built work (priority order)

1. ~~Recording selection~~ — **FIXED 28 Sep.** `/api/latest-recording` used to take the
   newest recording of any kind, so test streams and broken recordings became everyone's alarm
   (the real 18:00 recording on 28 Sep was blocked by a broken one, then replaced by a 22:23
   test stream). It now only serves real-session recordings (§6). Tip: if you test-stream near
   06:00/18:00 IST for more than 30 s, that test *will* count as a session.
2. ~~Larix watermark and poor video quality~~ — **FIXED 2 Oct (camera app change, no code).**
   Cause of the blur: Larix/Streamlabs sent a **landscape frame (1280×720 / 2560×1440) with the
   upright camera picture pillarboxed in the middle**, so Bruno was only ~400–600 px wide, then
   the app's full-screen "cover" enlarged that strip ~3×. Not Cloudflare: its API reports the
   size it *received* (`input.width/height` on the live input's videos), and those were
   landscape; Cloudflare makes portrait renditions (up to 1080×1920) when it receives portrait.
   - Tried: Larix (free = watermark), Streamlabs (camera output only landscape for us),
     PRISM (portrait OK but "PRISM Live" watermark is forced with custom RTMP), IRL Pro (no
     portrait). The owner now uses **another free app** that sends true **1080×1920**, no
     watermark (verified 2 Oct: received 1080×1920, top rendition 1080×1920 @ ~4.5 Mbps, 30 fps).
   - Encoder settings to keep: **1080×1920 portrait output** (not just camera orientation),
     **30 fps**, **4–5 Mbps**, **2 s keyframe interval**, AAC 128 kbps / 48 kHz.
   - Check any new setup: stream ~30 s, then list the live input's videos via the Cloudflare
     API and read `input` width × height — it must be 1080 × 1920.
   - Follow-up: alarm recordings are bigger now (expect ~20–25 MB per 50 s instead of ~8 MB);
     measure after the next real session and decide on bitrate / Wi-Fi-only download.
3. ~~Chat room tied to the clock~~ — **FIXED 28 Sep (app v15)**: one room per Cloudflare
   broadcast (§4.5). Considered alternative, not built: the live webhook writes a room ID to
   Firestore and the app listens to it (instant start/end detection instead of 15 s polling,
   room kept across short camera drops).
4. ~~Live tab after a stream ends~~ — **FIXED 28 Sep (app v15)**: the stream plays to the end,
   frozen streams reload, the app resyncs after returning from the background, no replay, and
   the player reloads when a new recording downloads (§4.3). Needs an on-device test with a
   real stream stop.
   A 5-minute replay of the stream that just ended was added back the right way (its own
   recording, labelled REPLAY). Cloudflare needs a few minutes after a stream ends to finish
   the recording (32 s stream on 4 Oct: ready ~9 min later), so the replay may be partial or skip
   straight to NO SIGNAL at first — expected.
   **4 Oct real-session bugs, FIXED in v29:** (a) no sound on the Live tab after stopping an
   alarm — the alarm never released audio focus (see §4.1); (b) LIVE ↔ REPLAY flip-flopping —
   a new stream errors for its first seconds and any single failed status check counted as
   "offline" (see §4.3). Also seen: the 6 AM stream on 4 Oct arrived as 3 separate recordings
   (encoder reconnecting) — check the streaming phone's connection / auto-reconnect.
   Alarm sound and ringing video matching — **built 29 Sep (Option A, §4.1), app v16**; needs an
   on-device test (normal ring, snooze, ring during a live stream, first ring after updating).
5. ~~Bruno's Pack 200-message cap~~ — **built and deployed 2 Oct**; the tab is on (§4.5).
6. ~~Discoverability of Bruno's daily alarm~~ — **FIXED 28 Sep (app v15)**: a dismissible
   "Turn on" card on Home (`components/HomeScreen.tsx`).
7. **Unexplained "alarm stopped after ~22 s" report** — investigation deferred by the owner;
   native logging was added so the next occurrence can be diagnosed from logcat.
8. Deferred by the owner: volume lock as a user setting; iOS release (plan in §11); cleaning up
   the legacy web player code and routes.
9. Untested on device: tapping Undo was removed (delete is immediate again); the live-alert
   dedupe with a real reconnecting stream; volume-key blocking end to end.
14. **PARKED (6 Oct): exact replay position per viewer.** v34 starts the replay a fixed ~30 s
    before the recording's end (the player rarely knows its real delay). Owner wants it exact
    for every viewer, whatever their delay. Idea: the live feed and the recording are both made
    of numbered ~2 s pieces (`seg_N`); if the live playlist uses the same numbers, the app can
    note which piece the viewer was on when the feed cut and start the replay exactly there.
    Next step: inspect the live playlist **during a live stream** to confirm the numbering.
10. **Owner's on-device checklist for v29–v32 (not done yet):** (A) preview onboarding photo,
    About / Contact us, Pack send + DEV badge + Report/Block, `packEnabled` off/on; (B) test
    alarm with phone locked + app swiped away, Stop → no leftover in Settings, Snooze rings again,
    other audio works right after Stop; (C) real stream: open Live tab in the first seconds (no
    LIVE/REPLAY flipping), sound button, 6 PM alarm → Stop → Live with sound, stream stop →
    REPLAY → NO SIGNAL, chat; force-live + airplane mode → NO INTERNET; (D) optional DebugView.
11. **Closed testing on Play** (personal account): ≥ 12 testers for 14 days, then apply for
    production. Feedback form script: `mobile/docs/tester-feedback-form.gs`.
12. **Contact email in legal pages/site** still `vishnuna26@gmail.com` (app uses
    `contact@brunos-alarm.com`) — owner to decide; make sure the new inbox receives mail.
15. **Play Console warnings on release 47 (28 Oct), plan: v50 after launch.**
    (a) **DEX obfuscation 2%, fix by Feb 2027**: enable R8 (`android.enableMinifyInReleaseBuilds`)
    with keep rules for react-native-alarmageddon, Firebase, expo-video; full on-device alarm retest
    (locked, silent, snooze, live alert) before shipping — R8 broke release builds here before.
    (b) **Deprecated edge-to-edge APIs (Android 15)**: generated `styles.xml` sets
    `statusBarColor`/`navigationBarColor`; remove via a config plugin. Some calls come from libraries
    and clear with Expo/RN updates. No visible effect (edge-to-edge is already on).
    (c) **Orientation/resizability (Android 16 large screens)**: app is portrait-locked; Android 16
    ignores that on tablets/foldables. Keep portrait for phones; later test a tablet in landscape.
13. Later / optional: turn on R8 code shrinking (Play flags "DEX optimization: Low"; needs a
    full re-test, R8 has broken release builds here before); remove the ~20 harmless launcher
    "badge" permissions; delete the legacy website routes (`app/api/{cron,subscribe,status}`) and
    the now-unused GitHub secrets `CRON_SECRET` / `APP_URL`; remove the old iPhone keep-awake
    engine from `main` (`lib/iosAlarmEngine.ts`) once the `ios` branch is merged.

---

## 11. iOS — current state and plan (discussed 29 Sep–1 Oct, not started)

**Status:** Android first. iOS waits until the Android app is launched and stable. Nothing has
been built for iPhone yet; the owner hasn't yet confirmed an Apple Developer account or an
iPhone to test on.

**iPhone work in progress lives on the `ios` git branch** (AlarmKit module, iOS alarm path; not
merged, never built) — its copy of this section has the details. Below is the state of `main`.

**What exists (never run):** `lib/iosAlarmEngine.ts` — the Alarmy-style "keep the app awake"
trick (near-silent looping background audio keeps the app alive; an in-app timer rings the
alarm), wired into `lib/notifications.ts` and `lib/customAlarm.ts`, with
`UIBackgroundModes: ["audio"]` in `app.json`. Background in `mobile/docs/ios-real-alarm.md`;
five known bugs in `mobile/docs/ios-alarm-issues.md`. Weaknesses: swiping the app away means
the alarm never rings, battery drain, up to 15 s late, and Apple may reject background-audio
abuse.

**Recommended direction: replace that with Apple's AlarmKit (iOS 26+).**
- Real system alarms like the Clock app: ring through silent mode and Focus, work after the app
  is swiped away or the phone restarts, lock screen + Dynamic Island with Stop/Snooze, custom
  sound (could be Bruno's latest recording).
- Limits: iOS 26 and newer only. The alarm UI is Apple's, so **no full-screen Bruno video on
  the lock screen** — the video shows only when the user taps into the app (biggest difference
  from Android). Needs a small native Swift module. Verify details (sound length limits, where
  the sound file must live) against Apple's docs before building.
- iOS 26 runs on **iPhone 11 and later, and iPhone SE (2nd gen) and later** (it dropped XS, XS
  Max, XR) — nearly every iPhone in use, once updated.

**Rest of the app on iPhone:** live video easy (HLS is Apple's format); chat easy (Firebase —
needs `GoogleService-Info.plist`); "Bruno is live" push medium (upload an APNs key to
Firebase); "Ring when Bruno goes live" hard (iOS won't reliably let a push start an alarm —
likely a plain notification on iPhone); shared screens/website/legal pages need little. The
Android-only pieces (lock-screen activity plugin, volume-key block, patched
react-native-alarmageddon) don't carry over.

**Building without a Mac — Expo EAS Build (cloud Macs):**
1. One-time: Apple Developer account ($99/yr); `npm install -g eas-cli`; `eas login` (Expo
   owner `vishnuna123`); `eas build:configure` (creates `eas.json` with an iOS profile);
   `eas device:create` (link opened on the iPhone registers it for test builds).
2. `eas build --platform ios` uploads the project; a cloud Mac generates the iOS project from
   `app.json`, installs pods, compiles with Xcode and signs it (EAS creates/manages Apple
   certificates after one Apple login). ~15–30 min (longer on the free queue). Install via the
   link/QR it returns.
3. Day to day: JS-only changes don't need a rebuild — run `npx expo start` on the PC and the
   test app on the iPhone reloads over Wi-Fi. Native changes (AlarmKit module, permissions,
   app.json) need a new cloud build.
4. Testers / release: `eas submit --platform ios` → App Store Connect → TestFlight for testers,
   then the App Store listing (screenshots, privacy labels) and Apple review (stricter than
   Play; chat already has report/block, which Apple requires).
5. Without a Mac there's no Xcode debugger or iPhone system logs — only the app's own logs and
   Crashlytics. Native (AlarmKit) bugs mean build-test-guess cycles; renting a cloud Mac for a
   few hours is the fallback.
6. Cost: Apple $99/yr; EAS free tier has limited monthly builds and slower queues (check
   Expo's current pricing).

**Owner decisions (1 Oct):** Android first, iOS after. iOS 26+ only is fine. Test device:
iPhone 15. Apple Developer account not bought yet.

**Alarmy tested on the owner's iPhone 15, iOS 26 (1 Oct)** — the model for our iOS build:
- First launch asks Apple's AlarmKit permission ("Allow … to schedule alarms and timers? … even
  if a Focus is active"), plus notifications (and ad tracking — not relevant to us, no ads).
- **Rang with the app swiped away, in Do Not Disturb and on silent.** AlarmKit is reliable.
- Ringing screen is **Apple's**: alarm title ("Wake up early"), big time, app name, "slide to
  stop". No custom screen/video. (No snooze shown — Alarmy's choice; AlarmKit allows one extra
  button, e.g. Snooze or "Watch Bruno" opening the app — verify.)
- Volume rose gradually ("Gentle wake-up") even with the app swiped away — unclear whether
  AlarmKit fades in or the sound file itself does. Not needed for us.
- Swiping Alarmy away triggers its notification "Open Alarmy again — If app is closed, only
  basic sound rings". We could copy this nag.

**The fresh-howl problem on iOS:** with the app closed, iOS plays the alarm sound itself from a
file named in advance — either in the app bundle (fixed until an app update) or in
`Library/Sounds` (where a downloaded daily howl would go). Apple documents `Library/Sounds` as
supported, but developers report it's **ignored (falls back to the default sound)** — Apple
Developer Forums thread 798140, FB19779004, filed Aug 2025, still open Feb 2026. Likely why
Alarmy plays "only basic sound" when closed.
- **First thing to test in the first iOS build** (before building the rest): download a howl
  into `Library/Sounds`, schedule an AlarmKit alarm with it, swipe the app away, see what plays.
- Works → fresh howl daily, same as Android.
- Still broken → fallback: the alarm rings with a **bundled** Bruno howl; tapping it opens the
  app, which plays today's fresh howl + video; if the app is still alive in the background it
  plays the fresh howl itself; each app update can bundle a newer howl.
- The owner wants the fresh howl, so this test decides the iOS sound design.

---

## 12. Working style the owner expects

- Say what was **verified** (ran it, saw it on the phone, read the logs) versus **assumed**.
  Check real data (logs, recordings, the live API) before explaining a bug.
- Fix root causes; keep changes scoped to the request; ask before destructive or
  outward-facing actions (deploys, pushes, uninstalling, deleting data).
- Copy in the app is short and plain; humour is about Bruno, never about whether the alarm
  works. Use one name per feature ("Bruno's daily alarm", "Ring when Bruno goes live") and
  local times, never a bare "6AM & 6PM".
- Tagline everywhere (app Home, website hero, Play feature graphic): **"A real dog. Live twice
  a day."** Don't use "Two alarms a day" — it reads as if the app only sets two alarms, when
  people can set as many of their own as they like.
- Commit with clear messages once work is confirmed; the owner often asks to build an AAB or
  install on the USB-connected phone after changes.
