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

export async function isCloudflareStreamLive(): Promise<boolean> {
  if (!isCloudflareConfigured()) return false;
  try {
    const res = await fetch(
      `https://customer-${CUSTOMER_CODE}.cloudflarestream.com/${LIVE_INPUT_UID}/lifecycle`
    );
    if (!res.ok) return false;
    const data = await res.json();
    return data?.live === true;
  } catch {
    return false;
  }
}
