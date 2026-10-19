// Asks our own backend (not Cloudflare directly — that needs an authenticated API token,
// which must never ship inside the mobile bundle) for a link to Bruno's most recent real
// recording. Used to keep the guaranteed native alarm sound fresh instead of it being one
// fixed clip forever — see lib/alarmSound.ts for what happens with the URL this returns.
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export type LatestRecording = {
  url: string;
  recordedAt: string;
};

export type LatestRecordingResult =
  | { status: "ready"; recording: LatestRecording }
  // The backend answered 202: a newer recording exists but Cloudflare is still preparing its
  // downloadable file. Worth asking again in a minute or two, unlike the cases below.
  | { status: "not_ready" }
  // Unconfigured, offline, backend error, or nothing has ever been recorded.
  | { status: "unavailable" };

export function isLatestRecordingConfigured(): boolean {
  return Boolean(BACKEND_URL);
}

export async function fetchLatestRecording(): Promise<LatestRecordingResult> {
  if (!BACKEND_URL) return { status: "unavailable" };
  try {
    const res = await fetch(`${BACKEND_URL}/api/latest-recording`);
    if (res.status === 202) return { status: "not_ready" };
    if (!res.ok) return { status: "unavailable" };
    const data = await res.json();
    if (typeof data?.url !== "string" || typeof data?.recordedAt !== "string") {
      return { status: "unavailable" };
    }
    return { status: "ready", recording: { url: data.url, recordedAt: data.recordedAt } };
  } catch {
    return { status: "unavailable" };
  }
}

/** The Live tab's "Watch his last howl": the newest real session, even a short one, from
 * /api/last-howl (separate from the alarm clip's stricter length rule; DECISIONS.md D1a).
 * Returns its Cloudflare video uid to stream, or null if unavailable (offline, none yet). */
export async function fetchLastHowl(): Promise<{ uid: string; recordedAt: string } | null> {
  if (!BACKEND_URL) return null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/last-howl`);
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.uid !== "string" || typeof data?.recordedAt !== "string") return null;
    return { uid: data.uid, recordedAt: data.recordedAt };
  } catch {
    return null;
  }
}
