import { NextRequest, NextResponse } from "next/server";
import { nextSessionAt, sessionKindAt, shouldCreateBroadcastNow } from "@/lib/schedule";
import { getStatus, setStatus } from "@/lib/status";
import { createLiveBroadcast, getBroadcastLifecycleStatus, getLatestVodId, YOUTUBE_LIVE_MODE } from "@/lib/youtube";

const { CRON_SECRET } = process.env;

/**
 * Hit every ~5 minutes by an external scheduler (see .github/workflows/cron.yml — Vercel's
 * free Cron tier can't run more than once a day, so this doesn't use it). Creates this
 * session's broadcast a few minutes before it starts, polls its live status, and refreshes
 * the fallback VOD whenever nothing is currently live. Runs entirely against lib/youtube.ts's
 * mock mode until real YouTube credentials are configured — see that file.
 */
export async function POST(req: NextRequest) {
  if (!CRON_SECRET || req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let status = getStatus();

  if (shouldCreateBroadcastNow(now)) {
    const scheduledFor = nextSessionAt(now);
    if (status.currentBroadcast?.scheduledFor !== scheduledFor) {
      const session = sessionKindAt(scheduledFor);
      const created = await createLiveBroadcast(session, new Date(scheduledFor));
      status = setStatus({
        mode: YOUTUBE_LIVE_MODE ? "live" : "mock",
        currentBroadcast: { session, scheduledFor, createdAt: now.getTime(), ...created },
      });
    }
  }

  if (status.currentBroadcast) {
    const lifecycle = await getBroadcastLifecycleStatus(status.currentBroadcast.broadcastId);
    const isLive = lifecycle === "live";
    status = setStatus({
      isLive,
      liveVideoId: isLive ? status.currentBroadcast.broadcastId : null,
      lastStatusCheckAt: now.getTime(),
    });
  }

  if (!status.isLive) {
    const vodId = await getLatestVodId();
    status = setStatus({ vodId, lastVodFetchAt: now.getTime() });
  }

  return NextResponse.json(status);
}
