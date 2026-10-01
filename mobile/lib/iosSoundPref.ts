import AsyncStorage from "@react-native-async-storage/async-storage";

// iPhone only. Whether alarms use Bruno's latest downloaded howl (converted into Library/Sounds)
// or the built-in one. Off by default until the first iPhone build proves iOS actually plays
// sounds from Library/Sounds when the app is closed — developers report it falls back to the
// default sound instead (PROJECT_GUIDE.md §11). Toggled from the hidden debug section for that
// test. Its own file because both lib/alarmSound.ts and lib/iosAlarms.ts read it.
const KEY = "bruno-ios-use-downloaded-sound";

export async function getIOSUseDownloadedSound(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setIOSUseDownloadedSound(on: boolean): Promise<void> {
  if (on) await AsyncStorage.setItem(KEY, "1");
  else await AsyncStorage.removeItem(KEY);
}
