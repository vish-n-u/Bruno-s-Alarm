import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMessaging, subscribeToTopic, unsubscribeFromTopic } from "@react-native-firebase/messaging";
import { Platform } from "react-native";

// The optional "Live alarm": a real alarm that rings the moment Bruno actually goes live. It is
// deliberately its own opt-in, separate from "Wake me up with Bruno" (the scheduled 6AM/6PM
// alarms, which the phone itself holds and are the reliable path). The backend
// (functions/src/index.ts's cloudflareLiveWebhook) pushes to this FCM topic when Cloudflare
// reports the stream connected; joining the topic is all a device does, so no push tokens are
// stored anywhere. Android only for now — iOS would need APNs set up on the Firebase project.
const LIVE_ALERT_TOPIC = "live";
const ENABLED_KEY = "bruno-live-alarm-enabled";

export async function isLiveAlarmEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) === "1";
  } catch {
    return false;
  }
}

async function joinTopic(): Promise<void> {
  try {
    await subscribeToTopic(getMessaging(), LIVE_ALERT_TOPIC);
  } catch (err) {
    console.warn("Couldn't join live alerts", err);
  }
}

async function leaveTopic(): Promise<void> {
  try {
    await unsubscribeFromTopic(getMessaging(), LIVE_ALERT_TOPIC);
  } catch (err) {
    console.warn("Couldn't leave live alerts", err);
  }
}

export async function enableLiveAlarm(): Promise<void> {
  if (Platform.OS !== "android") return;
  await AsyncStorage.setItem(ENABLED_KEY, "1");
  await joinTopic();
}

export async function disableLiveAlarm(): Promise<void> {
  if (Platform.OS !== "android") return;
  await AsyncStorage.removeItem(ENABLED_KEY);
  await leaveTopic();
}

/** Run on every launch: re-asserts the topic membership if the user opted in, and removes it
 * otherwise — that second half also cleans up anyone who joined under the earlier version, which
 * tied live alerts to the 6AM/6PM toggle. */
export async function syncLiveAlarmOnLaunch(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (await isLiveAlarmEnabled()) await joinTopic();
  else await leaveTopic();
}
