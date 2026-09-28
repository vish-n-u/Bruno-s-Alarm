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

export type LiveStatus = {
  live: boolean;
  /** Cloudflare's ID for the recording of the broadcast that's live right now — a new one for
   * every broadcast, identical on every phone. Used as the live chat room, so each stream gets
   * its own chat instead of sharing one with every other stream that half-day. Null when off. */
  streamId: string | null;
};

const OFFLINE: LiveStatus = { live: false, streamId: null };

export async function getCloudflareLiveStatus(): Promise<LiveStatus> {
  if (!isCloudflareConfigured()) return OFFLINE;
  try {
    const res = await fetch(
      `https://customer-${CUSTOMER_CODE}.cloudflarestream.com/${LIVE_INPUT_UID}/lifecycle`
    );
    if (!res.ok) return OFFLINE;
    const data = await res.json();
    if (data?.live !== true) return OFFLINE;
    return { live: true, streamId: typeof data.videoUID === "string" ? data.videoUID : null };
  } catch {
    return OFFLINE;
  }
}
