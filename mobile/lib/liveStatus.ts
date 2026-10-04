// Cloudflare Stream live-status check. Confirms the camera is actually
// connected right now, instead of trusting the 6AM/6PM clock window alone —
// see docs/youtube-embed-error-153.md's final update for why this replaced
// YouTube. Uses Cloudflare's public per-input subdomain, not the
// authenticated account API, so no API token is needed (or safe to ship) in
// the mobile bundle.
const CUSTOMER_CODE = process.env.EXPO_PUBLIC_CF_STREAM_CUSTOMER_CODE;
const LIVE_INPUT_UID = process.env.EXPO_PUBLIC_CF_LIVE_INPUT_UID;

export function isCloudflareConfigured(): boolean {
  return Boolean(CUSTOMER_CODE && LIVE_INPUT_UID);
}

export function getCloudflareLiveManifestUrl(): string | null {
  if (!isCloudflareConfigured()) return null;
  return `https://customer-${CUSTOMER_CODE}.cloudflarestream.com/${LIVE_INPUT_UID}/manifest/video.m3u8`;
}

/** HLS address of one broadcast's recording (its `videoUID`) — used to replay the stream that
 * just ended on the Live tab. Recordings on this account are public (no signed URLs). */
export function getCloudflareRecordingManifestUrl(videoUID: string): string | null {
  if (!CUSTOMER_CODE) return null;
  return `https://customer-${CUSTOMER_CODE}.cloudflarestream.com/${videoUID}/manifest/video.m3u8`;
}

export type LiveStatus = {
  live: boolean;
  /** Cloudflare's ID for the recording of the broadcast that's live right now — a new one for
   * every broadcast, identical on every phone. Used as the live chat room, so each stream gets
   * its own chat instead of sharing one with every other stream that half-day. Null when off. */
  streamId: string | null;
  /** False when Cloudflare couldn't be asked (offline, timeout, server error). That's "unknown",
   * not "off" — callers shouldn't end a stream they're showing because of one failed request. */
  reachable: boolean;
};

const OFFLINE: LiveStatus = { live: false, streamId: null, reachable: true };
const UNREACHABLE: LiveStatus = { live: false, streamId: null, reachable: false };
const REQUEST_TIMEOUT_MS = 8_000;

export async function getCloudflareLiveStatus(): Promise<LiveStatus> {
  if (!isCloudflareConfigured()) return OFFLINE;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`https://customer-${CUSTOMER_CODE}.cloudflarestream.com/${LIVE_INPUT_UID}/lifecycle`, {
      headers: { "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    if (!res.ok) return UNREACHABLE;
    const data = await res.json();
    if (data?.live !== true) return OFFLINE;
    return { live: true, streamId: typeof data.videoUID === "string" ? data.videoUID : null, reachable: true };
  } catch {
    return UNREACHABLE;
  } finally {
    clearTimeout(timeout);
  }
}
