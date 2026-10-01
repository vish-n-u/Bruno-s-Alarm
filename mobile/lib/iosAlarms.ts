import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import BrunoAlarmKit, { type AlarmKitAlarm } from "../modules/bruno-alarmkit";
import { getSavedRecording } from "./alarmSound";
import { getIOSUseDownloadedSound } from "./iosSoundPref";

// iPhone alarms through Apple's AlarmKit (iOS 26+), via modules/bruno-alarmkit. The iPhone
// counterpart of react-native-alarmageddon on Android: lib/notifications.ts and
// lib/customAlarm.ts call these in their iOS branches, with the same alarm ids as Android.
//
// Differences from Android worth knowing:
// - iOS draws the ringing screen (title, time, app name, slide to stop, Snooze). Bruno's video
//   only shows once the person opens the app (AlarmRingingScreen, as on Android).
// - The sound is a file named when the alarm is scheduled: the built-in howl
//   (bruno_alarm.caf, added to the app by plugins/withIOSAlarmSound.js) unless the downloaded-howl
//   test switch is on (lib/iosSoundPref.ts).
// Everything here no-ops off iOS, so Android never touches it.

const BUNDLED_SOUND = "bruno_alarm.caf";
const PREPARED_KEY = "bruno-ios-prepared-sound"; // { name, recordedAt } of the last converted howl
const SNOOZE_MINUTES = 10;

const native = Platform.OS === "ios" ? BrunoAlarmKit : null;

/** AlarmKit is there (iOS 26+ and the native module is in this build). */
export function iosAlarmsSupported(): boolean {
  return native?.isSupported() ?? false;
}

/** Asks for AlarmKit permission if not decided yet. True if alarms are allowed. */
export async function requestIOSAlarmAuthorization(): Promise<boolean> {
  if (!native || !iosAlarmsSupported()) return false;
  try {
    return (await native.requestAuthorization()) === "authorized";
  } catch {
    return false;
  }
}

export async function scheduleIOSAlarm(alarm: { id: string; title: string; timestamp: number; soundName: string }): Promise<void> {
  if (!native || !iosAlarmsSupported()) return;
  await native.schedule({ ...alarm, snoozeMinutes: SNOOZE_MINUTES });
}

export async function listIOSAlarms(): Promise<AlarmKitAlarm[]> {
  if (!native || !iosAlarmsSupported()) return [];
  try {
    return await native.list();
  } catch {
    return [];
  }
}

export async function cancelIOSAlarmsWithPrefix(prefix: string): Promise<void> {
  if (!native) return;
  const alarms = await listIOSAlarms();
  await Promise.all(alarms.filter((a) => a.id.startsWith(prefix)).map((a) => native.cancel(a.id).catch(() => {})));
}

export async function cancelAllIOSAlarms(): Promise<void> {
  await cancelIOSAlarmsWithPrefix("");
}

export async function stopIOSAlarm(id: string): Promise<void> {
  await native?.stop(id).catch(() => {});
}

export async function snoozeIOSAlarm(id: string): Promise<void> {
  await native?.snooze(id).catch(() => {});
}

function alerting(alarms: AlarmKitAlarm[]): string | null {
  return alarms.find((a) => a.state === "alerting")?.id ?? null;
}

/** The alarm ringing right now, if any — checked when the app opens. */
export async function getAlertingIOSAlarm(): Promise<string | null> {
  return alerting(await listIOSAlarms());
}

/** Calls back with the ringing alarm's id when one starts, and null when it stops. */
export function onIOSAlarmAlerting(callback: (alarmId: string | null) => void): { remove: () => void } | null {
  if (!native || !iosAlarmsSupported()) return null;
  let last: string | null = null;
  return native.addListener("onAlarmsChanged", ({ alarms }) => {
    const current = alerting(alarms);
    if (current === last) return;
    last = current;
    callback(current);
  });
}

/** The sound to schedule alarms with: the built-in howl, or — with the test switch on — the
 * latest downloaded recording converted into Library/Sounds (converted once per recording). */
export async function getIOSAlarmSoundName(): Promise<string> {
  if (!native || !(await getIOSUseDownloadedSound())) return BUNDLED_SOUND;
  const saved = await getSavedRecording();
  if (!saved) return BUNDLED_SOUND;
  try {
    const raw = await AsyncStorage.getItem(PREPARED_KEY);
    const prepared = raw ? (JSON.parse(raw) as { name: string; recordedAt: string }) : null;
    if (prepared?.recordedAt === saved.recordedAt) return prepared.name;
    const name = await native.prepareSound(saved.uri);
    await AsyncStorage.setItem(PREPARED_KEY, JSON.stringify({ name, recordedAt: saved.recordedAt }));
    return name;
  } catch {
    return BUNDLED_SOUND;
  }
}
