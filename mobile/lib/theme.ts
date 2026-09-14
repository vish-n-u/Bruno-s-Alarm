import { useColorScheme } from "react-native";

// Seventh pass — a genuine clear-sky blue instead of the golden-hour warm tones, so the
// storybook sun/cloud/leaf decoration on Home actually sits in a believable sky instead of
// looking pasted onto a tan background. The warm amber accent stays (blue sky + orange sun
// is a real, harmonious complementary pairing, not an arbitrary leftover) — it's the
// backdrop that changes, not every color. Dark mode reads as the same sky at night. Danger
// stays warm red/rust regardless of scheme — universal "destructive" signal, not part of
// the palette identity.
const darkColors = {
  background: "#0f1c2e",
  surface: "#16283f",
  surfaceAlt: "#1e3450",
  border: "#3a5578",
  textPrimary: "#dce9f5",
  textSecondary: "#8ba3bd",
  accent: "#f5b942",
  accentBorder: "#c99427",
  accentText: "#0f1c2e",
  live: "#f2703a",
  liveBg: "rgba(242,112,58,0.18)",
  danger: "#d9695c",
  dangerBg: "rgba(217,105,92,0.14)",
};

const lightColors = {
  background: "#bfe3f7",
  surface: "#eef8fd",
  surfaceAlt: "#d3ecf8",
  border: "#16324a",
  textPrimary: "#16324a",
  textSecondary: "#4f7290",
  // Deeper than a first pass at this hue — the lighter version had borderline contrast as
  // standalone text/border on the near-white cards (the "subscribed" state, countdown
  // digits), not just as a button fill where accentText carries the contrast instead.
  accent: "#d1830e",
  accentBorder: "#a8680a",
  accentText: "#fefcf5",
  live: "#e8562f",
  liveBg: "rgba(232,86,47,0.14)",
  danger: "#a83a2f",
  dangerBg: "rgba(168,58,47,0.10)",
};

export type ThemeColors = typeof darkColors;

/** Resolves the palette for the device's current system light/dark setting. */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "light" ? lightColors : darkColors;
}

/** A soft, deliberate lift for primary surfaces (the schedule board, alarm cards, the main
 * CTA) — the previous passes relied on a 1px border alone to separate a card from the
 * background, which reads as flat/static rather than physically sitting above the page.
 * Spread this directly into a component's own StyleSheet entry alongside its other layout
 * properties. Black at low opacity works in both themes — it's about depth, not hue. */
export const shadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.16,
  shadowRadius: 8,
  elevation: 4,
};

// Anton still carries the big flyer-style headline — it was never the flat part. Bricolage
// Grotesque takes over body copy, buttons, and labels: a warmer, more expressive grotesque
// than a typewriter font asked to do prose duty. Courier Prime narrows to its one genuinely
// right job — actual numerals (the departure-board times, snooze minutes) — instead of
// carrying every sentence in the app. Caveat stays the one handwritten accent line.
export const fonts = {
  display: "Anton_400Regular",
  displaySemiBold: "Anton_400Regular",
  body: "BricolageGrotesque_400Regular",
  bodyMedium: "BricolageGrotesque_600SemiBold",
  bodyBold: "BricolageGrotesque_700Bold",
  mono: "CourierPrime_400Regular",
  monoBold: "CourierPrime_700Bold",
  hand: "Caveat_600SemiBold",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

// Softer, more contemporary corners than the previous near-flat 2-4px — a deliberate,
// friendly roundness instead of sharp institutional edges, while pill stays a true pill for
// chips/badges rather than a barely-rounded rectangle.
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
};
