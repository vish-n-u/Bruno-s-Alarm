import * as IntentLauncher from "expo-intent-launcher";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import RNAlarmModule, { type AlarmSubscription } from "react-native-alarmageddon";
import { getCachedAlarmSoundPath, refreshAlarmSound } from "./alarmSound";
import { toAlarmDatetime } from "./alarmDateTime";
import {
  armIOSBackgroundAlarms,
  getIOSActiveRingingAlarm,
  onIOSAlarmRinging,
  snoozeIOSRingingAlarm,
  stopIOSRingingAlarm,
} from "./iosAlarmEngine";
import { nextSessions } from "./schedule";

const ID_PREFIX = "bruno-session-";
const TEST_PREFIX = "bruno-test-";
const CUSTOM_PREFIX = "bruno-custom-"; // owned by lib/customAlarm.ts — duplicated here only for classifying listAlarms() output
const SESSIONS_TO_SCHEDULE = 14; // ~1 week of 6AM/6PM sessions
const SNOOZE_MINUTES = 10;
const ANDROID_PACKAGE_NAME = "com.brunosalarm.app"; // matches app.json's android.package

// --- iOS: unchanged best-effort local notifications. A true alarm on iOS needs the
// background-audio-session approach — see mobile/docs/ios-real-alarm.md (deferred). ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// --- Android: real alarm via react-native-alarmageddon — plays sound with its own
// MediaPlayer on AudioAttributes.USAGE_ALARM (the actual DND-exempt audio stream, verified
// against its source), not through a notification channel's sound. A notification channel's
// sound, even one tagged USAGE_ALARM, still goes through the notification-posting pipeline,
// which DND can gate before the sound plays — confirmed the hard way on a real device. ---

export async function isSubscribed(): Promise<boolean> {
  if (Platform.OS === "android") {
    const alarms = await RNAlarmModule.listAlarms();
    return alarms.some((a) => a.id.startsWith(ID_PREFIX));
  }
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some((n) => n.identifier.startsWith(ID_PREFIX));
}

async function clearScheduled(): Promise<void> {
  if (Platform.OS === "android") {
    const alarms = await RNAlarmModule.listAlarms();
    await Promise.all(
      alarms.filter((a) => a.id.startsWith(ID_PREFIX)).map((a) => RNAlarmModule.cancelAlarm(a.id))
    );
    return;
  }
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  await armIOSBackgroundAlarms("session", []);
}

const SESSION_TITLE = "🐕 Bruno is howling!";
const SESSION_BODY = "The session just went live — open the app to watch.";

/** Schedules the next batch of session notifications, replacing any previously scheduled. */
export async function scheduleUpcomingSessions(): Promise<void> {
  await clearScheduled();
  // Best-effort refresh of Bruno's latest real recording — used as the guaranteed alarm
  // sound on Android (its own native MediaPlayer) and iOS (lib/iosAlarmEngine.ts's ringing
  // player) alike. Never blocks scheduling if it's unconfigured, offline, or fails.
  await refreshAlarmSound();

  if (Platform.OS === "android") {
    const soundPath = await getCachedAlarmSoundPath();
    for (const timestamp of nextSessions(SESSIONS_TO_SCHEDULE)) {
      await RNAlarmModule.scheduleAlarm({
        id: `${ID_PREFIX}${timestamp}`,
        datetimeISO: toAlarmDatetime(timestamp),
        title: SESSION_TITLE,
        body: SESSION_BODY,
        snoozeEnabled: true,
        snoozeInterval: SNOOZE_MINUTES,
        ...(soundPath ? { soundPath } : {}),
      });
    }
    return;
  }

  const timestamps = nextSessions(SESSIONS_TO_SCHEDULE);
  for (const timestamp of timestamps) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}${timestamp}`,
      content: {
        title: SESSION_TITLE,
        body: SESSION_BODY,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(timestamp),
      },
    });
  }
  // Additive companion to the notification above, not a replacement — see
  // docs/ios-real-alarm.md. This is what actually gives sessions a shot at ringing through
  // silent mode/lock screen, via the background-audio-session mechanism.
  await armIOSBackgroundAlarms(
    "session",
    timestamps.map((timestamp) => ({ id: `${ID_PREFIX}${timestamp}`, timestamp, title: SESSION_TITLE, body: SESSION_BODY }))
  );
}

export async function unsubscribe(): Promise<void> {
  await clearScheduled();
}

/** TEMPORARY test hook — schedules one real alarm ~90s out via the exact same path as a
 * real session, for on-device testing without waiting for 6AM/6PM. Android only. */
export async function scheduleTestAlarmSoon(): Promise<void> {
  if (Platform.OS !== "android") return;
  const existing = await RNAlarmModule.listAlarms();
  await Promise.all(
    existing.filter((a) => a.id.startsWith(TEST_PREFIX)).map((a) => RNAlarmModule.cancelAlarm(a.id))
  );
  // Uses whatever sound is currently cached (if any) so this debug button doubles as a way
  // to verify the refreshed alarm sound actually plays, without waiting for a real session.
  const soundPath = await getCachedAlarmSoundPath();
  await RNAlarmModule.scheduleAlarm({
    id: `${TEST_PREFIX}${Date.now()}`,
    datetimeISO: toAlarmDatetime(Date.now() + 90000),
    title: "🐕 TEST ALARM",
    body: "This is a test — Stop or Snooze it.",
    snoozeEnabled: true,
    snoozeInterval: SNOOZE_MINUTES,
    ...(soundPath ? { soundPath } : {}),
  });
}

/** Subscribes to the alarm actually ringing right now (or stopping) — drives the in-app
 * "ringing" screen, since the notification shade may not be reachable while the app is
 * full-screen over the lock screen (Android) or the background-audio engine is what's
 * actually firing it (iOS; see lib/iosAlarmEngine.ts). */
export function onAlarmRinging(callback: (alarmId: string | null) => void): AlarmSubscription | null {
  if (Platform.OS === "android") return RNAlarmModule.onAlarmStateChange(callback);
  return onIOSAlarmRinging(callback);
}

/** Whether an alarm is already ringing right this moment, checked once on app startup — this
 * subscription-only approach in onAlarmRinging() misses the case where the alarm started
 * playing before the JS side finished booting and attached its listener; that "already
 * ringing" event fires once and is never replayed to a late subscriber. */
export async function getActiveRingingAlarm(): Promise<string | null> {
  if (Platform.OS === "android") {
    const active = await RNAlarmModule.getCurrentAlarmPlaying();
    return active?.activeAlarmId ?? null;
  }
  return getIOSActiveRingingAlarm();
}

export async function stopRingingAlarm(alarmId: string): Promise<void> {
  if (Platform.OS === "android") await RNAlarmModule.stopCurrentAlarm(alarmId);
  else await stopIOSRingingAlarm(alarmId);
}

export async function snoozeRingingAlarm(alarmId: string): Promise<void> {
  if (Platform.OS === "android") await RNAlarmModule.snoozeCurrentAlarm(alarmId, SNOOZE_MINUTES);
  else await snoozeIOSRingingAlarm(alarmId);
}

/** Opens the system "Alarms & reminders" screen for this app (Android 12+). */
export async function openAlarmPermissionSettings(): Promise<void> {
  if (Platform.OS !== "android") return;
  await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_SCHEDULE_EXACT_ALARM, {
    data: `package:${ANDROID_PACKAGE_NAME}`,
  });
}

/** Opens the system "Full screen notifications" screen for this app (Android 14+). */
export async function openFullScreenIntentSettings(): Promise<void> {
  if (Platform.OS !== "android") return;
  await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.MANAGE_APP_USE_FULL_SCREEN_INTENT, {
    data: `package:${ANDROID_PACKAGE_NAME}`,
  });
}

export type ScheduledAlarmKind = "session" | "custom" | "test" | "other";

export type ScheduledAlarmSummary = {
  id: string;
  timestamp: number;
  kind: ScheduledAlarmKind;
};

function classifyAlarmId(id: string): ScheduledAlarmKind {
  if (id.startsWith(ID_PREFIX)) return "session";
  if (id.startsWith(CUSTOM_PREFIX)) return "custom";
  if (id.startsWith(TEST_PREFIX)) return "test";
  return "other";
}

/** Every alarm/notification actually scheduled right now, across all three systems
 * (real sessions, the custom alarm, and any leftover debug test alarms) — lets a stale
 * or duplicate alarm (e.g. one orphaned by a crash before its own cleanup could run) be
 * seen and cleared directly, instead of guessed at. */
export async function getAllScheduledAlarms(): Promise<ScheduledAlarmSummary[]> {
  if (Platform.OS === "android") {
    const alarms = await RNAlarmModule.listAlarms();
    return alarms
      .map((a) => ({
        id: a.id,
        timestamp: new Date(a.datetimeISO).getTime(),
        kind: classifyAlarmId(a.id),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled
    .map((n) => {
      const trigger = n.trigger as { type?: string; value?: number; date?: number | Date } | null;
      const timestamp =
        trigger?.type === "date" && trigger.date
          ? new Date(trigger.date).getTime()
          : (trigger?.value ?? NaN);
      return { id: n.identifier, timestamp, kind: classifyAlarmId(n.identifier) };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

/** Cancels every alarm/notification across all three systems — the "something's stuck,
 * just clear it" escape hatch. Does not touch the custom alarm's own enabled/hour/minute
 * AsyncStorage state, only what's actually scheduled at the OS level. */
export async function cancelAllScheduledAlarms(): Promise<void> {
  if (Platform.OS === "android") {
    const alarms = await RNAlarmModule.listAlarms();
    await Promise.all(alarms.map((a) => RNAlarmModule.cancelAlarm(a.id)));
    return;
  }
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    return RNAlarmModule.ensurePermissions();
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}
