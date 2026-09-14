import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import RNAlarmModule from "react-native-alarmageddon";
import { getCachedAlarmSoundPath, refreshAlarmSound } from "./alarmSound";

// A second, independent alarm path alongside lib/notifications.ts's Bruno-session
// scheduling — lets someone set a genuinely free-choice wake time, unrelated to when
// Bruno actually howls. Deliberately kept separate: lib/schedule.ts and
// lib/notifications.ts's bruno-session- alarms are about Bruno's fixed real schedule and
// stay untouched by this file.
const STORAGE_KEY = "bruno-custom-alarm";
const ID_PREFIX = "bruno-custom-";
const DAYS_TO_SCHEDULE = 14;
const SNOOZE_MINUTES = 10;

export type RepeatMode = "once" | "everyday" | "weekdays" | "custom";

export type CustomAlarmState = {
  hour: number;
  minute: number;
  enabled: boolean;
  repeatMode: RepeatMode;
  /** 0=Sun..6=Sat, matching Date.getDay(). Only meaningful when repeatMode === "custom". */
  customDays: number[];
};

export async function getCustomAlarm(): Promise<CustomAlarmState | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  // Older saved state predates repeatMode/customDays — default to the original
  // "every day" behavior so nothing breaks for someone who set an alarm before this.
  return {
    hour: parsed.hour,
    minute: parsed.minute,
    enabled: parsed.enabled,
    repeatMode: parsed.repeatMode ?? "everyday",
    customDays: parsed.customDays ?? [],
  };
}

async function saveCustomAlarm(state: CustomAlarmState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

async function clearScheduledCustom(): Promise<void> {
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
}

const ALARM_TITLE = "⏰ Your Bruno alarm";
const ALARM_BODY = "Time to get up — Bruno's latest is waiting.";

/** Schedules (or re-schedules) the custom alarm at the given local hour/minute, following
 * `repeatMode` ("once" / "everyday" / "weekdays" / "custom" days) the same way a normal
 * alarm clock's repeat picker would. Android has no built-in daily-recurrence in
 * react-native-alarmageddon, so — same precedent as lib/notifications.ts's Bruno sessions —
 * a repeating pattern pre-schedules a batch of individual future occurrences; "once"
 * schedules a single one-shot alarm instead. iOS uses expo-notifications' native
 * repeats:true calendar trigger, one per selected weekday, which doesn't need batching. */
export async function enableCustomAlarm(
  hour: number,
  minute: number,
  repeatMode: RepeatMode,
  customDays: number[] = []
): Promise<void> {
  await clearScheduledCustom();

  if (Platform.OS === "android") {
    // Best-effort refresh of the guaranteed alarm sound to Bruno's latest real recording —
    // never blocks scheduling if it's unconfigured, offline, or fails for any reason.
    await refreshAlarmSound();
    const soundPath = await getCachedAlarmSoundPath();
    const timestamps =
      repeatMode === "once"
        ? [nextLocalOccurrence(hour, minute)]
        : nextLocalOccurrences(hour, minute, resolveDays(repeatMode, customDays), DAYS_TO_SCHEDULE);
    for (const timestamp of timestamps) {
      await RNAlarmModule.scheduleAlarm({
        id: `${ID_PREFIX}${timestamp}`,
        datetimeISO: new Date(timestamp).toISOString(),
        title: ALARM_TITLE,
        body: ALARM_BODY,
        snoozeEnabled: true,
        snoozeInterval: SNOOZE_MINUTES,
        ...(soundPath ? { soundPath } : {}),
      });
    }
  } else if (repeatMode === "once") {
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}once`,
      content: { title: ALARM_TITLE, body: ALARM_BODY, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(nextLocalOccurrence(hour, minute)),
      },
    });
  } else if (repeatMode === "everyday") {
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}daily`,
      content: { title: ALARM_TITLE, body: ALARM_BODY, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, hour, minute, repeats: true },
    });
  } else {
    // "weekdays" / "custom" — expo-notifications' CalendarTriggerInput only takes a single
    // weekday per trigger (1=Sun..7=Sat), so a multi-day pattern needs one notification per
    // selected day, each independently repeating.
    for (const day of resolveDays(repeatMode, customDays)) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${ID_PREFIX}day-${day}`,
        content: { title: ALARM_TITLE, body: ALARM_BODY, sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour,
          minute,
          weekday: day + 1,
          repeats: true,
        },
      });
    }
  }

  await saveCustomAlarm({ hour, minute, enabled: true, repeatMode, customDays });
}

export async function disableCustomAlarm(): Promise<void> {
  await clearScheduledCustom();
  const existing = await getCustomAlarm();
  if (existing) await saveCustomAlarm({ ...existing, enabled: false });
}
