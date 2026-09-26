import AsyncStorage from "@react-native-async-storage/async-storage";
// SDK 57's expo-file-system default export is a new class-based API without
// documentDirectory/downloadAsync/etc. — those live under the "legacy" subpath, which is
// what this file uses (simple imperative file ops, no need for the new API's File/Directory
// classes).
import * as FileSystem from "expo-file-system/legacy";
import { fetchLatestRecording } from "./latestRecording";

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

let inFlight: Promise<boolean> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let lastAttemptAt = 0;

/** One refresh attempt. Resolves true if it failed in a way that is worth retrying soon. */
async function attemptRefresh(): Promise<boolean> {
  try {
    AsyncStorage.removeItem(LEGACY_CACHE_KEY).catch(() => {});

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

      await FileSystem.deleteAsync(FINAL_PATH, { idempotent: true });
      await FileSystem.moveAsync({ from: TEMP_PATH, to: FINAL_PATH });
      const record: CacheRecord = { path: FINAL_PATH, recordedAt: latest.recordedAt, size };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(record));
      await recordOutcome("downloaded");
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
