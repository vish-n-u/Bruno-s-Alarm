import fs from "fs";
import path from "path";

export interface CurrentBroadcast {
  session: "morning" | "evening";
  /** Timestamp (ms) of the session this broadcast is for — the dedup key. */
  scheduledFor: number;
  broadcastId: string;
  streamId: string;
  ingestUrl: string;
  streamKey: string;
  createdAt: number;
}

export interface ChannelStatus {
  mode: "mock" | "live";
  currentBroadcast: CurrentBroadcast | null;
  isLive: boolean;
  liveVideoId: string | null;
  vodId: string | null;
  lastVodFetchAt: number | null;
  lastStatusCheckAt: number | null;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "status.json");

const DEFAULT_STATUS: ChannelStatus = {
  mode: "mock",
  currentBroadcast: null,
  isLive: false,
  liveVideoId: null,
  vodId: null,
  lastVodFetchAt: null,
  lastStatusCheckAt: null,
};

export function getStatus(): ChannelStatus {
  try {
    return { ...DEFAULT_STATUS, ...JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")) };
  } catch {
    return DEFAULT_STATUS;
  }
}

export function setStatus(patch: Partial<ChannelStatus>): ChannelStatus {
  const next = { ...getStatus(), ...patch };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2));
  return next;
}
