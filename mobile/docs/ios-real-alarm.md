# iOS real alarm (Alarmy-style)

Status: **implemented, never actually tested**. The engine and its wiring into real
scheduling both exist in code. What's missing is everything that requires a real iPhone and
a paid Apple Developer account — neither of which has existed yet — so none of this has ever
actually run.

## Why iOS is a separate, harder problem

There's no Apple entitlement that gets a third-party app the same alarm privilege as the
built-in Clock app. Apps like Alarmy don't use Critical Alerts (that's reserved mainly for
medical/safety apps and rarely granted) — they use a background-audio-session workaround
instead. Confirmed against Alarmy's own support docs: force-quitting the app before bed is
their #1 cause of alarms not ringing, and closing it while silent/DND is on breaks it too.
Real technique, real fragility — not a hypothetical.

## What it takes — and where each piece actually lives

The actual trigger is a **continuous background audio session**, not a scheduled OS task —
this is the real mechanism, not an implementation detail. Declaring `audio` in
`UIBackgroundModes` and keeping a silent (or near-silent) `expo-audio` player looping in the
background is what stops iOS from suspending the app at all: as long as that audio session
stays alive, the JS runtime keeps running, and it's the app's *own* in-app timer — checking
wall-clock time against the next Bruno session — that fires the alarm sound/UI at the right
second. There is no "wake me up at 6:00am" API being scheduled here; the app just never goes
to sleep in the first place, for as long as it's allowed to keep audio playing.

`expo-background-task` (wrapping `BGTaskScheduler`) was considered as the scheduling piece,
but that's the wrong tool for this: `BGTaskScheduler` is explicitly deferrable and
opportunistic — iOS decides *if and when* to actually run it based on battery/usage
heuristics, sometimes minutes or hours late, sometimes not at all. That's fine for "sync my
data sometime today," not for "ring at exactly 6:00am." It was left out entirely — there is
no fallback resurrection mechanism built; the background audio session staying alive is the
only thing keeping an armed alarm alive.

1. **`lib/iosAlarmEngine.ts` — built.** The full engine: a near-silent looping
   `expo-audio` player (`assets/audio/keep_alive_silence.mp3`) that keeps the JS runtime
   alive, a 15s poll loop that checks pending targets against the real clock
   (`lib/schedule.ts`), fire/stop/snooze logic, and an `AsyncStorage`-backed pending-target
   store so armed alarms survive a cold start after the OS restarts the process (not a user
   force-quit — see the caveat below, that case is unrecoverable by design).
2. **`app.json` — done.** `ios.infoPlist.UIBackgroundModes: ["audio"]` is set. No
   `expo-background-task` fallback was added (see above — deliberately skipped).
3. **Wired into real scheduling — done.** Both real paths call into the engine:
   `lib/notifications.ts` (Bruno's real 6AM/6PM sessions) and `lib/customAlarm.ts` (your own
   custom alarms) both call `armIOSBackgroundAlarms` when alarms are (re)scheduled, and
   `App.tsx` calls `resumeIOSAlarmEngineIfNeeded()` on cold start. The existing local
   notification stays in place as a visible companion, not a replacement — belt and
   suspenders.
4. **A new native build — not done.** No `ios/` directory has ever been generated for this
   project, and `eas.json` has no iOS-specific build profile configured. This has never been
   built, on simulator or device.
5. **Two hard requirements, neither in place yet:**
   - **A real iPhone.** The Simulator doesn't reliably reproduce background-execution
     timing or the physical mute switch — the exact things being tested. Untestable
     without a physical device.
   - **A paid Apple Developer account ($99/yr).** No Mac here, so `eas build` is the only
     path to a real device, and that path requires enrolling the device under a paid
     account — the free tier doesn't cover it.

## What's actually left before this can be tested at all

1. Get a paid Apple Developer account and a real iPhone (both external, not code).
2. `eas build --platform ios` to generate the native project and produce an installable
   build — first time this will have ever compiled for iOS.
3. Install it on the physical iPhone and actually arm an alarm — first real signal on
   whether any of the above works as designed.
4. Add `NSMicrophoneUsageDescription`/any other iOS `infoPlist` entries Xcode's build
   flags as missing once a real build is attempted — none have been needed yet because no
   build has been attempted.

## Caveats to accept even once tested

- No exact-second guarantee, and there's no OS-level scheduler being trusted here to begin
  with — timing precision depends entirely on the background audio session staying alive so
  the app's own in-app timer keeps ticking. As long as it's alive, firing is precise (it's
  just JS checking the clock); the risk is the session getting killed before the alarm time,
  not the fire being late.
- Force-quit kills it, full stop — this is the single most common failure mode Alarmy itself
  documents. Swiping the app away in the app switcher ends the background audio session,
  which means no more alive JS runtime, which means the alarm simply never fires. There's no
  workaround; the mitigation is user education (don't force-quit an armed alarm), same as
  every app using this trick.
- Minor App Store review risk at submission time — Apple sometimes scrutinizes the
  `audio` background mode when it's not obviously continuous playback. Established alarm
  apps get through by being upfront in their listing that they're alarm-clock apps.

## Reference

- [Alarmy: "The alarm isn't ringing" (iOS)](https://www.slimfaq.com/alarmy-en/427-ios/1069-the-alarm-isn-t-ringing)
- [Alarmy alarm not going off — 8 causes and fixes](https://www.wakeupbroo.com/blog/alarmy-alarm-not-going-off)
- [gdelataillade/alarm iOS install guide](https://github.com/gdelataillade/alarm/blob/main/help/INSTALL-IOS.md) — the concrete recipe (audio session category, background modes, `BGTaskScheduler`) this was based on.
