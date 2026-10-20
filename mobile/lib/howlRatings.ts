import { doc, getDoc, getFirestore, onSnapshot, type Unsubscribe } from "@react-native-firebase/firestore";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { ensureAnonymousAuth } from "./firebase";

// "Rate this howl" (1–5 paws) on the Live tab's "Watch his last howl". Ratings are keyed by the
// howl's Cloudflare video uid. Writes go only through the `rateHowl` Cloud Function (one per
// phone per howl; re-rating replaces it). The summary doc howlRatings/{uid} = { count, sum } is
// public, so everyone sees the same average; each phone can read back only its own vote.

export type HowlRatingSummary = { count: number; average: number | null };

export function subscribeHowlRating(videoUid: string, onChange: (summary: HowlRatingSummary) => void): Unsubscribe {
  return onSnapshot(
    doc(getFirestore(), "howlRatings", videoUid),
    (snap) => {
      const count = Number(snap?.get("count")) || 0;
      const sum = Number(snap?.get("sum")) || 0;
      onChange({ count, average: count > 0 ? sum / count : null });
    },
    () => onChange({ count: 0, average: null }),
  );
}

/** This phone's earlier rating of the howl (1–5), or null. */
export async function getMyHowlRating(videoUid: string): Promise<number | null> {
  try {
    const user = await ensureAnonymousAuth();
    const snap = await getDoc(doc(getFirestore(), "howlRatings", videoUid, "votes", user.uid));
    const paws = Number(snap.get("paws"));
    return paws >= 1 && paws <= 5 ? paws : null;
  } catch {
    return null;
  }
}

export async function rateHowl(videoUid: string, paws: number): Promise<boolean> {
  try {
    await ensureAnonymousAuth();
    await httpsCallable<{ videoUid: string; paws: number }, { ok: true }>(getFunctions(), "rateHowl")({ videoUid, paws });
    return true;
  } catch {
    return false;
  }
}
