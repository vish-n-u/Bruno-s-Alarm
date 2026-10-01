import AsyncStorage from "@react-native-async-storage/async-storage";
import * as IntentLauncher from "expo-intent-launcher";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import RNAlarmModule, { type AlarmSubscription } from "react-native-alarmageddon";
import { getAlarmSoundFilePath, refreshAlarmSound } from "./alarmSound";
import { toAlarmDatetime } from "./alarmDateTime";
import {
  cancelAllIOSAlarms,
  cancelIOSAlarmsWithPrefix,
  getAlertingIOSAlarm,
  getIOSAlarmSoundName,
  listIOSAlarms,
  onIOSAlarmAlerting,
  scheduleIOSAlarm,
  snoozeIOSAlarm,
  stopIOSAlarm,
} from "./iosAlarms";
import { isLiveAlarmEnabled } from "./liveAlerts";
import { nextSessions } from "./schedule";

const ID_PREFIX = "bruno-session-";
const TEST_PREFIX = "bruno-test-";
const CUSTOM_PREFIX = "bruno-custom-"; // owned by lib/customAlarm.ts — duplicated here only for classifying listAlarms() output
const SESSIONS_TO_SCHEDULE = 14; // ~1 week of 6AM/6PM sessions
const SNOOZE_MINUTES = 10;
const ANDROID_PACKAGE_NAME = "com.brunosalarm.app"; // matches app.json's android.package

// --- iOS: real alarms through Apple's AlarmKit (lib/iosAlarms.ts, iOS 26+). expo-notifications
// stays for ordinary notifications (e.g. the "Bruno is live" push) and to clear notifications
// left scheduled by older iPhone builds. ---
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
  return (await listIOSAlarms()).some((a) => a.id.startsWith(ID_PREFIX));
}

/** Older iPhone builds scheduled plain notifications; clear any matching the prefix. */
async function clearLegacyIOSNotifications(prefix: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(prefix))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
  );
}

async function clearScheduled(): Promise<void> {
  if (Platform.OS === "android") {
    const alarms = await RNAlarmModule.listAlarms();
    await Promise.all(
      alarms.filter((a) => a.id.startsWith(ID_PREFIX)).map((a) => RNAlarmModule.cancelAlarm(a.id))
    );
    return;
  }
  await cancelIOSAlarmsWithPrefix(ID_PREFIX);
  await clearLegacyIOSNotifications(ID_PREFIX);
}

// Scheduled session alarms fire on the clock, not when the camera actually goes live (he's
// sometimes late), so they must not claim he's live. Only ringForLiveStart below — triggered by
// the camera itself — gets to say that.
const SESSION_TITLE = "🐕 It's Bruno time";
const SESSION_BODY = "His session is starting. Open the app to watch him live.";
const LIVE_TITLE = "🐕 Bruno is live!";

/** Schedules the next batch of session notifications, replacing any previously scheduled. */
export async function scheduleUpcomingSessions(): Promise<void> {
  await clearScheduled();
  // Best-effort refresh of Bruno's latest real recording — the alarm sound on Android (its own
  // native MediaPlayer), and on iPhone when the downloaded-howl switch is on (lib/iosAlarms.ts).
  // Never blocks scheduling if it's unconfigured, offline, or fails.
  await refreshAlarmSound();

  if (Platform.OS === "android") {
    const soundPath = getAlarmSoundFilePath();
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

  const soundName = await getIOSAlarmSoundName();
  for (const timestamp of nextSessions(SESSIONS_TO_SCHEDULE)) {
    await scheduleIOSAlarm({ id: `${ID_PREFIX}${timestamp}`, title: SESSION_TITLE, timestamp, soundName });
  }
}

export async function unsubscribe(): Promise<void> {
  await clearScheduled();
}

/** TEMPORARY test hook — schedules one real alarm ~90s out via the exact same path as a
 * real session, for on-device testing without waiting for 6AM/6PM. */
export async function scheduleTestAlarmSoon(): Promise<void> {
  if (Platform.OS === "ios") {
    await cancelIOSAlarmsWithPrefix(TEST_PREFIX);
    const timestamp = Date.now() + 90000;
    await scheduleIOSAlarm({ id: `${TEST_PREFIX}${timestamp}`, title: "🐕 TEST ALARM", timestamp, soundName: await getIOSAlarmSoundName() });
    return;
  }
  if (Platform.OS !== "android") return;
  const existing = await RNAlarmModule.listAlarms();
  await Promise.all(
    existing.filter((a) => a.id.startsWith(TEST_PREFIX)).map((a) => RNAlarmModule.cancelAlarm(a.id))
  );
  // Uses whatever sound is currently cached (if any) so this debug button doubles as a way
  // to verify the refreshed alarm sound actually plays, without waiting for a real session.
  const soundPath = getAlarmSoundFilePath();
  await RNAlarmModule.scheduleAlarm({
    id: `${TEST_PREFIX}${Date.now()}`,
    datetimeISO: toAlarmDatetime(Date.now() + 90000),
    title: "🐕 TEST ALARM",
    body: "This is a test. Stop or Snooze it.",
    snoozeEnabled: true,
    snoozeInterval: SNOOZE_MINUTES,
    ...(soundPath ? { soundPath } : {}),
  });
}

const LIVE_PREFIX = "bruno-live-";
const LIVE_LEAD_MS = 5000; // the native scheduler needs a moment in the future, not "now"
const SCHEDULED_SESSION_OVERLAP_MS = 2 * 60 * 1000;
// Just enough to swallow a stream that drops and reconnects; long enough windows made back-to-back
// real streams (or tests) silently skip the second ring.
const LIVE_REPEAT_GUARD_MS = 2 * 60 * 1000;

function alarmTimestamp(id: string): number {
  return Number(id.slice(id.lastIndexOf("-") + 1));
}

/** Rings a real alarm right now because Bruno just went live — same engine, sound, ringing
 * screen and Stop/Snooze as a scheduled session (see functions/src/index.ts's
 * cloudflareLiveWebhook, which triggers this via a data push). Only for someone who turned on
 * the separate "Live alarm" opt-in (lib/liveAlerts.ts) — NOT tied to the 6AM/6PM toggle. Skips if a scheduled 6AM/6PM alarm is about to ring anyway (no
 * double ring) or a live alarm already went off in the last few minutes (a reconnect).
 * Android only. */
export async function ringForLiveStart(): Promise<void> {
  if (Platform.OS !== "android") return;
  const alarms = await RNAlarmModule.listAlarms();
  const now = Date.now();

  if (!(await isLiveAlarmEnabled())) return;

  const alreadyCovered = alarms.some((a) => {
    const at = alarmTimestamp(a.id);
    if (a.id.startsWith(ID_PREFIX)) return Math.abs(at - now) <= SCHEDULED_SESSION_OVERLAP_MS;
    if (a.id.startsWith(LIVE_PREFIX)) return Math.abs(at - now) <= LIVE_REPEAT_GUARD_MS;
    return false;
  });
  if (alreadyCovered) return;

  const soundPath = getAlarmSoundFilePath();
  const at = now + LIVE_LEAD_MS;
  await RNAlarmModule.scheduleAlarm({
    id: `${LIVE_PREFIX}${at}`,
    datetimeISO: toAlarmDatetime(at),
    title: LIVE_TITLE,
    body: "He just went live. Open the app to watch.",
    snoozeEnabled: true,
    snoozeInterval: SNOOZE_MINUTES,
    ...(soundPath ? { soundPath } : {}),
  });
}

/** Subscribes to the alarm actually ringing right now (or stopping) — drives the in-app
 * "ringing" screen, since the notification shade may not be reachable while the app is
 * full-screen over the lock screen (Android), or iOS's own alarm screen is showing (AlarmKit;
 * the app shows Bruno's video once opened). */
export function onAlarmRinging(callback: (alarmId: string | null) => void): AlarmSubscription | null {
  if (Platform.OS === "android") return RNAlarmModule.onAlarmStateChange(callback);
  return onIOSAlarmAlerting(callback);
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
  return getAlertingIOSAlarm();
}

export async function stopRingingAlarm(alarmId: string): Promise<void> {
  if (Platform.OS === "android") await RNAlarmModule.stopCurrentAlarm(alarmId);
  else await stopIOSAlarm(alarmId);
  AsyncStorage.removeItem(`${SNOOZED_UNTIL_PREFIX}${alarmId}`).catch(() => {});
}

export async function snoozeRingingAlarm(alarmId: string): Promise<void> {
  if (Platform.OS === "android") await RNAlarmModule.snoozeCurrentAlarm(alarmId, SNOOZE_MINUTES);
  else await snoozeIOSAlarm(alarmId);
  // A snoozed alarm rings again under the same id, so its id no longer says when it started.
  AsyncStorage.setItem(`${SNOOZED_UNTIL_PREFIX}${alarmId}`, String(Date.now() + SNOOZE_MINUTES * 60000)).catch(() => {});
}

const SNOOZED_UNTIL_PREFIX = "bruno-alarm-snoozed-until-";
// A ringing alarm stops by itself after 10 minutes (the patched library's auto-stop).
const MAX_RING_MS = 11 * 60 * 1000;

/** Roughly when the currently ringing alarm's sound started, so the ringing screen's video can
 * start at the same point in the clip. Exact alarms fire at their scheduled time, which is the
 * number at the end of every alarm id; a snoozed alarm fires at the time saved when it was
 * snoozed. Falls back to "now" if neither is plausible. */
export async function getRingStartedAt(alarmId: string): Promise<number> {
  const now = Date.now();
  const plausible = (t: number) => Number.isFinite(t) && t <= now + 5000 && t >= now - MAX_RING_MS;
  const snoozedUntil = Number(await AsyncStorage.getItem(`${SNOOZED_UNTIL_PREFIX}${alarmId}`).catch(() => null));
  if (plausible(snoozedUntil)) return Math.min(snoozedUntil, now);
  const scheduledAt = Number(alarmId.slice(alarmId.lastIndexOf("-") + 1));
  if (plausible(scheduledAt)) return Math.min(scheduledAt, now);
  return now;
}

/** Opens the system "Alarms & reminders" screen for this app (Android 12+). */
export async function openAlarmPermissionSettings(): Promise<void> {
  if (Platform.OS !== "android") return;
  await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_SCHEDULE_EXACT_ALARM, {
    data: `package:${ANDROID_PACKAGE_NAME}`,
  });
}

/** Opens this app's system settings page (Android) — where battery usage and, on phones that
 * have it, auto-start live. The live alarm depends on the app being allowed to wake in the
 * background, which is a per-phone setting the app itself can't change. */
export async function openAppSettings(): Promise<void> {
  if (Platform.OS !== "android") return;
  await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
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
  return (await listIOSAlarms())
    .map((a) => ({ id: a.id, timestamp: a.timestamp ?? NaN, kind: classifyAlarmId(a.id) }))
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
  await cancelAllIOSAlarms();
  await clearLegacyIOSNotifications("");
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
