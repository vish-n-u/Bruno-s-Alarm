import * as Haptics from "expo-haptics";

// Thin, named wrappers around expo-haptics so call sites read by intent ("a light tap",
// "something turned on", "something's about to be undone") rather than by raw feedback-type
// enum — one place to retune the app's overall feel later, instead of scattered enum values.
// Every call swallows its own rejection: haptics are a nicety, never worth crashing or logging
// over if the OS declines it (no vibration motor, haptics disabled system-wide, etc.).

/** A light, everyday tap — flipping a switch, selecting a chip/day, a minor confirmation. */
export function tapLight(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** A firmer tap for a deliberate primary action — Done/Save, confirming a sheet. */
export function tapMedium(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** The single "click" used while spinning a wheel picker — once per row crossed. */
export function tick(): void {
  Haptics.selectionAsync().catch(() => {});
}

/** A clearly positive outcome. */
export function success(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** A destructive or cautionary action — deleting something, turning off something important. */
export function warning(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
