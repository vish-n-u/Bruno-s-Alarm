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

The actual trigger is a **continuous background audio session**, not a scheduled OS task —
this is the real mechanism, not an implementation detail. Declaring `audio` in
`UIBackgroundModes` and keeping a silent (or near-silent) `expo-audio` player looping in the
background is what stops iOS from suspending the app at all: as long as that audio session
stays alive, the JS runtime keeps running, and it's the app's *own* in-app timer — checking
wall-clock time against the next Bruno session — that fires the alarm sound/UI at the right
second. There is no "wake me up at 6:00am" API being scheduled here; the app just never goes
to sleep in the first place, for as long as it's allowed to keep audio playing.

`expo-background-task` (wrapping `BGTaskScheduler`) was originally scoped as the scheduling
piece, but that's the wrong tool for this: `BGTaskScheduler` is explicitly deferrable and
opportunistic — iOS decides *if and when* to actually run it based on battery/usage
heuristics, sometimes minutes or hours late, sometimes not at all. That's fine for "sync my
data sometime today," not for "ring at exactly 6:00am." It has a real but secondary role: a
fallback resurrection mechanism, so if the background audio session does get killed (e.g. by
memory pressure) there's still a chance of re-arming state later — never the primary trigger.

1. **Two new libraries in `mobile/`**
   - `expo-audio` — configured to the `.playback` audio session category (not the default
     `.soloAmbient`), which is the actual switch that both (a) lets sound play through the
     mute switch and lock screen, and (b) keeps the app alive in the background as long as
     it's actively playing something.
   - `expo-background-task` — optional, fallback-only (see above). Not the trigger.

2. **`app.json` changes**
   - `ios.infoPlist.UIBackgroundModes: ["audio"]` — this one entry is what keeps the app
     alive in the background; nothing else does the scheduling work.
   - If the `expo-background-task` fallback is included, register the background task
     identifier it requires too — but it stays a secondary safety net, not load-bearing.

3. **New logic in the app**
   - A silent/near-silent looping player (via `expo-audio`) started when the alarm is armed,
     keeping the background audio session — and therefore the JS runtime — alive.
   - An in-app timer, running only because the runtime is alive, that checks the real clock
     against the next Bruno session (reuse `lib/schedule.ts`) and fires the actual alarm
     sound + full-screen UI at that moment — this is the app's own clock doing the firing,
     not an OS-scheduled wake.
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
- [gdelataillade/alarm iOS install guide](https://github.com/gdelataillade/alarm/blob/main/help/INSTALL-IOS.md) — the concrete recipe (audio session category, background modes, `BGTaskScheduler`) this plan is based on.
