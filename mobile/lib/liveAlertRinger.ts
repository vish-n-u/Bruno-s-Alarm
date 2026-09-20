import { getMessaging, onMessage, setBackgroundMessageHandler } from "@react-native-firebase/messaging";
import { ringForLiveStart } from "./notifications";

// The backend's go-live push is a data-only message ({ type: "live" }) — no visible
// notification of its own, so this is what turns it into a real ringing alarm. Background/quit
// delivery runs through setBackgroundMessageHandler (must be registered at app entry, before
// any component mounts — see index.ts); foreground delivery through onMessage.
function isLiveMessage(message: { data?: Record<string, string | object> }): boolean {
  return message.data?.type === "live";
}

export function registerLiveAlertBackgroundHandler(): void {
  setBackgroundMessageHandler(getMessaging(), async (message) => {
    if (isLiveMessage(message)) await ringForLiveStart().catch(() => {});
  });
}

/** Foreground counterpart — returns the unsubscribe function. */
export function listenForLiveAlertsInForeground(): () => void {
  return onMessage(getMessaging(), async (message) => {
    if (isLiveMessage(message)) await ringForLiveStart().catch(() => {});
  });
}
