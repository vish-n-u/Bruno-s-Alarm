import { Alert } from "react-native";
import type { Ionicons } from "@expo/vector-icons";
import type { PermissionIllustrationKind } from "../components/PermissionIllustration";

// The app's own pop-up dialog, styled like the rest of the app instead of the grey system Alert.
// Call showDialog()/askPermission() from anywhere (plain async code included); the single
// <AppDialogHost /> mounted in App.tsx renders it. Debug-only tools still use Alert directly.

export type DialogButton = {
  label: string;
  /** primary = filled accent, destructive = filled red, cancel = plain text at the bottom,
   * default = outlined. */
  style?: "primary" | "destructive" | "cancel" | "default";
  onPress?: () => void;
};

export type AppDialog = {
  /** A looping picture at the top (components/PermissionIllustration.tsx)… */
  illustration?: PermissionIllustrationKind;
  /** …or just an icon. */
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  /** "1 of 2" when several dialogs are shown in a row. */
  progress?: string;
  buttons: DialogButton[];
};

export type PendingDialog = AppDialog & { resolve: (buttonIndex: number | null) => void };

let show: ((dialog: PendingDialog) => void) | null = null;

export function registerDialogHost(fn: (dialog: PendingDialog) => void): () => void {
  show = fn;
  return () => {
    if (show === fn) show = null;
  };
}

/** Resolves with the index of the button tapped, or null if dismissed (back / tap outside). The
 * tapped button's onPress also runs. */
export function showDialog(dialog: AppDialog): Promise<number | null> {
  return new Promise((resolve) => {
    const done = (index: number | null) => {
      if (index !== null) dialog.buttons[index]?.onPress?.();
      resolve(index);
    };
    if (show) {
      show({ ...dialog, resolve: done });
      return;
    }
    // Host not mounted (shouldn't happen) — fall back to the system dialog.
    Alert.alert(
      dialog.title,
      dialog.body,
      dialog.buttons.map((b, i) => ({
        text: b.label,
        style: b.style === "cancel" ? "cancel" : b.style === "destructive" ? "destructive" : "default",
        onPress: () => done(i),
      })),
      { cancelable: true, onDismiss: () => done(null) },
    );
  });
}

export type PermissionPrompt = {
  illustration: PermissionIllustrationKind;
  title: string;
  body: string;
  progress?: string;
  confirmLabel: string;
  cancelLabel: string;
};

/** A permission ask: resolves true if the person tapped the confirm button. */
export async function askPermission(prompt: PermissionPrompt): Promise<boolean> {
  const { confirmLabel, cancelLabel, ...rest } = prompt;
  const index = await showDialog({
    ...rest,
    buttons: [
      { label: confirmLabel, style: "primary" },
      { label: cancelLabel, style: "cancel" },
    ],
  });
  return index === 0;
}
