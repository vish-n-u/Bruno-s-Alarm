import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  getFirestore,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from "@react-native-firebase/firestore";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { Filter } from "bad-words";
import { ensureAnonymousAuth } from "./firebase";

// Live chat, scoped to one real Bruno session at a time (see lib/schedule.ts's
// currentSessionId()) rather than one continuous room. All writes go through a single
// callable Cloud Function (see functions/ at the repo root) — the client never writes to
// Firestore directly. That function is what actually enforces length, profanity, the
// per-device rate limit, and the per-session message cap; Firestore security rules block
// direct client writes entirely (see firestore.rules), so none of that is duplicated or
// trusted client-side.

const MAX_MESSAGE_LENGTH = 200;
const MESSAGE_HISTORY_LIMIT = 100;
const TOS_ACCEPTED_KEY = "bruno-chat-tos-accepted";
const BLOCKED_USERS_KEY = "bruno-chat-blocked-users";

const profanityFilter = new Filter();

export type ChatMessage = {
  id: string;
  text: string;
  displayName: string;
  deviceId: string;
  timestamp: number; // ms since epoch, converted from Firestore's server timestamp
  flagged: boolean;
};

export type SendMessageResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "too-long" | "profanity" | "rate-limited" | "session-full" | "not-signed-in" | "unknown" };

// Counts Unicode code points, not UTF-16 code units — plain `.length` overcounts emoji that
// are surrogate pairs (most emoji outside the earliest set), which would reject
// shorter-looking messages or risk truncating mid-character. Still not fully
// grapheme-cluster-aware (a flag or a skin-toned/ZWJ-joined emoji is multiple code points),
// but it's a real improvement over `.length` with no extra dependency.
function codePointLength(text: string): number {
  return [...text].length;
}

/** One-time gate: a device must accept basic chat conduct rules before its first-ever send.
 * Viewing/reading chat never requires this — only posting does. */
export async function hasAcceptedChatTerms(): Promise<boolean> {
  return (await AsyncStorage.getItem(TOS_ACCEPTED_KEY)) === "true";
}

export async function acceptChatTerms(): Promise<void> {
  await AsyncStorage.setItem(TOS_ACCEPTED_KEY, "true");
}

/** Per-device local block list — deliberately not synced to a server. Blocking only affects
 * what this device renders locally; it's not reported to the blocked user or anyone else. */
export async function getBlockedDeviceIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(BLOCKED_USERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function blockDevice(deviceId: string): Promise<void> {
  const current = await getBlockedDeviceIds();
  if (current.includes(deviceId)) return;
  await AsyncStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify([...current, deviceId]));
}

/** Writes to the `reports` collection directly (allowed by security rules — create-only, no
 * client read back) rather than going through the callable function, since a report is never
 * subject to the same moderation/rate-limit concerns as a chat message itself. */
export async function reportChatMessage(
  sessionId: string,
  messageId: string,
  reason: string
): Promise<void> {
  const user = await ensureAnonymousAuth();
  await addDoc(collection(getFirestore(), "reports"), {
    sessionId,
    messageId,
    reportedBy: user.uid,
    reason,
    timestamp: serverTimestamp(),
  });
}

/** Sends one chat message via the callable Cloud Function — never a direct Firestore write.
 * Runs the same cheap checks (empty/length/profanity) the function will also enforce, purely
 * so a well-meaning user gets instant feedback instead of a round trip; none of this is a
 * substitute for the function's own server-side enforcement, which a client could trivially
 * bypass. */
export async function sendChatMessage(sessionId: string, rawText: string): Promise<SendMessageResult> {
  const text = rawText.trim();
  if (text.length === 0) return { ok: false, reason: "empty" };
  if (codePointLength(text) > MAX_MESSAGE_LENGTH) return { ok: false, reason: "too-long" };
  if (profanityFilter.isProfane(text)) return { ok: false, reason: "profanity" };

  try {
    await ensureAnonymousAuth();
  } catch {
    return { ok: false, reason: "not-signed-in" };
  }

  const send = httpsCallable<{ sessionId: string; text: string }, { ok: true }>(
    getFunctions(),
    "sendChatMessage"
  );
  try {
    await send({ sessionId, text });
    return { ok: true };
  } catch (error) {
    const code = (error as { code?: string } | undefined)?.code;
    if (code === "functions/resource-exhausted") return { ok: false, reason: "rate-limited" };
    if (code === "functions/failed-precondition") return { ok: false, reason: "session-full" };
    return { ok: false, reason: "unknown" };
  }
}

/** Live-subscribes to a session's most recent messages, oldest-first (how a chat log actually
 * reads). Unsubscribe when the session isn't live/the screen unmounts — see components/LiveChat.tsx. */
export function subscribeToChatMessages(
  sessionId: string,
  onMessages: (messages: ChatMessage[]) => void
): Unsubscribe {
  const messagesQuery = query(
    collection(getFirestore(), "sessions", sessionId, "messages"),
    orderBy("timestamp", "desc"),
    fbLimit(MESSAGE_HISTORY_LIMIT)
  );
  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const messages: ChatMessage[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const ts = data.timestamp as { toMillis?: () => number } | undefined;
        return {
          id: docSnap.id,
          text: typeof data.text === "string" ? data.text : "",
          displayName: typeof data.displayName === "string" ? data.displayName : "Viewer",
          deviceId: typeof data.deviceId === "string" ? data.deviceId : "",
          timestamp: ts?.toMillis?.() ?? Date.now(),
          flagged: Boolean(data.flagged),
        };
      });
      // Query is newest-first only so `limit` caps at the most recent N — reverse for
      // oldest-first rendering.
      onMessages(messages.reverse());
    },
    () => onMessages([])
  );
}

export { MAX_MESSAGE_LENGTH };
