import { timingSafeEqual } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type Timestamp, type Transaction } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import * as logger from "firebase-functions/logger";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { Filter } from "bad-words";

// Bruno's Alarm live chat — this is the ONLY write path for chat messages. The mobile app
// never writes to Firestore's sessions/{id}/messages directly (see firestore.rules, which
// blocks that entirely) — it only ever calls this callable function, so every message is
// validated, moderated, rate-limited, and capped server-side before it's ever written.
// Firestore transactions can't cleanly enforce "count of recent writes" or "time since last
// write" atomically across documents — routing through this function instead is what makes
// the rate limit and the per-session cap actually reliable, not just a client-side courtesy.

initializeApp();
setGlobalOptions({ maxInstances: 10 });

const db = getFirestore();
const profanityFilter = new Filter();

const MAX_MESSAGE_LENGTH = 200;
// "Roughly one message per few seconds per device" — enforced per (session, uid) pair via a
// small rateLimits doc, not by querying/ordering the messages collection itself.
const RATE_LIMIT_MS = 3000;
// Hard ceiling per session — chat only ever mounts during a live window in the app (see
// LiveChat.tsx), so volume is already naturally bounded; this is a backstop, not the primary
// cost control.
const SESSION_MESSAGE_CAP = 500;

// "Bruno's Pack" is a persistent room (see screens/BrunosPackScreen.tsx), not a per-session
// chat that naturally resets — a lifetime message cap would eventually make it permanently
// "full" and never recoverable. Exempted here rather than removing the cap outright, so a
// real live session still gets the backstop. Rate limiting still applies either way.
const UNCAPPED_SESSION_IDS = new Set(["brunos-pack"]);

// Counts Unicode code points, not UTF-16 code units — matches the client's own check in
// lib/chat.ts so the two never disagree about what "200 characters" means for a
// surrogate-pair-heavy message (most emoji).
function codePointLength(text: string): number {
  return [...text].length;
}

// The fallback name: deterministic, so the same anonymous uid always reads as the same
// "Viewer NNNN" — used whenever the app doesn't send a name (older app versions, someone who
// skipped the name step on an older build) or sends one that fails the checks below.
function displayNameForUid(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (Math.imul(hash, 31) + uid.charCodeAt(i)) >>> 0;
  }
  return `Viewer ${1000 + (hash % 9000)}`;
}

const MAX_NAME_LENGTH = 24; // matches the onboarding name field's own maxLength
// Names that would read as the dog or the app's own staff. Not a full impersonation defence —
// just stops the obvious ones. Anything that matches quietly falls back to "Viewer NNNN".
const RESERVED_NAME = /\b(bruno|admin|administrator|moderator|mod|staff|official|support)\b/i;

/** The name shown next to a message. The app sends the name typed during onboarding, but a
 * client-supplied value is untrusted — a modified app could send anything — so it's cleaned and
 * checked here, and any failure just uses the anonymous "Viewer NNNN" instead of rejecting the
 * message. */
function chatNameFor(uid: string, raw: unknown): string {
  const fallback = displayNameForUid(uid);
  if (typeof raw !== "string") return fallback;
  const cleaned = [...raw.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim()]
    .slice(0, MAX_NAME_LENGTH)
    .join("")
    .trim();
  if (cleaned.length === 0) return fallback;
  if (profanityFilter.isProfane(cleaned) || RESERVED_NAME.test(cleaned)) return fallback;
  return cleaned;
}

type SendChatMessageRequest = {
  sessionId?: unknown;
  text?: unknown;
  displayName?: unknown;
};

export const sendChatMessage = onCall<SendChatMessageRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign-in required.");
  }

  const { sessionId, text: rawText, displayName: rawName } = request.data ?? {};
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    throw new HttpsError("invalid-argument", "Missing sessionId.");
  }
  if (typeof rawText !== "string") {
    throw new HttpsError("invalid-argument", "Missing text.");
  }

  const text = rawText.trim();
  if (text.length === 0) {
    throw new HttpsError("invalid-argument", "Message is empty.");
  }
  if (codePointLength(text) > MAX_MESSAGE_LENGTH) {
    throw new HttpsError("invalid-argument", "Message is too long.");
  }
  // The client already ran this same check for instant feedback — this re-check is what
  // actually matters, since a modified/bypassed client could skip its own copy entirely.
  if (profanityFilter.isProfane(text)) {
    throw new HttpsError("invalid-argument", "Message not allowed.");
  }

  const sessionRef = db.collection("sessions").doc(sessionId);
  const rateLimitRef = sessionRef.collection("rateLimits").doc(uid);
  const messageRef = sessionRef.collection("messages").doc();

  await db.runTransaction(async (tx: Transaction) => {
    const [sessionSnap, rateLimitSnap] = await Promise.all([tx.get(sessionRef), tx.get(rateLimitRef)]);

    const lastMessageAt = rateLimitSnap.data()?.lastMessageAt as Timestamp | undefined;
    if (lastMessageAt && Date.now() - lastMessageAt.toMillis() < RATE_LIMIT_MS) {
      throw new HttpsError("resource-exhausted", "Sending too fast.");
    }

    const messageCount = (sessionSnap.data()?.messageCount as number | undefined) ?? 0;
    if (!UNCAPPED_SESSION_IDS.has(sessionId) && messageCount >= SESSION_MESSAGE_CAP) {
      throw new HttpsError("failed-precondition", "Chat is full for this session.");
    }

    // lastMessageAt is what cleanupOldChat (below) uses to tell an active chat from a finished one.
    tx.set(
      sessionRef,
      { messageCount: FieldValue.increment(1), lastMessageAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    tx.set(rateLimitRef, { lastMessageAt: FieldValue.serverTimestamp() });
    tx.create(messageRef, {
      text,
      displayName: chatNameFor(uid, rawName),
      deviceId: uid,
      timestamp: FieldValue.serverTimestamp(),
      flagged: false,
    });
  });

  return { ok: true };
});

// --- Deleting finished chats ------------------------------------------------------------
// Chat is per live session and only ever shown while that session is live, so nothing needs to
// keep a session's messages once it's over. This runs hourly and removes every session that's
// been quiet for CHAT_RETENTION_MS (a buffer past the last message so a stream that's still going
// isn't cut off mid-chat). The persistent "Bruno's Pack" room is never touched.
const CHAT_RETENTION_MS = 2 * 60 * 60 * 1000;

/** "2026-09-18-AM" / "-PM" -> that session's start (00:30 / 12:30 UTC), or null if the id isn't
 * one of the app's own session ids. */
function sessionStartFromId(id: string): number | null {
  const m = /^(\d{4}-\d{2}-\d{2})-(AM|PM)$/.exec(id);
  if (!m) return null;
  const t = Date.parse(`${m[1]}T${m[2] === "AM" ? "00:30" : "12:30"}:00Z`);
  return Number.isFinite(t) ? t : null;
}

async function lastActivityMs(sessionRef: FirebaseFirestore.DocumentReference): Promise<number> {
  const snap = await sessionRef.get();
  const last = snap.data()?.lastMessageAt as Timestamp | undefined;
  if (last) return last.toMillis();
  // Sessions written before lastMessageAt existed: fall back to the newest message, then to the
  // session's own start time. Anything with neither is empty or a stray test doc — treat as old.
  const newest = await sessionRef.collection("messages").orderBy("timestamp", "desc").limit(1).get();
  const ts = newest.docs[0]?.data()?.timestamp as Timestamp | undefined;
  if (ts) return ts.toMillis();
  return sessionStartFromId(sessionRef.id) ?? 0;
}

/** A report only stores the message's id, so once the message is gone the report would be
 * unreadable. Copy the reported text (read here on the server, so it can't be faked by whoever
 * filed the report) onto each report before its session is deleted. */
async function archiveReportedMessages(sessionRef: FirebaseFirestore.DocumentReference): Promise<number> {
  const reports = await db.collection("reports").where("sessionId", "==", sessionRef.id).get();
  let archived = 0;
  for (const report of reports.docs) {
    if (report.data().messageText !== undefined) continue;
    const messageId = report.data().messageId;
    if (typeof messageId !== "string") continue;
    const message = await sessionRef.collection("messages").doc(messageId).get();
    const data = message.data();
    await report.ref.update({
      messageText: data?.text ?? null,
      reportedDisplayName: data?.displayName ?? null,
      reportedUid: data?.deviceId ?? null,
      archivedAt: FieldValue.serverTimestamp(),
    });
    archived++;
  }
  return archived;
}

export const cleanupOldChat = onSchedule("every 60 minutes", async () => {
  const cutoff = Date.now() - CHAT_RETENTION_MS;
  const sessionRefs = await db.collection("sessions").listDocuments();
  let deleted = 0;
  let archivedReports = 0;
  for (const ref of sessionRefs) {
    if (UNCAPPED_SESSION_IDS.has(ref.id)) continue;
    if ((await lastActivityMs(ref)) > cutoff) continue;
    archivedReports += await archiveReportedMessages(ref);
    await db.recursiveDelete(ref);
    deleted++;
  }
  logger.info("Chat cleanup", { checked: sessionRefs.length, deleted, archivedReports });
});

// --- "Bruno just went live" push ---------------------------------------------------------
// Cloudflare Stream can call a webhook the moment the live input starts receiving video
// (Notifications -> Stream Live Input -> "connected"). This receives it and pushes to
// everyone subscribed to the "live" FCM topic — the app joins that topic while "Wake me up
// with Bruno" is on (see mobile/lib/liveAlerts.ts). A topic means no device tokens are stored
// anywhere. Unlike the scheduled 6AM/6PM alarms, this follows the real stream, so it also
// covers Bruno going live early or late.
const LIVE_ALERT_TOPIC = "live";
// A dropped-and-reconnected stream fires "connected" again; one push per go-live is enough.
const LIVE_ALERT_MIN_GAP_MS = 30 * 60 * 1000;

function secretsMatch(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // Length check runs first (and short-circuits) specifically so a wrong-length header never
  // reaches timingSafeEqual, which throws on mismatched buffer lengths rather than returning
  // false — that would otherwise turn a bad request into a 500 instead of a clean 401.
  return a.length === b.length && timingSafeEqual(a, b);
}

export const cloudflareLiveWebhook = onRequest(async (req, res) => {
  const secret = process.env.CF_WEBHOOK_SECRET;
  if (!secret || !secretsMatch(req.get("cf-webhook-auth"), secret)) {
    res.status(401).send("unauthorized");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send("method not allowed");
    return;
  }

  // Cloudflare's payload: { name, text, data: { event_type, input_id, ... }, ts }. Anything
  // else (including the test ping when a webhook is first created) is acknowledged and ignored.
  const data = req.body?.data;
  const expectedInput = process.env.CF_LIVE_INPUT_UID;
  if (data?.event_type !== "live_input.connected" || (expectedInput && data?.input_id !== expectedInput)) {
    logger.info("Live webhook ignored", { eventType: data?.event_type, inputId: data?.input_id });
    res.status(200).send("ignored");
    return;
  }

  // Read-then-write inside a transaction, not a plain read-then-write — Cloudflare (or any
  // webhook sender) can deliver the same event more than once, and two near-simultaneous
  // deliveries reading the same stale "not throttled yet" value before either writes would
  // otherwise both pass the check and double-ring everyone. Firestore transactions serialize
  // conflicting reads/writes (retrying one of them), so only one delivery ever wins the claim.
  const alertRef = db.doc("system/liveAlert");
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(alertRef);
    const lastSent = (snap.data()?.lastSentAt as Timestamp | undefined)?.toMillis() ?? 0;
    if (Date.now() - lastSent < LIVE_ALERT_MIN_GAP_MS) return false;
    tx.set(alertRef, { lastSentAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (!claimed) {
    logger.info("Live webhook throttled");
    res.status(200).send("throttled");
    return;
  }

  // Two separate messages on purpose. A message with a `notification` block is shown by the
  // system itself — reliable even if the phone froze the app — but Android then never runs the
  // app's own handler for it. A data-only message is the opposite: it can wake the app to ring
  // a real alarm (mobile/lib/liveAlertRinger.ts), but a battery-managed phone may hold it back.
  // Sending both means there's always a visible alert, with the alarm as the bonus.
  const [visible, alarm] = await Promise.allSettled([
    getMessaging().send({
      topic: LIVE_ALERT_TOPIC,
      notification: { title: "🐕 Bruno is live!", body: "He just started. Tap to watch." },
      android: { priority: "high" },
    }),
    getMessaging().send({
      topic: LIVE_ALERT_TOPIC,
      data: { type: "live" },
      android: { priority: "high" },
    }),
  ]);
  logger.info("Live push results", {
    visible: visible.status,
    alarm: alarm.status,
    visibleError: visible.status === "rejected" ? String(visible.reason) : undefined,
    alarmError: alarm.status === "rejected" ? String(alarm.reason) : undefined,
  });

  if (visible.status === "rejected" && alarm.status === "rejected") {
    // Nothing went out — release the claim so Cloudflare's retry (or the next connect) isn't
    // wrongly throttled.
    await alertRef.delete().catch(() => {});
    res.status(500).send("push failed");
    return;
  }
  res.status(200).send("sent");
});
