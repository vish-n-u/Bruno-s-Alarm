import { google } from "googleapis";
import { isLiveWindow } from "./schedule";

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, YOUTUBE_CHANNEL_ID } =
  process.env;

/**
 * Real YouTube calls require an OAuth-authorized channel owner (liveBroadcasts.insert
 * can't be done with an API key alone). Until those credentials exist, every function
 * below falls back to a mock that reuses the site's existing clock-based logic and the
 * manually-set NEXT_PUBLIC_YOUTUBE_LIVE_ID/VOD_ID env vars — so the whole pipeline
 * (cron job, status record, frontend) is fully testable without a YouTube API call ever
 * being made. Filling in the four env vars above is the only thing that switches this
 * over to real API calls; no other code changes needed.
 */
export const YOUTUBE_LIVE_MODE = Boolean(
  GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN && YOUTUBE_CHANNEL_ID
);

function getAuthedClient() {
  const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return google.youtube({ version: "v3", auth: oauth2Client });
}

export interface CreatedBroadcast {
  broadcastId: string;
  streamId: string;
  ingestUrl: string;
  streamKey: string;
}

export async function createLiveBroadcast(
  session: "morning" | "evening",
  scheduledFor: Date
): Promise<CreatedBroadcast> {
  if (!YOUTUBE_LIVE_MODE) {
    console.log(`[youtube mock] createLiveBroadcast(${session}, ${scheduledFor.toISOString()})`);
    const fakeId = `mock-${scheduledFor.getTime()}`;
    return {
      broadcastId: fakeId,
      streamId: `${fakeId}-stream`,
      ingestUrl: "rtmp://mock.invalid/live2",
      streamKey: `MOCK-${fakeId}`,
    };
  }

  // TODO(real credentials): verified against the YouTube Data API v3 docs, not yet run
  // against a real channel. Re-check quota/error handling once GOOGLE_REFRESH_TOKEN is real.
  const youtube = getAuthedClient();
  const title = `Bruno's ${session === "morning" ? "6AM" : "6PM"} howl — ${scheduledFor.toDateString()}`;

  const stream = await youtube.liveStreams.insert({
    part: ["snippet", "cdn"],
    requestBody: {
      snippet: { title },
      cdn: { frameRate: "variable", ingestionType: "rtmp", resolution: "variable" },
    },
  });

  const broadcast = await youtube.liveBroadcasts.insert({
    part: ["snippet", "status", "contentDetails"],
    requestBody: {
      snippet: {
        title,
        scheduledStartTime: scheduledFor.toISOString(),
      },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
      contentDetails: { enableAutoStart: true, enableAutoStop: true },
    },
  });

  const broadcastId = broadcast.data.id!;
  const streamId = stream.data.id!;

  await youtube.liveBroadcasts.bind({
    id: broadcastId,
    part: ["id"],
    streamId,
  });

  const ingestionInfo = stream.data.cdn?.ingestionInfo;
  return {
    broadcastId,
    streamId,
    ingestUrl: ingestionInfo?.ingestionAddress ?? "",
    streamKey: ingestionInfo?.streamName ?? "",
  };
}

export async function getBroadcastLifecycleStatus(broadcastId: string): Promise<string> {
  if (!YOUTUBE_LIVE_MODE) {
    return isLiveWindow() ? "live" : "complete";
  }

  // TODO(real credentials): not yet run against a real broadcast ID.
  const youtube = getAuthedClient();
  const res = await youtube.liveBroadcasts.list({ part: ["status"], id: [broadcastId] });
  return res.data.items?.[0]?.status?.lifeCycleStatus ?? "unknown";
}

export async function getLatestVodId(): Promise<string | null> {
  if (!YOUTUBE_LIVE_MODE) {
    console.log("[youtube mock] getLatestVodId() -> NEXT_PUBLIC_YOUTUBE_VOD_ID");
    return process.env.NEXT_PUBLIC_YOUTUBE_VOD_ID || null;
  }

  // TODO(real credentials): not yet run against a real channel. Uploads playlist ID is
  // the channel's contentDetails.relatedPlaylists.uploads (swap "UC" prefix for "UU").
  const youtube = getAuthedClient();
  const channel = await youtube.channels.list({
    part: ["contentDetails"],
    id: [YOUTUBE_CHANNEL_ID!],
  });
  const uploadsPlaylistId = channel.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) return null;

  const items = await youtube.playlistItems.list({
    part: ["contentDetails"],
    playlistId: uploadsPlaylistId,
    maxResults: 1,
  });
  return items.data.items?.[0]?.contentDetails?.videoId ?? null;
}
