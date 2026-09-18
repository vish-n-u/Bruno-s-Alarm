import { getAuth, onAuthStateChanged, signInAnonymously, type User } from "@react-native-firebase/auth";

// Anonymous auth gives live chat a stable per-device identity (the uid) without any sign-up
// flow — same Firebase project already wired in for Analytics/Crashlytics (see
// google-services.json), just a different module. The uid persists locally across app
// restarts via the native SDK's own session storage, so it's stable per device, not per
// launch.

const auth = getAuth();

let readyPromise: Promise<User> | null = null;

/** Resolves once a real (possibly newly-created) anonymous user exists, returning it. Safe to
 * call from multiple places — the underlying sign-in only ever happens once per cold start. */
export function ensureAnonymousAuth(): Promise<User> {
  if (readyPromise) return readyPromise;
  readyPromise = new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubscribe();
        resolve(user);
      }
    });
    if (!auth.currentUser) {
      signInAnonymously(auth).catch((err) => {
        unsubscribe();
        readyPromise = null; // let a later call retry instead of staying rejected forever
        reject(err);
      });
    }
  });
  return readyPromise;
}

/** The current anonymous uid, if sign-in has already completed — undefined otherwise. Chat UI
 * should prefer awaiting ensureAnonymousAuth() over polling this. */
export function getCurrentUid(): string | undefined {
  return auth.currentUser?.uid;
}
