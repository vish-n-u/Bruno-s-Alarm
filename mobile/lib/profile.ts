import AsyncStorage from "@react-native-async-storage/async-storage";

// Collected during onboarding for a future chat feature that doesn't exist yet — stored
// locally only, never sent anywhere. Kept separate from lib/onboarding.ts's "have they seen
// onboarding" flag since it's a different concern.
const KEY = "bruno-display-name";

export async function getDisplayName(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function setDisplayName(name: string): Promise<void> {
  await AsyncStorage.setItem(KEY, name);
}

export function generateGuestName(): string {
  return `Guest${Math.floor(1000 + Math.random() * 9000)}`;
}
