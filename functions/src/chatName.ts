import { Filter } from "bad-words";

// Pulled out of index.ts specifically so it can be unit-tested without also booting Firebase
// Admin (index.ts calls initializeApp() at module scope, which needs real credentials/an
// emulator to run at all) — this file has no Firebase imports and no side effects on import.

const profanityFilter = new Filter();

export const MAX_NAME_LENGTH = 24; // matches the onboarding name field's own maxLength

// Names that would read as the dog or the app's own staff. Not a full impersonation defence —
// just stops the obvious ones. Anything that matches quietly falls back to "Viewer NNNN".
export const RESERVED_NAME = /\b(bruno|admin|administrator|moderator|mod|staff|official|support)\b/i;

/** The fallback name: deterministic, so the same anonymous uid always reads as the same
 * "Viewer NNNN" — used whenever the app doesn't send a name (older app versions, someone who
 * skipped the name step on an older build) or sends one that fails the checks below. */
export function displayNameForUid(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (Math.imul(hash, 31) + uid.charCodeAt(i)) >>> 0;
  }
  return `Viewer ${1000 + (hash % 9000)}`;
}

/** The name shown next to a message. The app sends the name typed during onboarding, but a
 * client-supplied value is untrusted — a modified app could send anything — so it's cleaned and
 * checked here, and any failure just uses the anonymous "Viewer NNNN" instead of rejecting the
 * message. */
export function chatNameFor(uid: string, raw: unknown): string {
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
