# iOS real alarm (Alarmy-style) — deferred until after Android

Status: **not started**. Sequencing: build the Android real-alarm (Notifee full-screen
intent + exact alarm) first; come back to this once that's done.

## Why iOS is a separate, harder problem

There's no Apple entitlement that gets a third-party app the same alarm privilege as the
built-in Clock app. Apps like Alarmy don't use Critical Alerts (that's reserved mainly for
medical/safety apps and rarely granted) — they use a background-audio-session workaround
instead. Confirmed against Alarmy's own support docs: force-quitting the app before bed is
their #1 cause of alarms not ringing, and closing it while silent/DND is on breaks it too.
Real technique, real fragility — not a hypothetical.

## What it takes

1. **Two new libraries in `mobile/`**
   - `expo-background-task` — wraps iOS's `BGTaskScheduler` (and Android WorkManager) with
     a plain JS API. No custom native Swift code needed for the scheduling part.
   - `expo-audio` — needs its audio mode configured to the `.playback` category (not the
     default `.soloAmbient`), which is the actual switch that lets sound play through the
     mute switch and lock screen.

2. **`app.json` changes**
   - `ios.infoPlist.UIBackgroundModes: ["audio", "fetch"]`
   - Register the background task identifier `expo-background-task` requires.

3. **New logic in the app**
   - A background task that wakes up periodically, checks whether we're near the next
     Bruno session (reuse `lib/schedule.ts`), and if so plays the alarm sound through the
     reconfigured audio session.
   - Keep the existing local notification (`lib/notifications.ts`) as a visible companion,
     not a replacement — belt and suspenders.

4. **A new native build**
   - Custom background-mode config means this can't run in the current dev client. Needs a
     fresh `eas build --platform ios` with these changes baked in.

5. **Two hard requirements this introduces**
   - **A real iPhone.** The Simulator doesn't reliably reproduce background-execution
     timing or the physical mute switch — the exact things being tested. Untestable
     without a physical device.
   - **A paid Apple Developer account ($99/yr).** No Mac here, so `eas build` is the only
     path to a real device, and that path requires enrolling the device under a paid
     account — the free tier doesn't cover it. (Same cost the original build plan already
     expected for real App Store builds — just arriving earlier, for testing rather than
     shipping.)

## Caveats to accept even once built

- iOS decides *when* the background task actually runs — not a guaranteed exact-second
  wake-up like Android's exact alarms. "Pretty reliable," not "guaranteed."
- Still fragile if the app is force-quit, same as Alarmy.
- Minor App Store review risk at submission time — Apple sometimes scrutinizes the
  `audio` background mode when it's not obviously continuous playback. Established alarm
  apps get through by being upfront in their listing that they're alarm-clock apps.

## Reference

- [Alarmy: "The alarm isn't ringing" (iOS)](https://www.slimfaq.com/alarmy-en/427-ios/1069-the-alarm-isn-t-ringing)
- [Alarmy alarm not going off — 8 causes and fixes](https://www.wakeupbroo.com/blog/alarmy-alarm-not-going-off)
- [gdelataillade/alarm iOS install guide](https://github.com/gdelataillade/alarm/blob/main/help/INSTALL-IOS.md) — the concrete recipe (audio session category, background modes, `BGTaskScheduler`) this plan is based on.
