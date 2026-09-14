// Asks our own backend (not Cloudflare directly — that needs an authenticated API token,
// which must never ship inside the mobile bundle) for a link to Bruno's most recent real
// recording. Used to keep the guaranteed native alarm sound fresh instead of it being one
// fixed clip forever — see lib/alarmSound.ts for what happens with the URL this returns.
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export type LatestRecording = {
  url: string;
  recordedAt: string;
};

export function isLatestRecordingConfigured(): boolean {
  return Boolean(BACKEND_URL);
}

/** Returns the latest recording's URL, or null if unconfigured, unreachable, or nothing has
 * been recorded yet — every failure mode collapses to the same "nothing to use" signal so
 * callers can fall back without needing to distinguish why. */
export async function fetchLatestRecording(): Promise<LatestRecording | null> {
  if (!BACKEND_URL) return null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/latest-recording`);
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.url !== "string" || typeof data?.recordedAt !== "string") return null;
    return { url: data.url, recordedAt: data.recordedAt };
  } catch {
    return null;
  }
}
