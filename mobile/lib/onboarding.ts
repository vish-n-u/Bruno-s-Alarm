import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "bruno-onboarded";

export async function hasOnboarded(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === "true";
}

export async function markOnboarded(): Promise<void> {
  await AsyncStorage.setItem(KEY, "true");
}

// Onboarding's last button is "Set my first alarm": it asks Home to open the new-alarm sheet
// once Home appears. In memory only — it's meant for right now, not a later app launch.
let newAlarmRequested = false;

export function requestNewAlarmOnHome(): void {
  newAlarmRequested = true;
}

/** True once, if onboarding asked for the new-alarm sheet — and clears the request. */
export function consumeNewAlarmRequest(): boolean {
  const requested = newAlarmRequested;
  newAlarmRequested = false;
  return requested;
}
