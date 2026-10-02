import { getAnalytics, logEvent as fbLogEvent, logScreenView as fbLogScreenView } from "@react-native-firebase/analytics";
import { getCrashlytics, log as fbLog, recordError as fbRecordError } from "@react-native-firebase/crashlytics";

// Thin wrappers around the two Firebase modules' v22+ "modular" API (getX(app) + free
// functions, not the older analytics().logEvent() namespaced style) — call sites elsewhere
// in the app go through these rather than reaching for @react-native-firebase directly, so
// the actual event names/shape live in one place. Crashlytics needs no manual wiring for
// uncaught JS/native crashes (it hooks in automatically once linked); recordError() below is
// only for logging a handled/caught error as a non-fatal, which Crashlytics doesn't otherwise
// see.
//
// Product events (`track` below) answer "what do people do, and what did they do before they
// left?" in Firebase → Analytics (Explore → funnel/path). Firebase adds the automatic ones on
// its own: first_open, session_start, user_engagement (time on screen), app_remove (uninstall,
// Android), app_update. Nothing here identifies a person: no names, chat text or ids.
// Analytics must never break the app, so every call swallows its own errors.

export function logEvent(name: string, params?: Record<string, string | number | boolean>): void {
  try {
    fbLogEvent(getAnalytics(), name, params);
  } catch {
    // Analytics only.
  }
}

export function logScreenView(screenName: string): void {
  try {
    fbLogScreenView(getAnalytics(), { screen_name: screenName, screen_class: screenName }).catch(() => {});
  } catch {
    // Analytics only.
  }
}

export function recordError(error: unknown, context?: string): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const crashlytics = getCrashlytics();
  if (context) fbLog(crashlytics, context);
  fbRecordError(crashlytics, err);
}

/** session = Bruno's 6AM/6PM, custom = the user's own, live = rang because he went live. */
export type AlarmType = "session" | "custom" | "live" | "test" | "other";

export function alarmTypeFromId(alarmId: string): AlarmType {
  if (alarmId.startsWith("bruno-session-")) return "session";
  if (alarmId.startsWith("bruno-custom-")) return "custom";
  if (alarmId.startsWith("bruno-live-")) return "live";
  if (alarmId.startsWith("bruno-test-")) return "test";
  return "other";
}

export type ChatRoom = "live" | "pack";

/** Every product event the app sends. Names are GA4-style snake_case. */
export const track = {
  onboardingComplete(setFirstAlarm: boolean): void {
    logEvent("onboarding_complete", { set_first_alarm: setFirstAlarm });
  },
  /** Bruno's 6AM/6PM alarm switched on/off. */
  dailyAlarm(on: boolean, source: "settings" | "home_card"): void {
    logEvent(on ? "daily_alarm_on" : "daily_alarm_off", { source });
  },
  customAlarmSaved(isNew: boolean, repeat: string): void {
    logEvent("custom_alarm_saved", { is_new: isNew, repeat });
  },
  customAlarmToggled(enabled: boolean): void {
    logEvent(enabled ? "custom_alarm_on" : "custom_alarm_off");
  },
  customAlarmDeleted(): void {
    logEvent("custom_alarm_deleted");
  },
  liveAlarm(on: boolean): void {
    logEvent(on ? "live_alarm_on" : "live_alarm_off");
  },
  /** The ringing screen appeared (the app was opened by, or during, a ringing alarm). */
  alarmRang(alarmId: string): void {
    logEvent("alarm_rang", { alarm_type: alarmTypeFromId(alarmId) });
  },
  alarmStopped(alarmId: string, secondsRinging: number): void {
    logEvent("alarm_stopped", { alarm_type: alarmTypeFromId(alarmId), seconds_ringing: Math.round(secondsRinging) });
  },
  alarmSnoozed(alarmId: string): void {
    logEvent("alarm_snoozed", { alarm_type: alarmTypeFromId(alarmId) });
  },
  alarmWatchLive(alarmId: string): void {
    logEvent("alarm_watch_live", { alarm_type: alarmTypeFromId(alarmId) });
  },
  /** The Live tab started showing Bruno live, or the replay of the stream that just ended. */
  liveWatched(state: "live" | "replay"): void {
    logEvent("live_watched", { state });
  },
  chatTermsAccepted(room: ChatRoom): void {
    logEvent("chat_terms_accepted", { room });
  },
  chatSent(room: ChatRoom): void {
    logEvent("chat_message_sent", { room });
  },
  chatReported(room: ChatRoom): void {
    logEvent("chat_message_reported", { room });
  },
  chatBlocked(room: ChatRoom): void {
    logEvent("chat_user_blocked", { room });
  },
  /** One of the app's permission dialogs: did they go to settings, and what came of it. */
  permissionPrompt(setting: string, openedSettings: boolean): void {
    logEvent("permission_prompt", { setting, opened_settings: openedSettings });
  },
};
