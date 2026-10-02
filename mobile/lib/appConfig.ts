import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getFirestore, onSnapshot } from "@react-native-firebase/firestore";
import { useEffect, useState } from "react";

// Switches the owner can flip for everyone, without an app update: the Firestore document
// config/app, edited in the Firebase console (Firestore Database → config → app). Public-read,
// no client writes (firestore.rules). The app listens to it, so a change shows up within
// seconds on any open app, and remembers the last value it saw for the next launch.
//
// Fields:
//   packEnabled (boolean) — shows the "Bruno's Pack" chat tab. Missing/false = hidden. The chat
//                           server also refuses Pack messages while it's false
//                           (functions/src/index.ts), so older app versions can't post either.

const CACHE_KEY = "bruno-app-config";

type AppConfig = { packEnabled: boolean };

// Hidden until the server says otherwise — a phone that has never reached it (first launch,
// offline) shouldn't show a chat that might be switched off.
const DEFAULTS: AppConfig = { packEnabled: false };

function parse(data: Record<string, unknown> | undefined): AppConfig {
  return { packEnabled: data?.packEnabled === true };
}

export function useAppConfig(): AppConfig {
  const [config, setConfig] = useState<AppConfig>(DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    let fromServer = false;
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        if (raw && !cancelled && !fromServer) setConfig({ ...DEFAULTS, ...JSON.parse(raw) });
      })
      .catch(() => {});

    const unsubscribe = onSnapshot(
      doc(getFirestore(), "config", "app"),
      (snapshot) => {
        // Firestore's offline cache can answer first with stale or no data; only trust a real
        // server answer (or a cached one that says the doc exists).
        if (snapshot.metadata.fromCache && !snapshot.exists()) return;
        fromServer = true;
        const next = parse(snapshot.data());
        setConfig(next);
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next)).catch(() => {});
      },
      () => {
        // Unreachable or denied — keep whatever we have.
      },
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return config;
}
