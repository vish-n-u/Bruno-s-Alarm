"use client";

import { useEffect, useState } from "react";
import { isLiveWindow, nextSessionAt } from "@/lib/schedule";

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export default function Countdown() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return (
      <div className="countdown">
        <div className="label">Next session</div>
        <div className="clock">--:--:--</div>
      </div>
    );
  }

  const live = isLiveWindow(now);
  const target = nextSessionAt(now);
  const localTime = new Date(target).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="countdown">
      {live && (
        <div className="badge-live">
          <span className="dot" />
          LIVE NOW
        </div>
      )}
      <div className="label">{live ? "Session in progress" : "Next session in"}</div>
      <div className="clock">{live ? "🐾" : formatDuration(target - now.getTime())}</div>
      <div className="local-time">
        {live ? "Bruno is howling right now" : `That's ${localTime} your time`}
      </div>
    </div>
  );
}
