import { overlapsSession } from "@/lib/schedule";

// Which Cloudflare Stream recordings count as one of Bruno's real sessions, shared by the two
// routes that pick one (see DECISIONS.md D1, D1a, D3):
//   /api/latest-recording — the ALARM clip: every phone's alarm sound + ringing video. Must be
//                           at least ALARM_MIN_SECONDS so the looping alarm isn't too short.
//   /api/last-howl        — the Live tab's "Watch his last howl": the newest session, even if
//                           short, so viewers always see the latest one.
// Every stream on the Live Input is recorded, test streams and broken recordings included, so
// both only accept recordings that are fully processed and overlap a scheduled 06:00/18:00 IST
// session (on 28 Sep a test stream became everyone's alarm).

export type CloudflareVideoSummary = {
  uid: string;
  created: string;
  duration?: number;
  status?: { state?: string };
  /** Cloudflare's own thumbnail image URL for the recording. */
  thumbnail?: string;
  /** Cloudflare's watch-page URL (customer subdomain); /watch → /iframe gives the embed player. */
  preview?: string;
};

/** Owner's rule: the alarm loops the clip, and a clip under 30 s loops too quickly. */
export const ALARM_MIN_SECONDS = 30;
/** Just enough to drop camera blips and reconnect fragments (often 9–14 s); his real sessions
 * have been ~25 s since mid-October. */
export const LAST_HOWL_MIN_SECONDS = 20;

// He isn't punctual: accept a stream that starts up to 10 min early or is still going 30 min late.
const SESSION_LEAD_MINUTES = 10;
const SESSION_LAG_MINUTES = 30;

export function isSessionRecording(v: CloudflareVideoSummary, minSeconds: number): boolean {
  if (v.status?.state !== "ready") return false;
  if (typeof v.duration !== "number" || v.duration < minSeconds) return false;
  const start = Date.parse(v.created);
  if (!Number.isFinite(start)) return false;
  return overlapsSession(start, start + v.duration * 1000, SESSION_LEAD_MINUTES, SESSION_LAG_MINUTES);
}

/** The newest real-session recording at least `minSeconds` long, or null. */
export function newestSessionRecording(
  videos: CloudflareVideoSummary[],
  minSeconds: number,
): CloudflareVideoSummary | null {
  const eligible = videos.filter((v) => isSessionRecording(v, minSeconds));
  if (eligible.length === 0) return null;
  return eligible.reduce((a, b) => (new Date(a.created) > new Date(b.created) ? a : b));
}
