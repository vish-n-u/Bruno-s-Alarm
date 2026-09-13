import { NextResponse } from "next/server";
import { getStatus } from "@/lib/status";

/** Public — never expose currentBroadcast (it holds the private RTMP ingest URL/key). */
export async function GET() {
  const status = getStatus();
  return NextResponse.json({
    isLive: status.isLive,
    liveVideoId: status.isLive ? status.liveVideoId : null,
    vodId: status.vodId,
    lastVodFetchAt: status.lastVodFetchAt,
  });
}
