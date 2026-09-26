import { LayoutAnimation, Platform, UIManager } from "react-native";

// Required on Android under the old architecture for LayoutAnimation to do anything at all;
// harmless to call under the new architecture (Fabric animates layout changes natively either
// way), and the guard means this never throws on a version where the method doesn't exist.
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Call right before a state update that adds, removes, or resizes something in a list —
 * animates the reflow instead of letting cards snap/cut instantly. Cheap: it only affects the
 * very next layout pass, nothing ongoing. */
export function animateNextLayout(): void {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}
