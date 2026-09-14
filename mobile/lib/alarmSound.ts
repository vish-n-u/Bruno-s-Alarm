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
const CACHE_KEY = "bruno-alarm-sound-cache";
const FINAL_PATH = `${FileSystem.documentDirectory}alarm_sound_latest.mp4`;
const TEMP_PATH = `${FileSystem.documentDirectory}alarm_sound_latest.download.mp4`;

type CacheRecord = { path: string; recordedAt: string };

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

/** Fetches the latest recording and downloads it, replacing the cached sound only once the
 * new download actually finishes — a failed or partial refresh always leaves whatever was
 * cached before untouched, never a half-written file. Safe to call opportunistically (e.g.
 * every time alarms are (re)scheduled); silently no-ops on any failure — no backend
 * configured, no network, nothing recorded yet, download failure. */
export async function refreshAlarmSound(): Promise<void> {
  const latest = await fetchLatestRecording();
  if (!latest) return;

  const existing = await getCacheRecord();
  if (existing?.recordedAt === latest.recordedAt) return; // already have this one cached

  try {
    const result = await FileSystem.downloadAsync(latest.url, TEMP_PATH);
    if (result.status !== 200) return;
    await FileSystem.deleteAsync(FINAL_PATH, { idempotent: true });
    await FileSystem.moveAsync({ from: TEMP_PATH, to: FINAL_PATH });
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ path: FINAL_PATH, recordedAt: latest.recordedAt }));
  } catch {
    // Network failure, storage full, etc. — leave whatever was cached before untouched.
  } finally {
    FileSystem.deleteAsync(TEMP_PATH, { idempotent: true }).catch(() => {});
  }
}
