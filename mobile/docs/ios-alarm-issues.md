# iOS Alarm Known Issues

These issues are specific to iOS and are deferred — they stem from iOS platform limitations
or require deeper changes to the background-audio-session alarm engine in `lib/iosAlarmEngine.ts`.

---

## 1. `cancelAllScheduledAlarms` doesn't clear the iOS engine state

**File:** `lib/notifications.ts:236`

`cancelAllScheduledAlarms` cancels expo-notifications scheduled notifications but never calls
`armIOSBackgroundAlarms("session", [])` or clears any custom alarm groups from AsyncStorage.
The background engine retains its pending targets and will still fire those alarms even after
the "nuclear option" is used. To fix properly, `cancelAllScheduledAlarms` needs to enumerate
all `bruno-ios-pending-*` AsyncStorage keys and clear them, then call `reconcileEngineState`.

---

## 2. iOS poll interval means alarms fire up to 15 seconds late

**File:** `lib/iosAlarmEngine.ts:38` — `POLL_INTERVAL_MS = 15000`

The background-audio-session engine checks for due alarms every 15 seconds. An alarm
scheduled for exactly 6:00:00 AM may not actually ring until 6:00:14. Reducing the interval
(e.g. to 5000ms) tightens the window but increases battery usage from the polling loop and
more frequent AsyncStorage reads. Needs to be weighed against real-device battery impact.

---

## 3. "once" iOS notification delivers *after* the engine already fired the alarm

**Scope:** iOS only — `lib/customAlarm.ts` and `lib/notifications.ts`

For a "once" repeat alarm on iOS, both a `DATE` trigger notification *and* a background engine
target are scheduled. The engine fires first (correctly, with audio). When the user dismisses
the in-app ringing screen, the expo-notifications `DATE` trigger notification still fires
moments later as a banner, duplicating the alarm experience. The fix would be to cancel the
matching scheduled notification inside `stopIOSRingingAlarm` / `snoozeIOSRingingAlarm`, but
those functions currently don't have access to the alarm's notification identifier. This also
applies to session alarms.

---

## 4. Snooze alarm ID breaks the ringing screen's time label (iOS only)

**File:** `components/AlarmRingingScreen.tsx:18`

The time label is parsed as `Number(alarmId.slice(alarmId.lastIndexOf("-") + 1))`. On iOS,
when a snoozed alarm fires, the engine creates a new ID of the form
`bruno-session-<timestamp>-snooze-<snoozeTime>` (see `iosAlarmEngine.ts:249`). The
`lastIndexOf("-")` then finds the snooze-creation timestamp, not the original session time,
so the ringing screen displays the snooze start time instead of the original scheduled session
time. Fixing this requires either storing the original scheduled time separately in the
ringing record, or changing the snooze ID format to preserve the original timestamp.

---

## 5. Force-quit kills the alarm (documented limitation, no fix possible)

**File:** `lib/iosAlarmEngine.ts` (header comment)

If the user force-quits the app, the background audio session ends and with it the JS runtime.
The poll loop stops and no alarm will fire. The companion expo-notifications local notification
still has a chance of appearing, but without audio. This is the same documented limitation as
Alarmy and similar apps — iOS provides no API to wake a fully-killed process at an exact time.
No fix is possible without a native push-notification backend (APNs) which would require
server-side scheduling.
