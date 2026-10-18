import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

// The user's own choice to hide the "Bruno's Pack" chat tab on this phone (Settings → Chat).
// Separate from config/app.packEnabled (lib/appConfig.ts), which is the owner's switch for
// everyone: the tab shows only when the owner has it on AND this user hasn't hidden it.
// Stored on the phone only; shown by default.

const KEY = "bruno-pack-tab-hidden";

let hidden = false;
let loaded = false;
const subscribers = new Set<(value: boolean) => void>();

function publish(value: boolean): void {
  hidden = value;
  subscribers.forEach((cb) => cb(value));
}

function load(): void {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => publish(raw === "1"))
    .catch(() => {});
}

export function setPackTabHidden(value: boolean): void {
  publish(value);
  AsyncStorage.setItem(KEY, value ? "1" : "0").catch(() => {});
}

/** Whether this user has hidden the Pack tab; every caller updates together (App's tab bar and
 * the Settings switch). */
export function usePackTabHidden(): boolean {
  const [value, setValue] = useState(hidden);
  useEffect(() => {
    load();
    subscribers.add(setValue);
    setValue(hidden);
    return () => {
      subscribers.delete(setValue);
    };
  }, []);
  return value;
}
