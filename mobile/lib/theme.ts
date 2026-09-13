import { useColorScheme } from "react-native";

// Second pass. The first attempt (warm cream/near-black + serif display + terracotta
// accent) turned out to be one of the specifically overused AI-default looks — swapping
// palette/font without changing structure wasn't enough. This pass changes both: a
// genuinely different color direction (deep forest green + brass, pulled from the
// greenery and the worn metal of Bruno's collar in his actual photos, not a "safe" gold
// or terracotta), a mono face for schedule/numerals (a "departure board" feel — fitting
// for an app whose whole premise is a reliable twice-daily schedule) instead of a
// characterful serif, and — per request — real light and dark palettes, resolved via the
// device's system setting.
const darkColors = {
  background: "#0f1a14",
  surface: "#182821",
  surfaceAlt: "#1e3128",
  border: "#2e4438",
  textPrimary: "#eee6d3",
  textSecondary: "#94a89a",
  accent: "#c9982f",
  accentBorder: "#7a5c1c",
  accentText: "#1c1408",
  live: "#e2703a",
  liveBg: "rgba(226,112,58,0.18)",
  danger: "#c1453a",
  dangerBg: "rgba(193,69,58,0.16)",
};

const lightColors = {
  background: "#f3efe2",
  surface: "#e9e2cf",
  surfaceAlt: "#e0d7c0",
  border: "#cfc3a3",
  textPrimary: "#241f14",
  textSecondary: "#6b6350",
  accent: "#a9711f",
  accentBorder: "#7a5416",
  accentText: "#fff8ea",
  live: "#c85a2c",
  liveBg: "rgba(200,90,44,0.14)",
  danger: "#a83a2f",
  dangerBg: "rgba(168,58,47,0.12)",
};

export type ThemeColors = typeof darkColors;

/** Resolves the palette for the device's current system light/dark setting. */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "light" ? lightColors : darkColors;
}

// Bricolage Grotesque (a distinctive, slightly playful geometric grotesque — not the
// overused Inter/Space Grotesk pairing) for headings/UI text. Space Mono specifically for
// schedule times/numerals — the "departure board" motif. Loaded via useFonts in App.tsx.
export const fonts = {
  display: "BricolageGrotesque_700Bold",
  displaySemiBold: "BricolageGrotesque_600SemiBold",
  body: "BricolageGrotesque_400Regular",
  bodyMedium: "BricolageGrotesque_500Medium",
  bodyBold: "BricolageGrotesque_700Bold",
  mono: "SpaceMono_400Regular",
  monoBold: "SpaceMono_700Bold",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  pill: 999,
};
