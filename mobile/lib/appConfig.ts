import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getFirestore, onSnapshot } from "@react-native-firebase/firestore";
import { useEffect, useState } from "react";

// Switches the owner can flip for everyone, without an app update: the Firestore document
// config/app, edited in the Firebase console (Firestore Database → config → app). Public-read,
// no client writes (firestore.rules). The app listens to it, so a change shows up within
// seconds on any open app, and remembers the last value it saw for the next launch.
//
// Fields:
//   packEnabled (boolean)   — shows the "Bruno's Pack" chat tab. Missing/false = hidden. The chat
//                             server also refuses Pack messages while it's false
//                             (functions/src/index.ts), so older app versions can't post either.
//   developerIds (string[]) — chat ids (anonymous Firebase uids) that get the "DEV" badge in chat.
//                             Each phone's id is shown in Settings' hidden debug section. Safe to
//                             trust: a message's deviceId is stamped by the server, never the app.

const CACHE_KEY = "bruno-app-config";

export type AppConfig = { packEnabled: boolean; developerIds: string[] };

// Hidden until the server says otherwise — a phone that has never reached it (first launch,
// offline) shouldn't show a chat that might be switched off.
const DEFAULTS: AppConfig = { packEnabled: false, developerIds: [] };

function parse(data: Record<string, unknown> | undefined): AppConfig {
  const ids = data?.developerIds;
  return {
    packEnabled: data?.packEnabled === true,
    developerIds: Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [],
  };
}

// One shared listener for every screen using the config (App, both chats).
let current: AppConfig = DEFAULTS;
let started = false;
let fromServer = false;
const subscribers = new Set<(config: AppConfig) => void>();

function publish(next: AppConfig): void {
  current = next;
  subscribers.forEach((cb) => cb(next));
}

function start(): void {
  if (started) return;
  started = true;
  AsyncStorage.getItem(CACHE_KEY)
    .then((raw) => {
      if (raw && !fromServer) publish({ ...DEFAULTS, ...JSON.parse(raw) });
    })
    .catch(() => {});

  onSnapshot(
    doc(getFirestore(), "config", "app"),
    (snapshot) => {
      // Firestore's offline cache can answer first with no data; only trust a real answer (or a
      // cached one that says the doc exists).
      if (snapshot.metadata.fromCache && !snapshot.exists()) return;
      fromServer = true;
      const next = parse(snapshot.data());
      publish(next);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next)).catch(() => {});
    },
    () => {
      // Unreachable or denied — keep whatever we have.
    },
  );
}

export function useAppConfig(): AppConfig {
  const [config, setConfig] = useState<AppConfig>(current);
  useEffect(() => {
    start();
    setConfig(current);
    subscribers.add(setConfig);
    return () => {
      subscribers.delete(setConfig);
    };
  }, []);
  return config;
}
