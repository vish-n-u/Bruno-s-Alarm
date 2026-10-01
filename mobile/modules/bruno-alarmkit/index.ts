import { requireOptionalNativeModule } from "expo";

// The iPhone-only native module (ios/BrunoAlarmKitModule.swift). On Android, or an iPhone build
// without it, this is null — callers go through lib/iosAlarms.ts, which handles that.

export type AlarmKitAuthorization = "notDetermined" | "authorized" | "denied" | "unsupported";
export type AlarmKitState = "scheduled" | "countdown" | "paused" | "alerting" | "unknown";

export type AlarmKitAlarm = {
  /** The app's own id, e.g. "bruno-session-1759284000000". */
  id: string;
  state: AlarmKitState;
  /** When it rings (ms since 1970). */
  timestamp?: number;
};

export type AlarmKitScheduleOptions = {
  id: string;
  title: string;
  timestamp: number;
  /** A sound file in the app bundle or Library/Sounds; omitted = iOS default sound. */
  soundName?: string;
  snoozeMinutes?: number;
};

type BrunoAlarmKitModule = {
  isSupported(): boolean;
  getAuthorizationState(): Promise<AlarmKitAuthorization>;
  requestAuthorization(): Promise<AlarmKitAuthorization>;
  schedule(options: AlarmKitScheduleOptions): Promise<void>;
  cancel(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  snooze(id: string): Promise<void>;
  list(): Promise<AlarmKitAlarm[]>;
  prepareSound(sourceUri: string): Promise<string>;
  addListener(event: "onAlarmsChanged", listener: (event: { alarms: AlarmKitAlarm[] }) => void): { remove(): void };
};

export default requireOptionalNativeModule<BrunoAlarmKitModule>("BrunoAlarmKit");
