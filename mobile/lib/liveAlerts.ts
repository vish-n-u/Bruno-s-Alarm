import { getMessaging, subscribeToTopic, unsubscribeFromTopic } from "@react-native-firebase/messaging";
import { Platform } from "react-native";

// "Bruno just went live" pushes. The backend (functions/src/index.ts's cloudflareLiveWebhook)
// sends to this FCM topic when Cloudflare reports the stream connected — joining the topic is
// all a device does, so no push tokens are stored anywhere. Tied to the same on/off as the
// scheduled alarms ("Wake me up with Bruno"): on = alarms plus a heads-up if he actually goes
// live. Android only for now — iOS would need APNs set up on the Firebase project first.
const LIVE_ALERT_TOPIC = "live";

export async function joinLiveAlerts(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await subscribeToTopic(getMessaging(), LIVE_ALERT_TOPIC);
  } catch (err) {
    console.warn("Couldn't join live alerts", err);
  }
}

export async function leaveLiveAlerts(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await unsubscribeFromTopic(getMessaging(), LIVE_ALERT_TOPIC);
  } catch (err) {
    console.warn("Couldn't leave live alerts", err);
  }
}
