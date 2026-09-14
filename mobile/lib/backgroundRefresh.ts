import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { refreshAlarmSound } from "./alarmSound";

// scheduleUpcomingSessions()/enableCustomAlarm() only refresh the cached alarm sound (see
// alarmSound.ts) when the user happens to (re)schedule something — which could be long
// before a new recording actually exists, leaving whatever alarm rings next playing stale
// audio. This periodically nudges the cache forward in the background too, independent of
// the app being open, so by the time any alarm fires it's usually only minutes stale
// instead of however long since the app was last opened.
const TASK_NAME = "bruno-refresh-alarm-sound";

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    await refreshAlarmSound();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Registers the periodic background refresh — Android only, since the guaranteed native
 * alarm sound (and its soundPath override) is an Android-only mechanism; there's nothing
 * for this task to keep fresh on iOS. Safe to call on every app launch — registering an
 * already-registered task is a no-op. Best-effort: the OS doesn't guarantee background
 * execution on every device (OEM battery management can throttle it further), this only
 * improves on the schedule-time-only refresh, it doesn't replace it. */
export async function registerBackgroundAlarmSoundRefresh(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: 15 });
  } catch {
    // Registration can fail on some devices/OS versions — scheduling-time refresh still covers us.
  }
}
