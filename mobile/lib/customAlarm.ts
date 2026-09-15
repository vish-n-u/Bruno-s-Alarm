import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import RNAlarmModule from "react-native-alarmageddon";
import { getCachedAlarmSoundPath, refreshAlarmSound } from "./alarmSound";
import { toAlarmDatetime } from "./alarmDateTime";
import { armIOSBackgroundAlarms } from "./iosAlarmEngine";

// A second, independent alarm path alongside lib/notifications.ts's Bruno-session
// scheduling — lets someone set genuinely free-choice wake times, unrelated to when Bruno
// actually howls. Deliberately kept separate: lib/schedule.ts and lib/notifications.ts's
// bruno-session- alarms are about Bruno's fixed real schedule and stay untouched by this
// file. Supports any number of independently-named alarms, each toggled on its own — the
// same shape as a normal phone's alarm clock list.
const STORAGE_KEY = "bruno-custom-alarms";
const ID_PREFIX = "bruno-custom-";
const DAYS_TO_SCHEDULE = 14;
const SNOOZE_MINUTES = 10;

export type RepeatMode = "once" | "everyday" | "weekdays" | "custom";

export type CustomAlarm = {
  id: string;
  /** User-chosen label, e.g. "Wake up" — shown in the list in place of a generic title. */
  name: string;
  hour: number;
  minute: number;
  enabled: boolean;
  repeatMode: RepeatMode;
  /** 0=Sun..6=Sat, matching Date.getDay(). Only meaningful when repeatMode === "custom". */
  customDays: number[];
};

export async function getCustomAlarms(): Promise<CustomAlarm[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getCustomAlarm(id: string): Promise<CustomAlarm | null> {
  const all = await getCustomAlarms();
  return all.find((a) => a.id === id) ?? null;
}

async function saveAllCustomAlarms(alarms: CustomAlarm[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
}

/** The next occurrence (ms) of a given local hour/minute, today if it hasn't passed yet,
 * otherwise tomorrow. Used for "Once". */
function nextLocalOccurrence(hour: number, minute: number): number {
  const now = new Date();
  const cursor = new Date(now);
  cursor.setHours(hour, minute, 0, 0);
  if (cursor.getTime() <= now.getTime()) cursor.setDate(cursor.getDate() + 1);
  return cursor.getTime();
}

/** Next `count` occurrences (ms) of a given local hour/minute, restricted to the given
 * weekdays (0=Sun..6=Sat), starting from the next upcoming one. Plain local Date math —
 * deliberately not IANA/UTC-anchored like lib/schedule.ts, since this is "whatever the
 * device's local clock says," not Bruno's fixed real-world schedule. Scans up to ~17 weeks
 * out so a single-day-per-week pattern can still fill a full batch. */
function nextLocalOccurrences(hour: number, minute: number, days: number[], count: number): number[] {
  const now = new Date();
  const cursor = new Date(now);
  cursor.setHours(hour, minute, 0, 0);
  if (cursor.getTime() <= now.getTime()) cursor.setDate(cursor.getDate() + 1);

  const result: number[] = [];
  for (let scanned = 0; result.length < count && scanned < 120; scanned++) {
    if (days.includes(cursor.getDay())) result.push(cursor.getTime());
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

const EVERYDAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

function resolveDays(repeatMode: RepeatMode, customDays: number[]): number[] {
  if (repeatMode === "everyday") return EVERYDAY;
  if (repeatMode === "weekdays") return WEEKDAYS;
  if (repeatMode === "custom") return customDays;
  return [];
}

/** Every alarm config gets its own id-scoped OS-level id prefix (bruno-custom-<alarmId>-...)
 * so clearing/rescheduling one alarm never touches another's already-scheduled occurrences.
 * The same scoping carries over to lib/iosAlarmEngine.ts's group ids, for the same reason. */
function scopedPrefix(alarmId: string): string {
  return `${ID_PREFIX}${alarmId}-`;
}

function iosEngineGroupId(alarmId: string): string {
  return `custom-${alarmId}`;
}

async function clearScheduledForAlarm(alarmId: string): Promise<void> {
  const prefix = scopedPrefix(alarmId);
  if (Platform.OS === "android") {
    const alarms = await RNAlarmModule.listAlarms();
    await Promise.all(
      alarms.filter((a) => a.id.startsWith(prefix)).map((a) => RNAlarmModule.cancelAlarm(a.id))
    );
    return;
  }
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(prefix))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  await armIOSBackgroundAlarms(iosEngineGroupId(alarmId), []);
}

function alarmTitle(name: string): string {
  return name.trim() ? `⏰ ${name.trim()}` : "⏰ Your Bruno alarm";
}
const ALARM_BODY = "Time to get up — Bruno's latest is waiting.";

/** (Re)schedules one alarm's OS-level occurrences to match its current saved config —
 * clears whatever was previously scheduled for it first, then schedules fresh if enabled. */
async function applySchedule(alarm: CustomAlarm): Promise<void> {
  await clearScheduledForAlarm(alarm.id);
  if (!alarm.enabled) return;

  const prefix = scopedPrefix(alarm.id);
  const title = alarmTitle(alarm.name);

  if (Platform.OS === "android") {
    // Best-effort refresh of the guaranteed alarm sound to Bruno's latest real recording —
    // never blocks scheduling if it's unconfigured, offline, or fails for any reason.
    await refreshAlarmSound();
    const soundPath = await getCachedAlarmSoundPath();
    const timestamps =
      alarm.repeatMode === "once"
        ? [nextLocalOccurrence(alarm.hour, alarm.minute)]
        : nextLocalOccurrences(alarm.hour, alarm.minute, resolveDays(alarm.repeatMode, alarm.customDays), DAYS_TO_SCHEDULE);
    for (const timestamp of timestamps) {
      await RNAlarmModule.scheduleAlarm({
        id: `${prefix}${timestamp}`,
        datetimeISO: toAlarmDatetime(timestamp),
        title,
        body: ALARM_BODY,
        snoozeEnabled: true,
        snoozeInterval: SNOOZE_MINUTES,
        ...(soundPath ? { soundPath } : {}),
      });
    }
  } else if (alarm.repeatMode === "once") {
    await Notifications.scheduleNotificationAsync({
      identifier: `${prefix}once`,
      content: { title, body: ALARM_BODY, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(nextLocalOccurrence(alarm.hour, alarm.minute)),
      },
    });
  } else if (alarm.repeatMode === "everyday") {
    await Notifications.scheduleNotificationAsync({
      identifier: `${prefix}daily`,
      content: { title, body: ALARM_BODY, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: alarm.hour,
        minute: alarm.minute,
        repeats: true,
      },
    });
  } else {
    // "weekdays" / "custom" — expo-notifications' CalendarTriggerInput only takes a single
    // weekday per trigger (1=Sun..7=Sat), so a multi-day pattern needs one notification per
    // selected day, each independently repeating.
    for (const day of resolveDays(alarm.repeatMode, alarm.customDays)) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${prefix}day-${day}`,
        content: { title, body: ALARM_BODY, sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: alarm.hour,
          minute: alarm.minute,
          weekday: day + 1,
          repeats: true,
        },
      });
    }
  }

  if (Platform.OS === "ios") {
    // expo-notifications' repeating CalendarTriggerInput above has no concept of discrete
    // future timestamps to hand the background-audio engine — it needs actual dates to poll
    // against, so compute the same kind of upcoming-occurrence batch Android already uses.
    await refreshAlarmSound();
    const timestamps =
      alarm.repeatMode === "once"
        ? [nextLocalOccurrence(alarm.hour, alarm.minute)]
        : nextLocalOccurrences(alarm.hour, alarm.minute, resolveDays(alarm.repeatMode, alarm.customDays), DAYS_TO_SCHEDULE);
    await armIOSBackgroundAlarms(
      iosEngineGroupId(alarm.id),
      timestamps.map((timestamp) => ({ id: `${prefix}${timestamp}`, timestamp, title, body: ALARM_BODY }))
    );
  }
}

/** Creates a new custom alarm, or updates an existing one matched by `alarm.id` — either
 * way, (re)schedules its OS-level occurrences to match. */
export async function saveCustomAlarm(alarm: CustomAlarm): Promise<void> {
  const all = await getCustomAlarms();
  const index = all.findIndex((a) => a.id === alarm.id);
  const next = index >= 0 ? all.map((a) => (a.id === alarm.id ? alarm : a)) : [...all, alarm];
  await saveAllCustomAlarms(next);
  await applySchedule(alarm);
}

/** Flips one alarm on/off without opening the edit screen — used by the list's toggle. */
export async function setCustomAlarmEnabled(id: string, enabled: boolean): Promise<void> {
  const all = await getCustomAlarms();
  const alarm = all.find((a) => a.id === id);
  if (!alarm) return;
  const updated: CustomAlarm = { ...alarm, enabled };
  await saveAllCustomAlarms(all.map((a) => (a.id === id ? updated : a)));
  await applySchedule(updated);
}

export async function deleteCustomAlarm(id: string): Promise<void> {
  await clearScheduledForAlarm(id);
  const all = await getCustomAlarms();
  await saveAllCustomAlarms(all.filter((a) => a.id !== id));
}

/** Earliest upcoming occurrence (ms) across every enabled alarm, for the list screen's
 * "Next alarm in..." header — null if nothing's enabled. */
export function nextCustomAlarmOccurrence(alarms: CustomAlarm[]): number | null {
  const upcoming = alarms
    .filter((a) => a.enabled)
    .map((a) =>
      a.repeatMode === "once"
        ? nextLocalOccurrence(a.hour, a.minute)
        : nextLocalOccurrences(a.hour, a.minute, resolveDays(a.repeatMode, a.customDays), 1)[0]
    )
    .filter((t): t is number => t !== undefined);
  return upcoming.length ? Math.min(...upcoming) : null;
}
