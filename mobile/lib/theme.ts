import { useColorScheme } from "react-native";

// Third pass. The first two attempts (cream/terracotta/serif, then forest-green/brass)
// fixed hue and typography but kept the same generic shape: rounded cards, soft neutral
// background, one polite accent color — the actual tell wasn't the palette, it was that
// shape itself. This pass borrows a real physical object instead: a paper notice pinned
// up by someone who loves this dog — aged paper, ink-black structural lines, a single
// stamp-red accent used the way a rubber stamp actually gets used (sparingly, for status),
// and sharp/near-flat corners instead of soft rounded ones. Real light/dark palettes stay,
// resolved via the device's system setting — "dark" reads as the same board seen at night
// under a lamp, not a palette inversion.
const darkColors = {
  background: "#1c160e",
  surface: "#241d13",
  surfaceAlt: "#2d2416",
  border: "#4a3d26",
  textPrimary: "#ece2c8",
  textSecondary: "#a89a72",
  accent: "#e2624a",
  accentBorder: "#9c3f2c",
  accentText: "#1c160e",
  live: "#e2624a",
  liveBg: "rgba(226,98,74,0.16)",
  danger: "#c1453a",
  dangerBg: "rgba(193,69,58,0.14)",
};

const lightColors = {
  background: "#efe4cc",
  surface: "#f7f0dc",
  surfaceAlt: "#e6d9b8",
  border: "#241f16",
  textPrimary: "#241f16",
  textSecondary: "#6b6350",
  accent: "#a83a2f",
  accentBorder: "#7a281f",
  accentText: "#f7f0dc",
  live: "#a83a2f",
  liveBg: "rgba(168,58,47,0.12)",
  danger: "#7a281f",
  dangerBg: "rgba(122,40,31,0.10)",
};

export type ThemeColors = typeof darkColors;

/** Resolves the palette for the device's current system light/dark setting. */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "light" ? lightColors : darkColors;
}

// Anton for the big flyer-style headline, Courier Prime everywhere else — a typewriter
// doing double duty as both body copy and the schedule's numerals (the "departure board"
// motif now reads as a typed ticket stub rather than a digital clock). Caveat is a small
// handwritten accent reserved for the one or two lines that should read like a note
// someone actually wrote, not printed copy. Loaded via useFonts in App.tsx.
export const fonts = {
  display: "Anton_400Regular",
  displaySemiBold: "Anton_400Regular",
  body: "CourierPrime_400Regular",
  bodyMedium: "CourierPrime_700Bold",
  bodyBold: "CourierPrime_700Bold",
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

// Sharp, near-flat corners — a stamped ticket or a taped-up flyer doesn't have soft
// rounded-card edges. Small values rather than a literal 0 so overflow-clipped images
// (the hero photo, video frame) don't look like a rendering bug.
export const radius = {
  sm: 2,
  md: 3,
  lg: 4,
  pill: 3,
};
