import { getAnalytics, logEvent as fbLogEvent, logScreenView as fbLogScreenView } from "@react-native-firebase/analytics";
import { getCrashlytics, log as fbLog, recordError as fbRecordError } from "@react-native-firebase/crashlytics";

// Thin wrappers around the two Firebase modules' v22+ "modular" API (getX(app) + free
// functions, not the older analytics().logEvent() namespaced style) — call sites elsewhere
// in the app go through these rather than reaching for @react-native-firebase directly, so
// the actual event names/shape live in one place. Crashlytics needs no manual wiring for
// uncaught JS/native crashes (it hooks in automatically once linked); recordError() below is
// only for logging a handled/caught error as a non-fatal, which Crashlytics doesn't otherwise
// see.

export function logEvent(name: string, params?: Record<string, string | number | boolean>): void {
  fbLogEvent(getAnalytics(), name, params);
}

export function logScreenView(screenName: string): void {
  fbLogScreenView(getAnalytics(), { screen_name: screenName, screen_class: screenName }).catch(() => {});
}

export function recordError(error: unknown, context?: string): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const crashlytics = getCrashlytics();
  if (context) fbLog(crashlytics, context);
  fbRecordError(crashlytics, err);
}
