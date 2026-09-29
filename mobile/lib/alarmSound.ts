import AsyncStorage from "@react-native-async-storage/async-storage";
// SDK 57's expo-file-system default export is a new class-based API without
// documentDirectory/downloadAsync/etc. — those live under the "legacy" subpath, which is
// what this file uses (simple imperative file ops, no need for the new API's File/Directory
// classes).
import * as FileSystem from "expo-file-system/legacy";
import { fetchLatestRecording } from "./latestRecording";
import { startsNearSession } from "./schedule";

// Keeps the guaranteed native alarm sound (played by react-native-alarmageddon's own
// MediaPlayer, bypassing DND — see AlarmReceiver.kt's soundPath support, added via
// patches/react-native-alarmageddon+*.patch) fresh with Bruno's most recent real
// recording, instead of it being one fixed clip forever. Deliberately NOT the video's own
// audio track (see docs discussion — expo-video's audio isn't DND-exempt) — this is a plain
// local file, so the reliability story is unchanged, only its *content* refreshes.
//
// A plain video+audio MP4 works fine here: MediaPlayer without a Surface attached decodes
// and plays only the audio track, dropping video frames — no server-side audio extraction
// needed, and it's the same mechanism this library already relies on for the bundled
// default sound.
// v2: bumped on purpose. Recordings were previously served from one fixed web address that
// Cloudflare cached for hours, so a phone could save an OLD clip labelled as the new recording
// and then never re-download it. A new key makes every phone drop that record and fetch fresh.
const CACHE_KEY = "bruno-alarm-sound-cache-v2";
const LEGACY_CACHE_KEY = "bruno-alarm-sound-cache";
const STATUS_KEY = "bruno-alarm-sound-status";
const FINAL_PATH = `${FileSystem.documentDirectory}alarm_sound_latest.mp4`;
const TEMP_PATH = `${FileSystem.documentDirectory}alarm_sound_latest.download.mp4`;

type CacheRecord = { path: string; recordedAt: string; size?: number };

type RefreshOutcome = "downloaded" | "up-to-date" | "not-ready" | "unavailable" | "download-failed" | "size-mismatch";

async function recordOutcome(outcome: RefreshOutcome): Promise<void> {
  try {
    await AsyncStorage.setItem(STATUS_KEY, JSON.stringify({ at: Date.now(), outcome }));
  } catch {
    // Diagnostics only.
  }
}

async function getCacheRecord(): Promise<CacheRecord | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The local file path of the most recently cached custom alarm sound, if any download has
 * ever succeeded and the file is still on disk — undefined otherwise, in which case callers
 * should omit soundPath entirely and let the native side use its bundled default. */
export async function getCachedAlarmSoundPath(): Promise<string | undefined> {
  const record = await getCacheRecord();
  if (!record) return undefined;
  const info = await FileSystem.getInfoAsync(record.path);
  if (!info.exists) return undefined;
  // expo-file-system's documentDirectory is a file:// URI, but the native Kotlin side reads
  // it with plain java.io.File(path) — which doesn't understand the file:// scheme and just
  // silently reports the file as missing. Strip it here so the path native code receives is
  // a real filesystem path.
  return record.path.startsWith("file://") ? record.path.slice("file://".length) : record.path;
}

function stripFileScheme(path: string): string {
  return path.startsWith("file://") ? path.slice("file://".length) : path;
}

/** The sound file every Android alarm is scheduled with — always this one fixed path, whether or
 * not a recording has been downloaded yet. At ring time the native player uses it if the file
 * exists and plays, and the built-in howl otherwise. Because every alarm points at the same path,
 * the ringing screen can tell which clip is actually sounding (see getAlarmClipVideoUri) — which
 * wasn't possible when alarms set before any download silently used the built-in howl. */
export function getAlarmSoundFilePath(): string {
  return stripFileScheme(FINAL_PATH);
}

/** The clip the alarm sound is playing right now, as a URI for the ringing screen's video: the
 * saved recording if it's on the phone (the same check the native player makes), otherwise
 * undefined — meaning the built-in howl, whose matching video is the bundled clip. */
export async function getAlarmClipVideoUri(): Promise<string | undefined> {
  const info = await FileSystem.getInfoAsync(FINAL_PATH);
  return info.exists ? FINAL_PATH : undefined;
}

// While an alarm is ringing, the saved file must not change: the native player keeps playing the
// old audio, so swapping it would put a different clip on screen than the one you hear.
let alarmRinging = false;

export function setAlarmRinging(ringing: boolean): void {
  alarmRinging = ringing;
}

/** Deletes a saved clip that isn't from a real 06:00/18:00 session (e.g. a test stream saved
 * before the server started filtering those out), so alarms fall back to the built-in howl
 * instead of playing it. Also clears a record whose file is gone. */
async function removeInvalidSavedRecording(): Promise<void> {
  if (alarmRinging) return;
  const record = await getCacheRecord();
  const info = await FileSystem.getInfoAsync(FINAL_PATH);
  const recordedAt = record ? Date.parse(record.recordedAt) : NaN;
  const valid = record !== null && record.path === FINAL_PATH && Number.isFinite(recordedAt) && startsNearSession(recordedAt);
  if (info.exists && !valid) {
    await FileSystem.deleteAsync(FINAL_PATH, { idempotent: true });
    await AsyncStorage.removeItem(CACHE_KEY);
  } else if (!info.exists && record) {
    await AsyncStorage.removeItem(CACHE_KEY);
  }
}

/** The cached recording as a file:// URI, suitable for expo-video (unlike
 * getCachedAlarmSoundPath(), this keeps the file:// scheme — VideoView needs a real URI,
 * not a bare filesystem path). Same underlying file as the native alarm sound; showing it as
 * video too means the ringing screen visually shows Bruno's actual latest recording instead
 * of one fixed placeholder clip. */
export async function getCachedAlarmVideoUri(): Promise<string | undefined> {
  const record = await getCacheRecord();
  if (!record) return undefined;
  const info = await FileSystem.getInfoAsync(record.path);
  if (!info.exists) return undefined;
  return record.path;
}

// A "not ready yet" answer (Cloudflare still preparing the file) or a failed download is worth
// another try shortly; anything else (offline, unconfigured, nothing recorded) is not, and the
// next trigger — the app coming to the foreground, a schedule change, the background task —
// will simply try again on its own.
const RETRY_DELAYS_MS = [60_000, 120_000, 300_000];
// Opening the app or returning to it can happen many times an hour; asking the backend that often
// buys nothing, since a new recording appears at most a couple of times a day.
const FOREGROUND_MIN_GAP_MS = 5 * 60 * 1000;

// The saved recording always lives at the same path (scheduled alarms point at it), so a new
// download swaps the file's contents underneath anything showing it. Screens playing it
// (VideoPanel) subscribe here and reload instead of freezing on the replaced file.
const recordingChangedListeners = new Set<() => void>();

export function onAlarmRecordingChanged(listener: () => void): () => void {
  recordingChangedListeners.add(listener);
  return () => {
    recordingChangedListeners.delete(listener);
  };
}

let inFlight: Promise<boolean> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let lastAttemptAt = 0;

/** One refresh attempt. Resolves true if it failed in a way that is worth retrying soon. */
async function attemptRefresh(): Promise<boolean> {
  // Try again shortly rather than touch the file under a ringing alarm.
  if (alarmRinging) return true;
  try {
    AsyncStorage.removeItem(LEGACY_CACHE_KEY).catch(() => {});
    await removeInvalidSavedRecording();

    const result = await fetchLatestRecording();
    if (result.status === "not_ready") {
      await recordOutcome("not-ready");
      return true;
    }
    if (result.status !== "ready") {
      await recordOutcome("unavailable");
      return false;
    }

    const latest = result.recording;
    const existing = await getCacheRecord();
    if (existing?.recordedAt === latest.recordedAt) {
      await recordOutcome("up-to-date");
      return false; // already have this one cached
    }

    try {
      const download = await FileSystem.downloadAsync(latest.url, TEMP_PATH);
      if (download.status !== 200) {
        await recordOutcome("download-failed");
        return true;
      }

      // A download that ends up a different size than the server said it is (cut short, or the
      // wrong file entirely) must not be saved as if it were fine.
      const info = await FileSystem.getInfoAsync(TEMP_PATH);
      const size = info.exists ? info.size : 0;
      const expected = Number(download.headers?.["Content-Length"] ?? download.headers?.["content-length"]);
      if (size <= 0 || (Number.isFinite(expected) && expected > 0 && size !== expected)) {
        await recordOutcome("size-mismatch");
        return true;
      }

      // An alarm started ringing during the download — keep its clip; retry the swap later.
      if (alarmRinging) return true;
      await FileSystem.deleteAsync(FINAL_PATH, { idempotent: true });
      await FileSystem.moveAsync({ from: TEMP_PATH, to: FINAL_PATH });
      const record: CacheRecord = { path: FINAL_PATH, recordedAt: latest.recordedAt, size };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(record));
      await recordOutcome("downloaded");
      recordingChangedListeners.forEach((listener) => {
        try {
          listener();
        } catch {
          // A broken listener must not undo a successful download.
        }
      });
      return false;
    } catch {
      // Network failure, storage full, etc. — leave whatever was cached before untouched.
      await recordOutcome("download-failed");
      return true;
    } finally {
      FileSystem.deleteAsync(TEMP_PATH, { idempotent: true }).catch(() => {});
    }
  } catch {
    return false;
  }
}

/** Shares one attempt between callers that overlap (e.g. the foreground trigger and the ringing
 * screen both asking at once) instead of downloading the same file twice. */
function runRefresh(): Promise<boolean> {
  if (inFlight) return inFlight;
  lastAttemptAt = Date.now();
  inFlight = attemptRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

function scheduleRetry(attempt: number): void {
  if (attempt >= RETRY_DELAYS_MS.length) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    const stillFailing = await runRefresh();
    if (stillFailing) scheduleRetry(attempt + 1);
  }, RETRY_DELAYS_MS[attempt]);
}

/** Fetches the latest recording and downloads it, replacing the cached sound only once the
 * new download actually finishes — a failed or partial refresh always leaves whatever was
 * cached before untouched, never a half-written file. Safe to call opportunistically (e.g.
 * every time alarms are (re)scheduled); silently no-ops on any failure — no backend
 * configured, no network, nothing recorded yet, download failure. If the recording exists but
 * isn't ready to download yet, it retries a few times over the next several minutes. */
export async function refreshAlarmSound(): Promise<void> {
  // An explicit new request supersedes any retry still waiting from an earlier one.
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  const needsRetry = await runRefresh();
  if (needsRetry) scheduleRetry(0);
}

/** For app-open / return-to-foreground: same as refreshAlarmSound(), but skipped if an attempt
 * already happened in the last few minutes. */
export async function refreshAlarmSoundIfStale(): Promise<void> {
  if (Date.now() - lastAttemptAt < FOREGROUND_MIN_GAP_MS) return;
  await refreshAlarmSound();
}

const OUTCOME_LABEL: Record<RefreshOutcome, string> = {
  downloaded: "downloaded a new recording",
  "up-to-date": "already had the latest",
  "not-ready": "recording still being prepared on the server",
  unavailable: "server unreachable or nothing recorded",
  "download-failed": "download failed",
  "size-mismatch": "downloaded file didn't match the expected size",
};

/** Plain-language summary of which recording this phone has saved and how the last check went —
 * for the hidden debug screen, since release builds keep no logs to look at. */
export async function describeSavedRecording(): Promise<string> {
  const record = await getCacheRecord();
  let saved = "Saved recording: none yet (using the built-in sound)";
  if (record) {
    const info = await FileSystem.getInfoAsync(record.path);
    if (info.exists) {
      const when = new Date(record.recordedAt).toLocaleString();
      const mb = ((info.size ?? record.size ?? 0) / (1024 * 1024)).toFixed(1);
      saved = "Saved recording: made " + when + " · " + mb + " MB";
    } else {
      saved = "Saved recording: file missing from the phone";
    }
  }
  let last = "Last check: not yet this session";
  try {
    const raw = await AsyncStorage.getItem(STATUS_KEY);
    if (raw) {
      const status = JSON.parse(raw) as { at: number; outcome: RefreshOutcome };
      last = "Last check: " + new Date(status.at).toLocaleTimeString() + " · " + (OUTCOME_LABEL[status.outcome] ?? status.outcome);
    }
  } catch {
    // Diagnostics only.
  }
  return saved + "\n" + last;
}
