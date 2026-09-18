import { useEffect, useState } from "react";

// Eighth pass — the palette now follows the real clock instead of the device's system
// light/dark setting: four sky states (dawn, midday, sunset, night) so the app actually
// feels like a different time of day as the day goes on, matching the real dog/real bell
// premise instead of a generic app-wide dark-mode toggle. Danger stays warm red/rust and
// "live" stays the same warm orange in every phase — universal status signals, not part of
// the sky's own identity, so they don't compete with whichever phase is active.
const morningColors = {
  background: "#dcebf4",
  surface: "#f5fafd",
  surfaceAlt: "#e7f1f7",
  border: "#2f4f61",
  textPrimary: "#1d3542",
  textSecondary: "#597486",
  accent: "#e8a33e",
  accentBorder: "#bd7f21",
  accentText: "#fffaf0",
  accentBg: "rgba(232,163,62,0.16)",
  live: "#e8562f",
  liveBg: "rgba(232,86,47,0.14)",
  danger: "#a83a2f",
  dangerBg: "rgba(168,58,47,0.10)",
};

const afternoonColors = {
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
  accentBg: "rgba(209,131,14,0.16)",
  live: "#e8562f",
  liveBg: "rgba(232,86,47,0.14)",
  danger: "#a83a2f",
  dangerBg: "rgba(168,58,47,0.10)",
};

const eveningColors = {
  background: "#f2c194",
  surface: "#fdf1e3",
  surfaceAlt: "#f8e0c2",
  border: "#5b3820",
  textPrimary: "#3c2313",
  textSecondary: "#7d5735",
  accent: "#d1483a",
  accentBorder: "#a8362b",
  accentText: "#fff6ee",
  accentBg: "rgba(209,72,58,0.14)",
  live: "#e8562f",
  liveBg: "rgba(232,86,47,0.14)",
  danger: "#a83a2f",
  dangerBg: "rgba(168,58,47,0.10)",
};

const nightColors = {
  background: "#0f1c2e",
  surface: "#16283f",
  surfaceAlt: "#1e3450",
  border: "#3a5578",
  textPrimary: "#dce9f5",
  textSecondary: "#8ba3bd",
  accent: "#f5b942",
  accentBorder: "#c99427",
  accentText: "#0f1c2e",
  accentBg: "rgba(245,185,66,0.18)",
  live: "#f2703a",
  liveBg: "rgba(242,112,58,0.18)",
  danger: "#d9695c",
  dangerBg: "rgba(217,105,92,0.14)",
};

export type ThemeColors = typeof afternoonColors;
export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

const palettesByTimeOfDay: Record<TimeOfDay, ThemeColors> = {
  morning: morningColors,
  afternoon: afternoonColors,
  evening: eveningColors,
  night: nightColors,
};

// Boundaries chosen so "night" starts right around 6:30pm as asked for, with a short sunset
// window beforehand rather than snapping straight from bright midday to full dark.
const PHASE_BOUNDS: Record<Exclude<TimeOfDay, "night">, [number, number]> = {
  morning: [5, 11],
  afternoon: [11, 17],
  evening: [17, 18.5],
};

/** Pure function of a clock time, no device/system state involved. */
export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours() + date.getMinutes() / 60;
  if (hour >= PHASE_BOUNDS.morning[0] && hour < PHASE_BOUNDS.morning[1]) return "morning";
  if (hour >= PHASE_BOUNDS.afternoon[0] && hour < PHASE_BOUNDS.afternoon[1]) return "afternoon";
  if (hour >= PHASE_BOUNDS.evening[0] && hour < PHASE_BOUNDS.evening[1]) return "evening";
  return "night";
}

/** A ticking clock, re-rendering whatever calls it once a minute — shared basis for both
 * the theme phase and the Home screen's sun/moon position, so they never drift out of sync
 * with each other. */
export function useNow(intervalMs: number = 60000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useTimeOfDay(): TimeOfDay {
  const now = useNow();
  return getTimeOfDay(now);
}

/** Resolves the palette for the real current time of day. */
export function useThemeColors(): ThemeColors {
  const timeOfDay = useTimeOfDay();
  return palettesByTimeOfDay[timeOfDay];
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
