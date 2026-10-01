import { Platform } from "react-native";
import { onAlarmRecordingChanged } from "./alarmSound";
import { rescheduleAllCustomAlarms } from "./customAlarm";
import { getAlertingIOSAlarm } from "./iosAlarms";
import { getIOSUseDownloadedSound } from "./iosSoundPref";
import { isSubscribed, scheduleUpcomingSessions } from "./notifications";

// iPhone only. An iPhone alarm's sound is fixed when it's scheduled (Android instead reads one
// fixed file path at ring time), so when a new recording downloads, alarms are rescheduled to
// pick it up — only while the downloaded-howl switch is on (lib/iosSoundPref.ts); with the
// built-in howl nothing changes.

/** Re-schedules every alarm so it uses the current sound. Skipped while one is ringing. */
export async function rescheduleIOSAlarmsForSound(): Promise<void> {
  if (Platform.OS !== "ios") return;
  if (await getAlertingIOSAlarm()) return;
  if (await isSubscribed()) await scheduleUpcomingSessions();
  await rescheduleAllCustomAlarms();
}

/** Call once at startup. Returns the unsubscribe function. */
export function startIOSAlarmSoundResync(): () => void {
  if (Platform.OS !== "ios") return () => {};
  return onAlarmRecordingChanged(() => {
    getIOSUseDownloadedSound()
      .then((on) => (on ? rescheduleIOSAlarmsForSound() : undefined))
      .catch(() => {});
  });
}
