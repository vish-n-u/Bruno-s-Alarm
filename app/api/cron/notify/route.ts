import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { localSessionMatch } from "@/lib/schedule";
import { getAllSubscriptions, markNotified, removeSubscription } from "@/lib/subscriptions";
import { getStatus } from "@/lib/status";

const { VAPID_PRIVATE_KEY, VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, CRON_SECRET } = process.env;

/**
 * Intended to be hit every few minutes by an external scheduler (Vercel Cron,
 * Windows Task Scheduler, cron on a small VM). Sends a push to any subscriber
 * whose local time just entered a 6AM/18PM window, once per session.
 */
export async function POST(req: NextRequest) {
  if (!CRON_SECRET || req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!VAPID_PRIVATE_KEY || !NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  webpush.setVapidDetails(
    VAPID_SUBJECT || "mailto:example@example.com",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  const now = new Date();
  const subs = getAllSubscriptions();
  const status = getStatus();
  const body = status.isLive
    ? "It's live in India right now — tap to watch."
    : "Bruno's latest howl is ready to watch.";
  let sent = 0;

  for (const entry of subs) {
    const sessionAt = localSessionMatch(entry.timeZone, now);
    if (sessionAt === null || entry.lastNotifiedSessionAt === sessionAt) continue;

    try {
      await webpush.sendNotification(
        entry.subscription,
        JSON.stringify({
          title: "🐕 Bruno is howling!",
          body,
          url: "/",
        })
      );
      markNotified(entry.subscription.endpoint, sessionAt);
      sent++;
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        removeSubscription(entry.subscription.endpoint);
      }
    }
  }

  return NextResponse.json({ checked: subs.length, sent });
}
