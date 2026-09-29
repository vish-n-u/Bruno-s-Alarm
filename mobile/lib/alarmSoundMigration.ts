import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { rescheduleAllCustomAlarms } from "./customAlarm";
import { isSubscribed, scheduleUpcomingSessions } from "./notifications";

// Before v16, an alarm set while no recording had been downloaded yet was scheduled with no
// sound file at all, so it always played the built-in howl — even after a recording arrived —
// while the ringing screen showed the recording. Every alarm is now scheduled with the same fixed
// sound path (lib/alarmSound.ts getAlarmSoundFilePath), which lets the ringing screen show the
// exact clip that's sounding. This re-schedules alarms set by older versions, once.
const MIGRATION_KEY = "bruno-alarm-sound-path-migrated-v1";

/** Never call while an alarm is ringing: re-scheduling cancels and re-creates alarms, which
 * could cancel the one that's ringing. */
export async function migrateAlarmSoundPathsOnce(): Promise<void> {
  if (Platform.OS !== "android") return;
  if ((await AsyncStorage.getItem(MIGRATION_KEY)) === "1") return;
  if (await isSubscribed()) await scheduleUpcomingSessions();
  await rescheduleAllCustomAlarms();
  await AsyncStorage.setItem(MIGRATION_KEY, "1");
}
