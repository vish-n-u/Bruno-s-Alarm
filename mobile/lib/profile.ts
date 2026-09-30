import AsyncStorage from "@react-native-async-storage/async-storage";

// The chat name — asked for on the one-time "Before you chat" screen (components/
// ChatTermsGate.tsx; older versions asked during onboarding). Stored on the phone, and sent
// along with each chat message (see lib/chat.ts) to be shown next to it. If none is saved, the
// server shows a generated "Viewer NNNN" name.
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
