// Bruno's sessions are anchored to 6:00 and 18:00 India Standard Time (UTC+5:30, no DST).
const SESSION_HOURS_UTC = [
  0.5 * 60, // 6:00 IST -> 00:30 UTC, in minutes-past-midnight
  12.5 * 60, // 18:00 IST -> 12:30 UTC
];
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

/** Which of the two daily sessions a session timestamp (from nextSessionAt/lastSessionAt)
 *  belongs to, based on which SESSION_HOURS_UTC slot it falls in. */
export function sessionKindAt(sessionTimestamp: number): "morning" | "evening" {
  const minutesOfDayUtc = new Date(sessionTimestamp).getUTCHours() * 60 + new Date(sessionTimestamp).getUTCMinutes();
  return minutesOfDayUtc < SESSION_HOURS_UTC[1] ? "morning" : "evening";
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

/** Whether a Bruno session is likely live right now (within the streaming window).
 *  Also doubles as the mock YouTube lifecycle status in lib/youtube.ts. */
export function isLiveWindow(now: Date = new Date()): boolean {
  const last = lastSessionAt(now);
  return now.getTime() - last <= LIVE_WINDOW_MINUTES * 60000;
}

/** Minutes east of UTC for an IANA zone *right now* (DST-correct, recomputed every call —
 *  unlike a stored offset, this never drifts when a subscriber's zone changes clocks). */
function getUtcOffsetMinutes(timeZone: string, now: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((asUtc - now.getTime()) / 60000);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Is it currently within LIVE_WINDOW_MINUTES of a *local* 6:00 or 18:00 in this IANA
 *  timezone? Used for per-timezone push scheduling. */
export function isLocalSessionWindow(timeZone: string, now: Date = new Date()): boolean {
  return localSessionMatch(timeZone, now) !== null;
}

/** If `now` falls within the local session window for this timezone, returns a UTC
 *  timestamp identifying that specific session (stable across repeated calls during
 *  the same window), for use as a dedup key. Otherwise returns null. */
export function localSessionMatch(timeZone: string, now: Date = new Date()): number | null {
  const offsetMinutes = getUtcOffsetMinutes(timeZone, now);
  const nowMinutes = now.getTime() / 60000 + offsetMinutes;
  const localMinutesOfDay = (((nowMinutes % 1440) + 1440) % 1440);
  const dayStartUtcMinutes = Math.floor(nowMinutes - localMinutesOfDay) - offsetMinutes;
  for (const target of [6 * 60, 18 * 60]) {
    if (Math.abs(localMinutesOfDay - target) <= LIVE_WINDOW_MINUTES) {
      return (dayStartUtcMinutes + target) * 60000;
    }
  }
  return null;
}

const BROADCAST_CREATION_LEAD_MINUTES = 10;

/** True from ~10 minutes before a session until it starts — the window in which the
 *  sync-youtube cron job should create that session's YouTube broadcast. */
export function shouldCreateBroadcastNow(now: Date = new Date()): boolean {
  return nextSessionAt(now) - now.getTime() <= BROADCAST_CREATION_LEAD_MINUTES * 60000;
}
