"use client";

import { useEffect, useState } from "react";

// 6:00 and 18:00 IST, as minutes past UTC midnight — same anchors as lib/schedule.ts.
const SLOTS = [
  { label: "Morning howl", ist: "06:00", minutesUtc: 30 },
  { label: "Evening howl", ist: "18:00", minutesUtc: 750 },
];
const LIVE_WINDOW_MS = 15 * 60_000;
const DAY_MS = 86_400_000;

function utcMidnight(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function occurrences(minutesUtc: number, now: number) {
  const today = utcMidnight(now) + minutesUtc * 60_000;
  const last = today <= now ? today : today - DAY_MS;
  const next = today > now ? today : today + DAY_MS;
  return { last, next };
}

function localTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function dayWord(ms: number, now: number): string {
  const a = new Date(ms);
  const b = new Date(now);
  const sameDay = a.toDateString() === b.toDateString();
  if (sameDay) return "today";
  const tomorrow = new Date(now + DAY_MS);
  return a.toDateString() === tomorrow.toDateString() ? "tomorrow" : a.toLocaleDateString(undefined, { weekday: "short" });
}

function hoursOf(ms: number): number {
  const d = new Date(ms);
  return d.getHours() + d.getMinutes() / 60;
}

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/** Bruno's two daily sessions as a timetable, converted to the visitor's own clock. The IST
 * column is fixed and renders on the server; everything that depends on the visitor's
 * timezone fills in after mount. */
export default function DepartureBoard() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const rows = SLOTS.map((slot) => {
    if (now === null) return { ...slot, live: false, next: 0, local: "--:--", day: "", soonest: false };
    const { last, next } = occurrences(slot.minutesUtc, now);
    const live = now - last <= LIVE_WINDOW_MS;
    const at = live ? last : next;
    return { ...slot, live, next, local: localTime(at), day: dayWord(at, now), soonest: false };
  });

  const upcoming = rows.filter((r) => !r.live && r.next > 0).sort((a, b) => a.next - b.next)[0];
  if (upcoming) upcoming.soonest = true;
  const anyLive = rows.some((r) => r.live);

  // The visitor's own 24 hours as a strip: where Bruno's two sessions land in it, and where
  // "now" is — drawn as a sun or moon, the same sky logic as the app's Home screen.
  const track =
    now === null
      ? null
      : {
          nowPct: (hoursOf(now) / 24) * 100,
          isSun: hoursOf(now) >= 5 && hoursOf(now) < 18.5,
          marks: SLOTS.map((slot) => {
            const at = utcMidnight(now) + slot.minutesUtc * 60_000;
            return { key: slot.ist, pct: (hoursOf(at) / 24) * 100, label: localTime(at) };
          }),
        };

  return (
    <div className="board" role="table" aria-label="Bruno's daily schedule">
      <div className="board-head" role="row">
        <span role="columnheader">Session</span>
        <span role="columnheader">IST</span>
        <span role="columnheader">Your time</span>
        <span role="columnheader" className="board-status-col">Status</span>
      </div>
      {rows.map((r) => (
        <div className={r.live ? "board-row is-live" : "board-row"} role="row" key={r.ist}>
          <span className="board-session" role="cell">{r.label}</span>
          <span className="board-num board-ist" role="cell">{r.ist}</span>
          <span className="board-num board-local" role="cell">
            {r.local}
            {r.day && <small className="board-day">{r.day}</small>}
          </span>
          <span className="board-status" role="cell">
            {now === null ? (
              <span className="status-muted">&nbsp;</span>
            ) : r.live ? (
              <span className="status-live">
                <span className="live-dot" /> Howling now
              </span>
            ) : r.soonest ? (
              <span className="status-next">
                in <span className="board-num">{countdown(r.next - now)}</span>
              </span>
            ) : (
              <span className="status-muted">Scheduled</span>
            )}
          </span>
        </div>
      ))}
      <div className="track" aria-hidden="true">
        <p className="track-label">Your day</p>
        <div className="track-bar">
          {track && (
            <>
              <span className="track-elapsed" style={{ width: `${track.nowPct}%` }} />
              {track.marks.map((m) => (
                <span className="track-mark" style={{ left: `${m.pct}%` }} key={m.key}>
                  <span className="track-mark-label">{m.label}</span>
                </span>
              ))}
              <span className={track.isSun ? "track-now sun" : "track-now moon"} style={{ left: `${track.nowPct}%` }} />
            </>
          )}
        </div>
        <div className="track-scale">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
      </div>
      <p className="board-note">
        {anyLive
          ? "He's on right now. Open the app to watch the live camera."
          : "Give or take a few minutes. He's a dog, not a train."}
      </p>
    </div>
  );
}
