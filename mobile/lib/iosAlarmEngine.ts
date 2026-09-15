import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { Platform } from "react-native";
import { getCachedAlarmVideoUri } from "./alarmSound";

// iOS has no equivalent of Android's exact-alarm AlarmManager for third-party apps — see
// docs/ios-real-alarm.md for the full writeup. The mechanism here is the one real trick
// available (the same one Alarmy and similar apps use): a continuous, near-silent background
// audio session (UIBackgroundModes: "audio" + a looping expo-audio player) keeps the JS
// runtime alive, and it's this module's own in-app clock — not an OS-scheduled wake — that
// actually fires the alarm at the right second. expo-background-task/BGTaskScheduler is
// deliberately NOT used as the trigger: it's explicitly deferrable/opportunistic, wrong tool
// for "ring at exactly 6:00am." The existing plain local notification in lib/notifications.ts
// and lib/customAlarm.ts stays in place as a visible companion — belt and suspenders — this
// engine is additive, not a replacement.
//
// Hard, unfixable limitation: force-quitting the app kills the background audio session (and
// with it the JS runtime), so the alarm silently won't fire — same failure mode Alarmy itself
// documents. There is no workaround; only the companion notification still has a chance of
// showing something.

type PendingTarget = {
  id: string;
  timestamp: number; // ms epoch
  title: string;
  body: string;
};

type RingingRecord = {
  id: string;
  title: string;
  body: string;
  groupId: string;
};

const PENDING_KEY_PREFIX = "bruno-ios-pending-"; // + groupId, one key per independent alarm owner
const RINGING_KEY = "bruno-ios-ringing-alarm";
const POLL_INTERVAL_MS = 15000;
// A fired target stays eligible for this long after its scheduled time, tolerating a poll
// tick landing a little late — never fires something stale left over from the background
// session having been dead for a long stretch (e.g. after a device restart).
const FIRE_WINDOW_MS = 2 * 60 * 1000;
const SNOOZE_MINUTES = 10;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let keepAlivePlayer: AudioPlayer | null = null;
let ringingPlayer: AudioPlayer | null = null;
const ringingListeners = new Set<(alarmId: string | null) => void>();

function pendingKey(groupId: string): string {
  return `${PENDING_KEY_PREFIX}${groupId}`;
}

async function getGroupTargets(groupId: string): Promise<PendingTarget[]> {
  const raw = await AsyncStorage.getItem(pendingKey(groupId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function setGroupTargets(groupId: string, targets: PendingTarget[]): Promise<void> {
  await AsyncStorage.setItem(pendingKey(groupId), JSON.stringify(targets));
}

/** Every group's pending targets, each tagged with which group it came from so a fired one
 * can be removed from the right place. */
async function getAllPending(): Promise<Array<PendingTarget & { groupId: string }>> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PENDING_KEY_PREFIX));
  const entries = await AsyncStorage.multiGet(keys);
  const all: Array<PendingTarget & { groupId: string }> = [];
  for (const [key, raw] of entries) {
    if (!raw) continue;
    const groupId = key.slice(PENDING_KEY_PREFIX.length);
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) all.push(...parsed.map((t: PendingTarget) => ({ ...t, groupId })));
    } catch {
      // ignore a corrupt entry rather than let it wedge every future poll
    }
  }
  return all;
}

async function getRingingRecord(): Promise<RingingRecord | null> {
  const raw = await AsyncStorage.getItem(RINGING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function notifyRingingListeners(alarmId: string | null): void {
  ringingListeners.forEach((cb) => cb(alarmId));
}

async function ensureKeepAliveStarted(): Promise<void> {
  // This is a process-wide iOS audio session setting, not scoped to this player — while an
  // alarm is armed (i.e. most of the time, for anyone subscribed), it also means
  // VideoPanel's own unmuted playback (the manual sound toggle on Home/ringing) will play
  // through the silent switch too. Accepted as a reasonable side effect, not worked around.
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: "mixWithOthers",
  });
  if (!keepAlivePlayer) {
    keepAlivePlayer = createAudioPlayer(require("../assets/audio/keep_alive_silence.mp3"));
    keepAlivePlayer.loop = true;
    keepAlivePlayer.volume = 0;
  }
  if (!keepAlivePlayer.playing) keepAlivePlayer.play();
}

function stopKeepAlive(): void {
  keepAlivePlayer?.pause();
}

function ensurePolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    pollOnce().catch(() => {});
  }, POLL_INTERVAL_MS);
}

function stopPolling(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

/** Stops everything (audio session + poll loop) once there's nothing left to watch for and
 * nothing currently ringing — called after every arm/disarm/fire/resolve. */
async function reconcileEngineState(): Promise<void> {
  const ringing = await getRingingRecord();
  if (ringing) return; // stay alive while something's actively ringing, regardless of pending count

  const pending = await getAllPending();
  if (pending.length === 0) {
    stopPolling();
    stopKeepAlive();
    return;
  }
  ensurePolling();
  await ensureKeepAliveStarted();
}

async function fireTarget(target: PendingTarget & { groupId: string }): Promise<void> {
  // One alarm rings at a time — if the poll tick sees another due target while one's already
  // ringing, leave it for the next tick rather than layering a second alarm sound on top.
  if (await getRingingRecord()) return;

  stopKeepAlive();
  const record: RingingRecord = { id: target.id, title: target.title, body: target.body, groupId: target.groupId };
  await AsyncStorage.setItem(RINGING_KEY, JSON.stringify(record));
  await removeTargetFromGroup(target.groupId, target.id);

  const uri = await getCachedAlarmVideoUri();
  ringingPlayer?.remove();
  ringingPlayer = createAudioPlayer(uri ? { uri } : require("../assets/audio/alarm_default.mp3"));
  ringingPlayer.loop = true;
  ringingPlayer.volume = 1;
  ringingPlayer.play();

  notifyRingingListeners(target.id);
}

async function pollOnce(): Promise<void> {
  if (await getRingingRecord()) return;
  const now = Date.now();
  const pending = await getAllPending();
  const due = pending.find((t) => t.timestamp <= now && now - t.timestamp <= FIRE_WINDOW_MS);
  if (due) {
    await fireTarget(due);
  } else {
    // Silently drop anything so stale it's past its fire window — an ancient leftover target
    // (e.g. from a long-dead background session) should never suddenly go off later.
    const stale = pending.filter((t) => now - t.timestamp > FIRE_WINDOW_MS);
    if (stale.length > 0) {
      const staleByGroup = new Map<string, Set<string>>();
      for (const t of stale) {
        if (!staleByGroup.has(t.groupId)) staleByGroup.set(t.groupId, new Set());
        staleByGroup.get(t.groupId)!.add(t.id);
      }
      for (const [groupId, ids] of staleByGroup) {
        const current = await getGroupTargets(groupId);
        await setGroupTargets(groupId, current.filter((t) => !ids.has(t.id)));
      }
    }
  }
  await reconcileEngineState();
}

async function removeTargetFromGroup(groupId: string, id: string): Promise<void> {
  const current = await getGroupTargets(groupId);
  await setGroupTargets(groupId, current.filter((t) => t.id !== id));
}

/** Replaces one group's entire set of pending alarm targets (e.g. "session", or
 * "custom-<alarmId>" — see lib/customAlarm.ts) and starts the background keep-alive/poll loop
 * if there's now anything to watch for. Pass an empty array to disarm just that group. */
export async function armIOSBackgroundAlarms(groupId: string, targets: PendingTarget[]): Promise<void> {
  if (Platform.OS !== "ios") return;
  await setGroupTargets(groupId, targets);
  await reconcileEngineState();
}

/** Re-establishes the keep-alive/poll loop after a fresh cold start if there's still
 * something pending from before — e.g. the app process was restarted by the OS (not force-
 * quit by the user) while an alarm was still armed. Call once at app startup. */
export async function resumeIOSAlarmEngineIfNeeded(): Promise<void> {
  if (Platform.OS !== "ios") return;
  await reconcileEngineState();
}

export function onIOSAlarmRinging(callback: (alarmId: string | null) => void): { remove: () => void } {
  ringingListeners.add(callback);
  return { remove: () => ringingListeners.delete(callback) };
}

export async function getIOSActiveRingingAlarm(): Promise<string | null> {
  const record = await getRingingRecord();
  return record?.id ?? null;
}

export async function stopIOSRingingAlarm(alarmId: string): Promise<void> {
  const record = await getRingingRecord();
  if (!record || record.id !== alarmId) return;
  ringingPlayer?.pause();
  await AsyncStorage.removeItem(RINGING_KEY);
  notifyRingingListeners(null);
  await reconcileEngineState();
}

export async function snoozeIOSRingingAlarm(alarmId: string): Promise<void> {
  const record = await getRingingRecord();
  if (!record || record.id !== alarmId) return;
  ringingPlayer?.pause();
  await AsyncStorage.removeItem(RINGING_KEY);
  notifyRingingListeners(null);

  const current = await getGroupTargets(record.groupId);
  await setGroupTargets(record.groupId, [
    ...current,
    { id: `${alarmId}-snooze-${Date.now()}`, timestamp: Date.now() + SNOOZE_MINUTES * 60000, title: record.title, body: record.body },
  ]);
  await reconcileEngineState();
}
