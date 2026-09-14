import { useColorScheme } from "react-native";

// Fifth pass — same "Notice Board" shape (paper pinned up, ink-black structural lines,
// sharp/near-flat corners, one accent used sparingly like a rubber stamp) as every prior
// pass, recolored again: this time toward dawn/dusk sky rather than a generic "blue theme"
// pick — Bruno's two real sessions ARE 6AM and 6PM, so the palette is literally the sky at
// the moments this app is about. Light mode reads as a pale dawn-sky notice board; dark
// mode as the same board under a dusk/night sky. Danger stays warm red/rust regardless of
// scheme — universal "destructive" signal, not part of the palette identity.
const darkColors = {
  background: "#121a2a",
  surface: "#1a2438",
  surfaceAlt: "#222f47",
  border: "#3d4f6b",
  textPrimary: "#dde6f2",
  textSecondary: "#8a9bb5",
  accent: "#6fa8dc",
  accentBorder: "#4a7fb0",
  accentText: "#121a2a",
  live: "#6fa8dc",
  liveBg: "rgba(111,168,220,0.16)",
  danger: "#d9695c",
  dangerBg: "rgba(217,105,92,0.14)",
};

const lightColors = {
  background: "#dce6ee",
  surface: "#eaf1f6",
  surfaceAlt: "#cddce8",
  border: "#1f2d3d",
  textPrimary: "#1f2d3d",
  textSecondary: "#5c6d7f",
  accent: "#2e5f8a",
  accentBorder: "#1f4570",
  accentText: "#eaf1f6",
  live: "#2e5f8a",
  liveBg: "rgba(46,95,138,0.12)",
  danger: "#a83a2f",
  dangerBg: "rgba(168,58,47,0.10)",
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
