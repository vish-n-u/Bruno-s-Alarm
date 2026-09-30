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

/** Short names for a checklist, e.g. the live alarm sheet's "you'll be asked to allow". */
export const ALARM_SETTING_LABELS: Record<AlarmSetting, { icon: PermissionPrompt["icon"]; label: string }> = {
  exactAlarms: { icon: "alarm-outline", label: "Ring at the exact minute" },
  lockScreen: { icon: "phone-portrait-outline", label: "Show on the lock screen" },
  background: { icon: "battery-charging-outline", label: "Wake up in the background" },
};

const NOTIFICATIONS_PROMPT: PermissionPrompt = {
  icon: "notifications-off-outline",
  title: "Notifications are off",
  body: "Every Bruno alarm rings through a notification, so with them off, nothing can ring. Switch them on and come back.",
  steps: ["Notifications", "Allow notifications"],
  confirmLabel: "Open settings",
  cancelLabel: "Cancel",
};

const PROMPTS: Record<AlarmSetting, PermissionPrompt> = {
  // Required: an alarm that can't fire on time is worse than none.
  exactAlarms: {
    icon: "alarm-outline",
    title: "Let Bruno ring on time",
    body: "Android asks before any app can ring at an exact minute. Without it, your alarm could go off late.",
    steps: ["Allow setting alarms and reminders"],
    confirmLabel: "Open settings",
    cancelLabel: "Cancel",
  },
  // Recommended: without it the alarm still rings, but as a plain notification.
  lockScreen: {
    icon: "phone-portrait-outline",
    title: "Show Bruno on your lock screen",
    body: "So he fills your screen, howling, when the alarm goes off. Skip it and it still rings, you'll just see a notification.",
    steps: ["Allow full screen notifications"],
    confirmLabel: "Open settings",
    cancelLabel: "Not now",
  },
  // Recommended, live alarm only: it rings off a push, and a battery-restricted app often isn't
  // woken for one.
  background: {
    icon: "battery-charging-outline",
    title: "Let the app wake up",
    body: "Your phone is keeping Bruno's Alarm asleep to save battery, so it might sleep through Bruno going live.",
    steps: ["Battery", "Unrestricted"],
    stepsNote: "Some phones call it “Allow background activity”.",
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

/** What the live alarm would still ask for, without asking. */
export function missingLiveAlarmSettings(): Promise<AlarmSetting[]> {
  return missing(LIVE_SETTINGS);
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
