import { getStatus } from "@/lib/status";
import { getAllSubscriptions } from "@/lib/subscriptions";
import { YOUTUBE_LIVE_MODE } from "@/lib/youtube";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.4rem 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span style={{ fontFamily: "monospace", textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const secret = process.env.STATUS_SECRET;

  if (!secret || key !== secret) {
    return (
      <main>
        <div className="card">Not authorized. Pass <code>?key=STATUS_SECRET</code>.</div>
      </main>
    );
  }

  const status = getStatus();
  const subs = getAllSubscriptions();

  return (
    <main>
      <header>
        <h1>Bruno's Alarm — status</h1>
      </header>

      <div className="card">
        <Row label="Mode" value={`${status.mode}${YOUTUBE_LIVE_MODE ? "" : " (no YouTube credentials set)"}`} />
        <Row label="Is live" value={String(status.isLive)} />
        <Row label="Live video ID" value={status.liveVideoId ?? "—"} />
        <Row label="VOD ID" value={status.vodId ?? "—"} />
        <Row label="Last VOD fetch" value={status.lastVodFetchAt ? new Date(status.lastVodFetchAt).toLocaleString() : "—"} />
        <Row label="Last status check" value={status.lastStatusCheckAt ? new Date(status.lastStatusCheckAt).toLocaleString() : "—"} />
        <Row label="Subscribers" value={subs.length} />
      </div>

      {status.currentBroadcast && (
        <div className="card">
          <div className="label" style={{ marginBottom: "0.5rem" }}>Current broadcast (camera hardware config)</div>
          <Row label="Session" value={status.currentBroadcast.session} />
          <Row label="Scheduled for" value={new Date(status.currentBroadcast.scheduledFor).toLocaleString()} />
          <Row label="Broadcast ID" value={status.currentBroadcast.broadcastId} />
          <Row label="Ingest URL" value={status.currentBroadcast.ingestUrl} />
          <Row label="Stream key" value={status.currentBroadcast.streamKey} />
        </div>
      )}
    </main>
  );
}
