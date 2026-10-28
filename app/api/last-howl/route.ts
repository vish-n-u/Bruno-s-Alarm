import { NextResponse } from "next/server";
import { LAST_HOWL_MIN_SECONDS, newestSessionRecording, type CloudflareVideoSummary } from "@/lib/sessionRecordings";

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_LIVE_INPUT_UID } = process.env;

/**
 * Public GET for the Live tab's "Watch his last howl" (DECISIONS.md D1a): Bruno's newest real
 * session, even a short one, as its Cloudflare video uid. The app streams it from Cloudflare
 * (HLS by uid, the same way the post-stream replay works), so it's always the newest session
 * with no download to wait for. Deliberately separate from /api/latest-recording, which picks
 * the ALARM clip under a stricter length rule.
 *
 *   200 { uid, recordedAt, duration, thumbnail?, embedUrl? }  (the last two are for the website)
 *   404 { error: "no_recordings" }
 *   503 { error: "not_configured" } · 502 { error: "cloudflare_error" }
 */
export async function GET() {
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_LIVE_INPUT_UID) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs/${CLOUDFLARE_LIVE_INPUT_UID}/videos`,
      { headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` } },
    );
    if (!res.ok) return NextResponse.json({ error: "cloudflare_error" }, { status: 502 });
    const body = await res.json();
    const videos: CloudflareVideoSummary[] = body?.result ?? [];
    const newest = newestSessionRecording(videos, LAST_HOWL_MIN_SECONDS);
    if (!newest) return NextResponse.json({ error: "no_recordings" }, { status: 404 });
    return NextResponse.json(
      {
        uid: newest.uid,
        recordedAt: newest.created,
        duration: newest.duration,
        thumbnail: newest.thumbnail,
        embedUrl: newest.preview ? newest.preview.replace(/\/watch$/, "/iframe") : undefined,
      },
      // A new session appears at most twice a day; a short shared cache spares Cloudflare's API.
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json({ error: "cloudflare_error" }, { status: 502 });
  }
}
