# Bruno's Alarm — Project Guide

The single document to read before touching this project. It explains what the product is,
how every piece works, how to build and ship it, the traps that have already cost time, and
what's still open. Written 28 Sep 2026; check `git log` for anything newer.

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
- **Live tab** — the live camera when Bruno is on, a "NO SIGNAL" test card when he isn't, and a
  live chat overlay during a stream.
- **Onboarding** (first launch) — three short slides telling one story, main thing first:
  "An alarm clock with a real dog." → "Pick any time." (plays his newest howl, rings on
  silent) → "Catch him live, too." (his times in the user's timezone, live + chat). Last button
  "Set my first alarm" opens the new-alarm sheet on Home; Skip just goes to Home. No questions,
  no permissions. (An earlier version led with the live stream and never said it was an alarm —
  the owner found it confusing, 30 Sep.)
- **Settings** — Bruno's daily alarm toggle, "Ring when Bruno goes live" toggle (Android),
  list of scheduled alarms, Privacy/Terms links, version. **Tap "Version" 7× to unlock a hidden
  Debug section** (test alarm in 90s, force-live, preview onboarding, saved-recording status,
  weather preview, clear all alarms).

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
  screens/                LiveScreen, SettingsScreen, CustomAlarmScreen, BrunosPackScreen (hidden), …
  lib/                    All logic (see §4)
  plugins/                Expo config plugins that customise the native Android project (see §5)
  patches/                patch-package patch for react-native-alarmageddon (see §5)
  docs/                   Topic notes: play-store-checklist, hidden-features, ios-*, live-chat-setup, …
  assets/                 icon.png (app icon master), bruno-photo.jpg (onboarding),
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
| Vercel | Website + `/api/latest-recording` | `https://bruno-s-alarm.vercel.app` — **auto-deploys on every push to `main`** (~1–2 min) |
| Firebase | Chat, push, analytics, crash reports | project `bruno-s-howl` |
| Cloudflare Stream | Live video + automatic recordings | one Live Input (UID in env vars) |
| Cloudflare R2 | Public copies of recordings for phones to download | bucket served at `https://media.brunos-alarm.com` |
| Google Play Console | Store listing | package `com.brunosalarm.app` |
| Expo / EAS | Project ID only (builds are done locally, not on EAS) | owner `vishnuna123` |
| Larix Broadcaster | The phone app that streams Bruno to Cloudflare (RTMP/SRT) | ⚠ free tier burns in a watermark — see §10 |

Contact email used in the app, site and policies: `vishnuna26@gmail.com`.

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
  minutes *stored* per month (every stream is recorded and kept, tests included). Check
  Cloudflare's current pricing.
- Levers if it grows: shorten or drop the replay (`REPLAY_MS` in `screens/LiveScreen.tsx`),
  auto-delete old recordings (a Live Input setting), use a separate test input.

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
  **"Bruno's live — watch"** button when he's live (stops the alarm, opens the Live tab).
- **Sound and video always come from the same clip** (decided 29 Sep, "Option A"):
  - Every Android alarm is scheduled with the same fixed sound path
    (`getAlarmSoundFilePath()`); the native player plays that file if it exists and plays,
    else the built-in howl.
  - The ringing video (`components/AlarmClipVideo.tsx`, not VideoPanel) applies the same rule
    (`getAlarmClipVideoUri()`): the saved file if present, else the bundled
    `Bruno Howl Alarm.mp4` — the same 26 s clip the built-in howl was cut from. If the saved file
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
- **Bruno's Pack** — a persistent always-open chat tab (`screens/BrunosPackScreen.tsx`, room id
  `brunos-pack`) — added to the app in v20/v21. **Shown or hidden for everyone from the server:**
  Firestore doc `config/app`, boolean field `packEnabled` (edit in the Firebase console →
  Firestore Database). `mobile/lib/appConfig.ts` listens to it (changes reach open apps within
  seconds; last value cached for offline launches; missing doc/field = hidden). `sendChatMessage`
  also refuses Pack messages while it's off (30 s cache), so older builds can't post either.
  `config/*` is public-read, no client writes (`firestore.rules`).
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

- **Theme** (`lib/theme.ts`): four palettes chosen by the *real clock*, not system dark mode
  — morning, afternoon, evening (17:00–18:30), night. Fonts: Anton (headlines), Bricolage
  Grotesque (body), Courier Prime (numbers), Caveat (handwritten accents). The website uses
  the same palettes and fonts.
- `components/Touchable.tsx`: the one press component (scale + haptic). Built on
  `Animated.createAnimatedComponent(Pressable)` so the style (incl. absolute positioning) lives
  on the pressable itself — splitting it caused a "button doesn't respond" bug before.
- `lib/schedule.ts`: all IST session maths. `sessionTimesLabel()` gives Bruno's two times in
  the device's own timezone — use it in any copy instead of writing "6AM & 6PM".
- Analytics/crashes: Firebase Analytics + Crashlytics (`lib/analytics.ts`).
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
  `canScheduleExactAlarms`/`canUseFullScreenIntent`, and diagnostic logging (audio-focus
  changes, MediaPlayer error/completion) for an unexplained report of an alarm stopping ~22 s in.
- **Regenerating the patch safely:** after native builds, `node_modules/react-native-alarmageddon`
  contains build output. Reset it first, then re-apply, then edit, then regenerate:
  ```bash
  cd mobile
  rm -rf node_modules/react-native-alarmageddon
  npm install --no-save react-native-alarmageddon@2.1.1
  npx patch-package                 # re-apply the existing patch (install did NOT do it automatically)
  # …make your edits in node_modules/react-native-alarmageddon/android/…
  npx patch-package react-native-alarmageddon
  grep -c "android/build/" patches/react-native-alarmageddon+2.1.1.patch   # must print 0
  ```

---

## 6. The website and `/api/latest-recording`

- Next.js 15 App Router at the repo root. Pages: `/` (landing), `/privacy`, `/terms`, and a
  secret-protected `/status` (legacy). Deployed automatically by Vercel on push to `main`.
- The site follows the visitor's clock with the app's four palettes (`app/layout.tsx` inline
  script + `app/_components/PhaseSync.tsx`) and shows a schedule board in the visitor's
  timezone (`app/_components/DepartureBoard.tsx`).
- `/privacy` is the **official privacy policy URL** (Play Console + app Settings);
  `/privacy#delete-your-data` is the data-deletion URL; `/terms` is the Terms. Keep
  `mobile/privacy-policy.txt/.html` and `mobile/terms-of-service.txt/.html` in sync with them.
  When the Play listing is public, set `PLAY_STORE_LIVE = true` in `app/site.ts`.
- **`GET /api/latest-recording`** (public, no auth):
  1. Lists the Live Input's recordings from the Cloudflare Stream API (token stays server-side).
  2. Picks the newest recording **of a real session**: `status.state === "ready"`, at least
     30 s long, and overlapping a scheduled 06:00/18:00 IST session (from 10 min before to
     30 min after). Test streams, broken recordings and off-schedule streams are ignored, so
     they never become anyone's alarm. The rule lives in `overlapsSession()` in `lib/schedule.ts`.
  3. Mirrors that MP4 into R2 once as `alarm-recordings/<videoUID>.mp4` (unique name per
     recording — a fixed name like `latest.mp4` got stuck in Cloudflare's cache and served old
     bytes), keeps the newest 3, and returns `{ url, recordedAt }`.
  4. Returns `202 { error: "not_ready" }` while Cloudflare is still making the MP4. If
     Cloudflare's MP4 generation **failed** (status `error`, which otherwise stays forever), it
     deletes and re-requests it automatically (`requestDownload()`).
  Mirroring exists to avoid Stream's per-minute delivery fees when many phones download.

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
   (the android folder isn't regenerated automatically). Current: **22**. Play rejects a
   versionCode it has already seen.
2. Build the AAB, upload in Play Console. Commit the version bump.
3. Store assets: `mobile/assets/play-store-icon.png` (512×512) and
   `mobile/assets/play-feature-graphic.png` (1024×500).
   The feature graphic is rendered by a small Python/Pillow script using the app's fonts from
   `mobile/node_modules/@expo-google-fonts/*` (not committed — easy to recreate).

**Install conflict:** a Play-installed copy is signed by Google's key; a local build is
signed with the upload key. They can't update each other — uninstall first (this wipes the
app's alarms/settings on that phone).

Play Console status (as of 28 Sep): content rating done (3+/Everyone, "Users Interact");
Data safety done (Name, Approximate location, Other in-app messages, App interactions, Crash
logs, Diagnostics, Device IDs; nothing shared; encrypted in transit; deletion via
`/privacy#delete-your-data`); target audience should exclude under-13s. See
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
- Cloudflare Stream thumbnail URLs return 403 for this account; to see what a recording
  contains, pull a frame from its R2 copy:
  `ffmpeg -ss 30 -i https://media.brunos-alarm.com/alarm-recordings/<uid>.mp4 -frames:v 1 out.jpg`.

---

## 10. Open issues and decided-but-not-built work (priority order)

1. ~~Recording selection~~ — **FIXED 28 Sep.** `/api/latest-recording` used to take the
   newest recording of any kind, so test streams and broken recordings became everyone's alarm
   (the real 18:00 recording on 28 Sep was blocked by a broken one, then replaced by a 22:23
   test stream). It now only serves real-session recordings (§6). Tip: if you test-stream near
   06:00/18:00 IST for more than 30 s, that test *will* count as a session.
2. **Larix free-tier watermark.** Recordings show a full-screen "TEST STREAM – Powered by
   Larix Broadcaster" overlay, visible in the live feed and baked into recordings. Needs a Larix
   subscription (or another encoder). Owner action, not code.
3. ~~Chat room tied to the clock~~ — **FIXED 28 Sep (app v15)**: one room per Cloudflare
   broadcast (§4.5). Considered alternative, not built: the live webhook writes a room ID to
   Firestore and the app listens to it (instant start/end detection instead of 15 s polling,
   room kept across short camera drops).
4. ~~Live tab after a stream ends~~ — **FIXED 28 Sep (app v15)**: the stream plays to the end,
   frozen streams reload, the app resyncs after returning from the background, no replay, and
   the player reloads when a new recording downloads (§4.3). Needs an on-device test with a
   real stream stop.
   A 5-minute replay of the stream that just ended was added back the right way (its own
   recording, labelled REPLAY). Needs a real test: how soon Cloudflare makes it playable.
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
