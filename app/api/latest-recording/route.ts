import { NextResponse } from "next/server";

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_LIVE_INPUT_UID } = process.env;

function isConfigured(): boolean {
  return Boolean(CLOUDFLARE_API_TOKEN && CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_LIVE_INPUT_UID);
}

async function cloudflareFetch(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  return { ok: res.ok, body: await res.json().catch(() => null) };
}

type CloudflareVideoSummary = { uid: string; created: string };

/**
 * Public, unauthenticated GET — hands the mobile app a link to Bruno's most recent real
 * recording, so it can download it and refresh the guaranteed native alarm sound (see
 * mobile/lib/alarmSound.ts). Cloudflare's account Stream API needs a real API token, which
 * must never ship inside the mobile bundle — this route holds that token server-side and is
 * the only thing the app ever talks to directly for this. No caching/persistence here on
 * purpose (see JOURNEY.md's flat-JSON-files-don't-survive-serverless lesson) — it just asks
 * Cloudflare live, every time.
 *
 * Response shapes:
 *   200 { url, recordedAt }        — a ready-to-download MP4 exists
 *   404 { error: "no_recordings" } — the live input has no recordings yet
 *   202 { error: "not_ready" }     — the latest recording's MP4 is still being generated;
 *                                    this call also kicks off generation if it hadn't
 *                                    started, so a later call should succeed
 *   503 { error: "not_configured" }
 *   502 { error: "cloudflare_error" }
 * The mobile side treats every non-200 response identically (fall back to whatever's
 * already cached), so the specific error code here is for our own debugging, not consumed
 * by the app.
 */
export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  try {
    const videosRes = await cloudflareFetch(`/stream/live_inputs/${CLOUDFLARE_LIVE_INPUT_UID}/videos`);
    if (!videosRes.ok) {
      return NextResponse.json({ error: "cloudflare_error" }, { status: 502 });
    }

    const videos: CloudflareVideoSummary[] = videosRes.body?.result ?? [];
    if (videos.length === 0) {
      return NextResponse.json({ error: "no_recordings" }, { status: 404 });
    }

    const latest = videos.reduce((a, b) => (new Date(a.created) > new Date(b.created) ? a : b));

    // Idempotent: if a downloadable MP4 already exists for this video, Cloudflare returns
    // its current status instead of regenerating; if none exists yet, this starts creating
    // one (which a later call will find ready).
    const downloadsRes = await cloudflareFetch(`/stream/${latest.uid}/downloads`, { method: "POST" });
    if (!downloadsRes.ok) {
      return NextResponse.json({ error: "cloudflare_error" }, { status: 502 });
    }

    const download = downloadsRes.body?.result?.default;
    if (download?.status === "ready" && typeof download?.url === "string") {
      return NextResponse.json({ url: download.url, recordedAt: latest.created });
    }

    return NextResponse.json({ error: "not_ready" }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "cloudflare_error" }, { status: 502 });
  }
}
