"use client";

import { useEffect, useState } from "react";

interface StatusResponse {
  isLive: boolean;
  liveVideoId: string | null;
  vodId: string | null;
  lastVodFetchAt: number | null;
}

export default function VideoPanel() {
  const [status, setStatus] = useState<StatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/status");
        const data: StatusResponse = await res.json();
        if (!cancelled) setStatus(data);
      } catch {
        // keep showing the last known status on a transient fetch failure
      }
    }
    poll();
    const id = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const live = status?.isLive ?? false;
  const videoId = live ? status?.liveVideoId : status?.vodId;

  return (
    <div>
      {status && (
        <div className={live ? "video-label live" : "video-label"}>
          {live ? "🔴 Live now in India!" : "Bruno's latest howl"}
        </div>
      )}
      <div className="video-frame">
        {videoId ? (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}${live ? "?autoplay=1&mute=1" : ""}`}
            title="Bruno's Alarm"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="video-placeholder">
            <div className="paw">🐕</div>
            <div>
              {live
                ? "Bruno should be live right now — camera isn't hooked up yet."
                : "No recording yet — check back after the first session airs."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
