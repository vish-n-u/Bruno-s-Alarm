import fs from "fs";
import path from "path";
import type { PushSubscription } from "web-push";

export interface StoredSubscription {
  subscription: PushSubscription;
  /** IANA timezone name, e.g. "Asia/Kolkata" or "America/New_York". Resolved fresh
   *  against the current date on every check, so it stays correct across DST changes. */
  timeZone: string;
  lastNotifiedSessionAt?: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "subscriptions.json");

function readAll(): StoredSubscription[] {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeAll(subs: StoredSubscription[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(subs, null, 2));
}

export function addSubscription(sub: PushSubscription, timeZone: string): void {
  const subs = readAll().filter((s) => s.subscription.endpoint !== sub.endpoint);
  subs.push({ subscription: sub, timeZone });
  writeAll(subs);
}

export function removeSubscription(endpoint: string): void {
  writeAll(readAll().filter((s) => s.subscription.endpoint !== endpoint));
}

export function getAllSubscriptions(): StoredSubscription[] {
  return readAll();
}

export function markNotified(endpoint: string, sessionAt: number): void {
  const subs = readAll();
  const entry = subs.find((s) => s.subscription.endpoint === endpoint);
  if (entry) {
    entry.lastNotifiedSessionAt = sessionAt;
    writeAll(subs);
  }
}
