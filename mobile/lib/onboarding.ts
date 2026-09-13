import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "bruno-onboarded";

export async function hasOnboarded(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === "true";
}

export async function markOnboarded(): Promise<void> {
  await AsyncStorage.setItem(KEY, "true");
}
