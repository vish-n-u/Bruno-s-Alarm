import { NativeModules, Platform } from "react-native";
import {
  openAlarmPermissionSettings,
  openAppSettings,
  openFullScreenIntentSettings,
  requestPermission,
} from "./notifications";
import { askPermission, type PermissionPrompt } from "./permissionPrompt";

// One place that asks for everything an alarm needs, at the moment the person actually tries to
// set one (saving/enabling a custom alarm, turning on the daily alarm or the live alarm) —
// instead of a permissions page in Settings they'd have to know to visit. Only asks about what's
// still missing, so once everything is granted it's silent. The dialogs are the app's own
// (lib/permissionPrompt.ts), each followed by the phone's settings page for that one switch.
//
// The native checks below are methods added to react-native-alarmageddon by
// patches/react-native-alarmageddon+*.patch (the library itself only checks notifications).

type NativeChecks = {
  canScheduleExactAlarms?: () => Promise<boolean>;
  canUseFullScreenIntent?: () => Promise<boolean>;
  isIgnoringBatteryOptimizations?: () => Promise<boolean>;
};
const native = NativeModules.AlarmModule as NativeChecks | undefined;

/** The settings (beyond notifications) an alarm can need. */
export type AlarmSetting = "exactAlarms" | "lockScreen" | "background";

const DAILY_SETTINGS: AlarmSetting[] = ["exactAlarms", "lockScreen"];
const LIVE_SETTINGS: AlarmSetting[] = ["exactAlarms", "lockScreen", "background"];

const NOTIFICATIONS_PROMPT: PermissionPrompt = {
  illustration: "notifications",
  title: "Turn on notifications",
  body: "Bruno can't ring without them.",
  confirmLabel: "Open settings",
  cancelLabel: "Cancel",
};

// exactAlarms is required (an alarm that can't fire on time is worse than none); the other two
// are recommended and skippable.
const PROMPTS: Record<AlarmSetting, PermissionPrompt> = {
  exactAlarms: {
    illustration: "exactAlarms",
    title: "Allow alarms",
    body: "So Bruno rings right on time.",
    confirmLabel: "Open settings",
    cancelLabel: "Cancel",
  },
  lockScreen: {
    illustration: "lockScreen",
    title: "Show on lock screen",
    body: "So Bruno fills your screen when he rings.",
    confirmLabel: "Open settings",
    cancelLabel: "Not now",
  },
  background: {
    illustration: "background",
    title: "Allow background activity",
    body: "So the app wakes up when Bruno goes live.",
    confirmLabel: "Open settings",
    cancelLabel: "Skip",
  },
};

const OPEN: Record<AlarmSetting, () => Promise<void>> = {
  exactAlarms: openAlarmPermissionSettings,
  lockScreen: openFullScreenIntentSettings,
  background: openAppSettings,
};

// A failed/absent check is treated as "fine" — better to let the alarm be set than to block
// someone on a check that couldn't run.
async function check(fn: (() => Promise<boolean>) | undefined): Promise<boolean> {
  try {
    return (await fn?.()) ?? true;
  } catch {
    return true;
  }
}

function isAllowed(setting: AlarmSetting): Promise<boolean> {
  switch (setting) {
    case "exactAlarms":
      return check(native?.canScheduleExactAlarms);
    case "lockScreen":
      return check(native?.canUseFullScreenIntent);
    case "background":
      return check(native?.isIgnoringBatteryOptimizations);
  }
}

async function missing(settings: AlarmSetting[]): Promise<AlarmSetting[]> {
  if (Platform.OS !== "android") return [];
  const allowed = await Promise.all(settings.map(isAllowed));
  return settings.filter((_, i) => !allowed[i]);
}

async function ensure(settings: AlarmSetting[]): Promise<boolean> {
  if (Platform.OS !== "android") return requestPermission();

  if (!(await requestPermission())) {
    if (!(await askPermission(NOTIFICATIONS_PROMPT))) return false;
    await openAppSettings().catch(() => {});
    if (!(await requestPermission())) return false;
  }

  const todo = await missing(settings);
  for (let i = 0; i < todo.length; i++) {
    const setting = todo[i];
    const progress = todo.length > 1 ? `${i + 1} of ${todo.length}` : undefined;
    const open = await askPermission({ ...PROMPTS[setting], progress });
    if (open) await OPEN[setting]().catch(() => {});
    if (setting === "exactAlarms" && !(await isAllowed(setting))) return false;
  }
  return true;
}

/** Resolves true when the alarm can be set. False means something required (notifications,
 * exact alarms) is still off and the person was told what and offered the settings page —
 * callers should just not proceed. The lock-screen setting is recommended only. */
export function ensureAlarmPermissions(): Promise<boolean> {
  return ensure(DAILY_SETTINGS);
}

/** Same as ensureAlarmPermissions, plus (recommended, skippable) letting the app run in the
 * background — the live alarm rings off a push that has to wake the app. */
export function ensureLiveAlarmPermissions(): Promise<boolean> {
  return ensure(LIVE_SETTINGS);
}
