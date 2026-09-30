import { Alert } from "react-native";
import type { Ionicons } from "@expo/vector-icons";

// The app's own "we need a setting" dialog, styled like the rest of the app instead of the grey
// system Alert. lib/alarmPermissions.ts calls askPermission() from plain async code; the single
// <PermissionPromptHost /> mounted in App.tsx renders it.

export type PermissionPrompt = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  /** "1 of 2" when several settings are asked for in a row. */
  progress?: string;
  confirmLabel: string;
  cancelLabel: string;
};

export type PendingPrompt = PermissionPrompt & { resolve: (confirmed: boolean) => void };

let show: ((prompt: PendingPrompt) => void) | null = null;

export function registerPermissionPromptHost(fn: (prompt: PendingPrompt) => void): () => void {
  show = fn;
  return () => {
    if (show === fn) show = null;
  };
}

/** Resolves true if the person tapped the confirm button. */
export function askPermission(prompt: PermissionPrompt): Promise<boolean> {
  return new Promise((resolve) => {
    if (show) {
      show({ ...prompt, resolve });
      return;
    }
    // Host not mounted (shouldn't happen) — fall back to the system dialog.
    Alert.alert(
      prompt.title,
      prompt.body,
      [
        { text: prompt.cancelLabel, style: "cancel", onPress: () => resolve(false) },
        { text: prompt.confirmLabel, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
