// Bruno's sessions are anchored to 6:00 and 18:00 India Standard Time (UTC+5:30, no DST).
// Kept in sync with the web app's lib/schedule.ts — copied rather than shared via a
// monorepo package, since it's ~50 lines of pure Date math with no other shared surface.
const SESSION_HOURS_UTC = [0.5 * 60, 12.5 * 60]; // 6:00 IST -> 00:30 UTC, 18:00 IST -> 12:30 UTC
const LIVE_WINDOW_MINUTES = 15;

function utcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Returns the timestamp (ms since epoch) of the next 6AM/6PM IST session after `now`. */
export function nextSessionAt(now: Date = new Date()): number {
  const todayMidnight = utcMidnight(now);
  const candidates: number[] = [];
  for (const dayOffset of [0, 1]) {
    for (const minutesUtc of SESSION_HOURS_UTC) {
      candidates.push(todayMidnight + dayOffset * 86400000 + minutesUtc * 60000);
    }
  }
  const future = candidates.filter((t) => t > now.getTime());
  return Math.min(...future);
}

/** Returns the next `count` upcoming session timestamps (ms), in order. */
export function nextSessions(count: number, now: Date = new Date()): number[] {
  const result: number[] = [];
  let cursor = now;
  for (let i = 0; i < count; i++) {
    const t = nextSessionAt(cursor);
    result.push(t);
    cursor = new Date(t + 1000);
  }
  return result;
}

/** Returns today's two 6AM/6PM IST session timestamps (ms), regardless of whether they're
 * already past or still upcoming — used to render the daily schedule pattern. */
export function todaysSessions(now: Date = new Date()): number[] {
  const todayMidnight = utcMidnight(now);
  return SESSION_HOURS_UTC.map((minutesUtc) => todayMidnight + minutesUtc * 60000);
}

/** Returns the timestamp (ms) of the most recent 6AM/6PM IST session at-or-before `now`. */
export function lastSessionAt(now: Date = new Date()): number {
  const todayMidnight = utcMidnight(now);
  const candidates: number[] = [];
  for (const dayOffset of [0, -1]) {
    for (const minutesUtc of SESSION_HOURS_UTC) {
      candidates.push(todayMidnight + dayOffset * 86400000 + minutesUtc * 60000);
    }
  }
  const past = candidates.filter((t) => t <= now.getTime());
  return Math.max(...past);
}

// TEMPORARY debug override so the "live" video path can be tested without waiting for a
// real 6AM/6PM boundary. Only affects isLiveWindow() (the video panel's live/VOD switch) —
// never touches nextSessionAt/nextSessions, so real alarm scheduling stays accurate
// regardless. Remove once no longer needed for testing.
let debugForceLive: boolean | null = null;
export function setDebugForceLive(value: boolean | null): void {
  debugForceLive = value;
}

/** Whether a Bruno session is likely live right now (within the streaming window). */
export function isLiveWindow(now: Date = new Date()): boolean {
  if (debugForceLive !== null) return debugForceLive;
  const last = lastSessionAt(now);
  return now.getTime() - last <= LIVE_WINDOW_MINUTES * 60000;
}
