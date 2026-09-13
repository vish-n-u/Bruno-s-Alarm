# Bruno's Alarm — mobile app

One React Native (Expo) codebase for both Android and iOS, mirroring the website:
countdown to the next session, a video panel, and a notify-me toggle — with a **real,
DND-bypassing alarm on Android**.

## Run it

Expo Go can't run this app — it needs a custom dev client because of the native alarm
module (`react-native-alarmageddon`). No Mac or Android Studio needed either way, just a
phone connected over USB with a working `adb`:

```bash
npm install
npx expo run:android
```

This builds the native app once and installs it on the connected phone (the app icon is
called **Bruno's Alarm**, not Expo Go). After that first build, for day-to-day JS changes:

```bash
npx expo start
```

then open the already-installed **Bruno's Alarm** app on the phone — it connects to this
Metro server automatically over USB (`adb reverse tcp:8081 tcp:8081` if it doesn't). You
only need to re-run `npx expo run:android` when a *native* dependency changes (a new
package, a permission, a config plugin) — plain JS/TSX edits hot-reload through Metro.

To point it at real video, copy `.env.example` to `.env.local` and fill in
`EXPO_PUBLIC_LIVE_VIDEO_URL` / `EXPO_PUBLIC_VOD_VIDEO_URL` with any direct video file URL
(mp4 works well). This is intentionally separate from the website's YouTube-based setup —
see the note below on why.

## What's here

- **`App.tsx`** — a small state machine: onboarding → home, with a third **ringing** state
  that takes over full-screen whenever an alarm is actually going off.
- **`components/Countdown.tsx`** — identical countdown logic to the website, ported to
  React Native views.
- **`components/VideoPanel.tsx`** — plays the live/VOD video via `expo-video`, given a direct
  video file URL. Not YouTube-embedded — a YouTube iframe loaded inside this app's native
  WebView reliably failed with YouTube's "Error 152-4"/"Error 153" regardless of the video
  or any Referer-header workaround (full debugging trail in
  [`docs/youtube-embed-error-153.md`](docs/youtube-embed-error-153.md)); a direct video file
  sidesteps the whole problem and also matches the plan's own eventual direction (moving off
  YouTube-embedded video to a real video host). Shows the same placeholder as the website
  when no video URL is configured.
- **`components/NotifyToggle.tsx`** + **`lib/notifications.ts`** — schedules the next ~7 days
  of sessions. **Android**: real alarms via `react-native-alarmageddon` (see below).
  **iOS**: local notifications via `expo-notifications` (see the limitations section — a
  true alarm on iOS is a separate, deferred effort documented in `docs/ios-real-alarm.md`).
- **`components/AlarmRingingScreen.tsx`** — the full-screen "Bruno is howling" view with
  Stop/Snooze, shown while an alarm is actively ringing. Needed because the phone may be
  showing the app full-screen over the lock screen, where the notification shade (and its
  own Stop/Snooze buttons) isn't reachable.
- **`lib/schedule.ts`** — the exact same 6AM/18:00 IST time math as the website's
  `lib/schedule.ts`, copied rather than shared through a monorepo package.
- **`plugins/withLockScreenAlarmActivity.js`** — a small Expo config plugin adding
  `android:showWhenLocked`/`android:turnScreenOn` to `MainActivity` (see below).
- **`plugins/withIPv4GradleFix.js`** — forces the Gradle JVM to prefer IPv4. Purely a
  workaround for this dev machine's broken IPv6 routing hitting Maven's IPv6-first DNS
  records — irrelevant on a machine with working IPv6, harmless either way.

## The real Android alarm — how it actually works, and what it took to get there

This isn't a notification with a loud sound — it genuinely rings through Do Not Disturb
and silent mode, confirmed on a real device. Getting there took two failed attempts worth
recording, because the failure modes are non-obvious:

**Attempt 1 (didn't work): a notification channel with `AudioAttributes.USAGE_ALARM`.**
Even with the channel's `bypassDnd: true` and its sound explicitly tagged as the alarm
audio stream, DND still silenced it. The reason: a notification channel's sound — no
matter what audio stream it claims — is still played through the *notification-posting
pipeline*, and DND's suppression logic can gate that pipeline before the sound ever reaches
the audio stream that's supposedly exempt. This is the trap: it looks correct on paper and
still doesn't ring.

**Attempt 2 (worked): `react-native-alarmageddon`.** Verified directly against its source
(`AlarmReceiver.kt`) that it plays sound with its own `MediaPlayer`, configured with
`AudioAttributes.USAGE_ALARM`, entirely independent of the notification system — the same
technique real alarm-clock apps use. That's the actual fix: the sound has to come from the
app's own audio player, never from a notification's sound field.

Separately, a full-screen-intent notification only *launches* an activity — it doesn't make
it stay visible over the lock screen. Without `android:showWhenLocked`/`android:turnScreenOn`
declared on `MainActivity` (which `withLockScreenAlarmActivity.js` adds), the screen would
wake for a moment and then revert to the lock screen instead of staying up with the ringing
screen.

### One-time permissions

Android 12+ and 14+ gate real alarm behavior behind two special-access toggles that can't be
silently granted — `NotifyToggle.tsx` surfaces two buttons ("Allow exact alarms" / "Allow
full-screen alerts") that deep-link straight to the right Settings screen via
`expo-intent-launcher`, so the user doesn't have to hunt for them. On some devices these are
already granted by default the first time the manifest properly declares them; on others
they need a manual tap.

### OEM background restrictions

Phones from Oppo/Realme/Vivo/Xiaomi/Samsung run extra background-restriction layers on top
of stock Android. If alarms stop firing reliably, check the phone's own Security/Phone
Manager app for "auto-start," "allow background activity," and "protected apps" settings —
this is a known pain point for every third-party alarm app on these skins, not specific to
this one.

## iOS — deferred, documented separately

iOS remains on plain local notifications (`expo-notifications`) — reliable-ish, but not a
true silent-mode-bypassing alarm. Apple's Critical Alerts entitlement (the obvious-seeming
fix) is essentially unobtainable for a novelty app; the actual technique third-party iOS
alarm apps use (a background audio session playing real alarm sound) is a real, separate
effort. Full writeup, requirements, and cost implications ($99/yr Apple Developer account,
a real iPhone to test on) are in `docs/ios-real-alarm.md`.

## Building real installable apps (App Store / Play Store)

This machine can build and install debug builds via `npx expo run:android`, but producing a
signed release `.apk`/`.aab` or any iOS build needs [EAS Build](https://docs.expo.dev/build/introduction/)
(Expo's cloud build service — no Mac needed even for iOS):

```bash
npx eas-cli login
npx eas build --platform android
npx eas build --platform ios
```

You'll still need the accounts from the original build plan's cost table: an Apple
Developer account ($99/yr) and a Google Play developer account ($25 one-time). Publishing
to Play Store also requires declaring the "Alarms & reminders" special permission with
justification in Play Console's App Content section — a store-listing step, not code.

## Known limitations

- No accounts, no backend — alarm/notification scheduling is entirely on-device.
- The video panel switches live/VOD purely on the clock (same as the website), not by
  checking whether a stream is actually live.
- Alarm scheduling and audio are Android-only; iOS is notification-only until the deferred
  work above happens.
