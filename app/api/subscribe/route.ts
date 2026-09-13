import { NextRequest, NextResponse } from "next/server";
import { isValidTimeZone } from "@/lib/schedule";
import { addSubscription, removeSubscription } from "@/lib/subscriptions";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { subscription, timeZone } = body ?? {};
  if (!subscription?.endpoint || typeof timeZone !== "string" || !isValidTimeZone(timeZone)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  addSubscription(subscription, timeZone);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { endpoint } = body ?? {};
  if (!endpoint) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  removeSubscription(endpoint);
  return NextResponse.json({ ok: true });
}
