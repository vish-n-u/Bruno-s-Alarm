import { Alert, NativeModules, Platform } from "react-native";
import {
  openAlarmPermissionSettings,
  openAppSettings,
  openFullScreenIntentSettings,
  requestPermission,
} from "./notifications";

// One place that asks for everything an alarm needs, at the moment the person actually tries to
// set one (saving/enabling a custom alarm, turning on the 6AM/6PM alarm) — instead of a
// permissions page in Settings they'd have to know to visit. Only asks about what's still
// missing, so once everything is granted it's silent.
//
// The two checks below are native methods added to react-native-alarmageddon by
// patches/react-native-alarmageddon+*.patch (the library itself only checks notifications).

type NativeChecks = {
  canScheduleExactAlarms?: () => Promise<boolean>;
  canUseFullScreenIntent?: () => Promise<boolean>;
};
const native = NativeModules.AlarmModule as NativeChecks | undefined;

// A failed/absent check is treated as "fine" — better to let the alarm be set than to block
// someone on a check that couldn't run.
async function canScheduleExactAlarms(): Promise<boolean> {
  try {
    return (await native?.canScheduleExactAlarms?.()) ?? true;
  } catch {
    return true;
  }
}

async function canUseFullScreenIntent(): Promise<boolean> {
  try {
    return (await native?.canUseFullScreenIntent?.()) ?? true;
  } catch {
    return true;
  }
}

function confirm(title: string, message: string, actionLabel: string, cancelLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: "cancel", onPress: () => resolve(false) },
        { text: actionLabel, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** Resolves true when the alarm can be set. False means something required is still off and the
 * person was told what and offered the settings page — callers should just not proceed.
 *
 * Required: notifications, exact alarms (an alarm that can't fire on time is worse than none).
 * Recommended only: full-screen alerts (without it the alarm still rings, but shows as a plain
 * notification, not the full ringing screen, over the lock screen). */
export async function ensureAlarmPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return requestPermission();

  if (!(await requestPermission())) {
    const open = await confirm(
      "Allow notifications",
      "Bruno's Alarm needs notifications to ring your alarm. Turn them on for this app in your phone's settings.",
      "Open settings",
      "Cancel",
    );
    if (open) await openAppSettings().catch(() => {});
    return false;
  }

  if (!(await canScheduleExactAlarms())) {
    const open = await confirm(
      "Allow exact alarms",
      "Without this your alarm can't ring on time. On the next screen, turn on \"Alarms & reminders\" for Bruno's Alarm, then come back.",
      "Open settings",
      "Cancel",
    );
    if (!open) return false;
    await openAlarmPermissionSettings().catch(() => {});
    if (!(await canScheduleExactAlarms())) return false;
  }

  if (!(await canUseFullScreenIntent())) {
    const open = await confirm(
      "Show alarms over the lock screen",
      "Turn this on so the alarm and Bruno's video appear when your phone is locked. Without it the alarm still rings, but you'll only see a notification.",
      "Open settings",
      "Not now",
    );
    if (open) await openFullScreenIntentSettings().catch(() => {});
  }

  return true;
}
