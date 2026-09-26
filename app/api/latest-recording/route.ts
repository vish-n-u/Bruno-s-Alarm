import { NextResponse } from "next/server";
import {
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_LIVE_INPUT_UID } = process.env;
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;

function isConfigured(): boolean {
  return Boolean(CLOUDFLARE_API_TOKEN && CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_LIVE_INPUT_UID);
}

// R2 mirroring is optional — if unset, this route falls straight back to handing out
// Cloudflare Stream's own downloads URL, exactly as before. Why it exists: Stream bills per
// minute *delivered*, so every device that downloads the same ~1 minute recording directly
// from Stream adds another minute to the bill — at scale (thousands of devices, each
// fetching every new recording once) that adds up fast. R2 has no egress fee, so mirroring
// the file there once (this server fetches it from Stream a single time) and letting every
// device pull from R2 instead turns that same distribution into a few cents of storage/
// request cost, independent of how many devices there are.
function isR2Configured(): boolean {
  return Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_PUBLIC_URL);
}

function r2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY! },
  });
}

// One object PER recording, named after its Cloudflare video uid — never a fixed name like
// "latest.mp4". A fixed name is served through Cloudflare's cache for hours, so after a new
// recording overwrote it, phones kept getting the previous clip's bytes while being told it was
// the new one (and then never re-downloaded, since the app skips a download it thinks it has).
// A unique name per recording means a cached copy can only ever be the right one.
const R2_PREFIX = "alarm-recordings/";
// Only the newest few are kept: older ones are deleted after each mirror so storage stays tiny.
const R2_KEEP_NEWEST = 3;

function r2KeyFor(uid: string): string {
  return `${R2_PREFIX}${uid}.mp4`;
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

/** Deletes all but the newest few recordings (and the old fixed-name "latest.mp4" from before
 * each recording got its own name). Best-effort — a failure here never affects the response. */
async function pruneOldRecordings(client: S3Client): Promise<void> {
  try {
    const listed = await client.send(new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME, Prefix: R2_PREFIX }));
    const objects = (listed.Contents ?? []).filter((o) => o.Key && o.LastModified);
    objects.sort((a, b) => b.LastModified!.getTime() - a.LastModified!.getTime());
    const stale = objects.slice(R2_KEEP_NEWEST).map((o) => ({ Key: o.Key! }));
    const legacy = objects.slice(0, R2_KEEP_NEWEST).filter((o) => o.Key === `${R2_PREFIX}latest.mp4`);
    const toDelete = [...stale, ...legacy.map((o) => ({ Key: o.Key! }))];
    if (toDelete.length > 0) {
      await client.send(new DeleteObjectsCommand({ Bucket: R2_BUCKET_NAME, Delete: { Objects: toDelete } }));
    }
  } catch {
    // Cleanup is a nicety; stale files cost pennies.
  }
}

/** Mirrors `latest` into R2 if it isn't already there (a HEAD on its own unique key, so a
 * recording that's already mirrored costs nothing more), and returns its public R2 URL.
 * Returns null if Stream's downloadable MP4 for it isn't ready yet — same "not ready, try
 * again" signal the direct-from-Stream path used. */
async function getOrMirrorToR2(latest: CloudflareVideoSummary): Promise<string | null> {
  const client = r2Client();
  const key = r2KeyFor(latest.uid);
  const publicUrl = `${R2_PUBLIC_URL}/${key}`;

  try {
    await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return publicUrl;
  } catch {
    // Not mirrored yet — fall through and copy it.
  }

  // Same idempotent Stream call as the non-R2 path — the difference is this server fetches
  // the bytes itself (one delivery charge, not per-device) instead of handing the Stream URL
  // straight to the mobile app.
  const downloadsRes = await cloudflareFetch(`/stream/${latest.uid}/downloads`, { method: "POST" });
  if (!downloadsRes.ok) return null;
  const download = downloadsRes.body?.result?.default;
  if (download?.status !== "ready" || typeof download?.url !== "string") return null;

  const fileRes = await fetch(download.url);
  if (!fileRes.ok) return null;
  const bytes = new Uint8Array(await fileRes.arrayBuffer());

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: bytes,
      ContentType: "video/mp4",
      // Safe to cache for a long time: this exact address will never hold different bytes.
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: { recordedat: latest.created },
    }),
  );

  await pruneOldRecordings(client);
  return publicUrl;
}

/**
 * Public, unauthenticated GET — hands the mobile app a link to Bruno's most recent real
 * recording, so it can download it and refresh the guaranteed native alarm sound (see
 * mobile/lib/alarmSound.ts). Cloudflare's account Stream API needs a real API token, which
 * must never ship inside the mobile bundle — this route holds that token server-side and is
 * the only thing the app ever talks to directly for this. Still asks Cloudflare which
 * recording is latest on every call (see JOURNEY.md's flat-JSON-files-don't-survive-
 * serverless lesson — no local state here either) — the one piece of real persistence is the
 * optional R2 mirror above, which is a deliberate cache of the video file itself, not app
 * state, and self-heals from Cloudflare's answer every time regardless.
 *
 * Response shapes:
 *   200 { url, recordedAt }        — a ready-to-download MP4 exists (R2-mirrored URL if R2
 *                                    is configured, Stream's own downloads URL otherwise)
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

    if (isR2Configured()) {
      const mirroredUrl = await getOrMirrorToR2(latest);
      if (mirroredUrl) {
        return NextResponse.json({ url: mirroredUrl, recordedAt: latest.created });
      }
      return NextResponse.json({ error: "not_ready" }, { status: 202 });
    }

    // R2 not set up — fall back to handing out Stream's own downloads URL directly, same as
    // before R2 mirroring existed. Idempotent: if a downloadable MP4 already exists for this
    // video, Cloudflare returns its current status instead of regenerating; if none exists
    // yet, this starts creating one (which a later call will find ready).
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
