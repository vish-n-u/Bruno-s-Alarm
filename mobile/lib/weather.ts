import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// A purely decorative "hint" of real weather for the Home screen's sky — not a forecast
// feature, so this deliberately skips asking for the device's precise location. Instead it
// resolves an approximate (city-level) location from the device's IP address, then asks
// Open-Meteo for the current conditions there. Both services are free and keyless, which
// matters here since this is a nice-to-have visual touch, not something worth managing API
// credentials for. If either call fails (no network, service down, etc.) callers just get
// `null` and render their normal, weather-less sky — this must never block or degrade the
// rest of the app.
export type WeatherCondition = "clear" | "cloudy" | "rain" | "storm" | "snow" | "fog";

const CACHE_KEY = "bruno-weather-cache";
// Weather doesn't change fast enough to justify asking more often than this, and it keeps
// well within both free services' generous rate limits even if the app is reopened a lot.
const CACHE_TTL_MS = 30 * 60 * 1000;

type CachedWeather = { condition: WeatherCondition; fetchedAt: number };

// WMO weather codes, as returned by Open-Meteo's `current=weather_code` field — collapsed
// down to the handful of visual buckets the sky actually distinguishes between.
function conditionFromWeatherCode(code: number): WeatherCondition {
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "clear";
}

async function fetchApproximateLocation(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // ipapi.co (tried first) 403s a meaningful share of real-device requests — it appears to
    // rate-limit/reject by shared IP or lack of a browser User-Agent, which a plain fetch()
    // from the app doesn't send. ipwho.is has the same no-key, https, "just give me a rough
    // location" shape and hasn't shown that problem.
    const res = await fetch("https://ipwho.is/");
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.latitude !== "number" || typeof data?.longitude !== "number") return null;
    return { latitude: data.latitude, longitude: data.longitude };
  } catch {
    return null;
  }
}

async function fetchWeatherCondition(): Promise<WeatherCondition | null> {
  const location = await fetchApproximateLocation();
  if (!location) return null;
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}` +
      `&longitude=${location.longitude}&current=weather_code`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const code = data?.current?.weather_code;
    if (typeof code !== "number") return null;
    return conditionFromWeatherCode(code);
  } catch {
    return null;
  }
}

/** Cached, network-fetching read of the current condition — resolves `null` on any failure
 * rather than throwing, since this is purely decorative and must never be treated as a
 * required app dependency. */
export async function getWeatherCondition(): Promise<WeatherCondition | null> {
  try {
    const cachedRaw = await AsyncStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      const cached: CachedWeather = JSON.parse(cachedRaw);
      if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.condition;
    }
  } catch {
    // Corrupt/missing cache — fall through to a fresh fetch.
  }

  const condition = await fetchWeatherCondition();
  if (condition) {
    const cached: CachedWeather = { condition, fetchedAt: Date.now() };
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cached)).catch(() => {});
  }
  return condition;
}

// Built and working, but held back for later — flip this to bring real weather back to the
// Home screen sky. Kept as a flag (rather than deleting the code) so re-enabling later is a
// one-line change, same convention as App.tsx's CHAT_ENABLED. The debug-only preview screen
// (screens/WeatherPreviewScreen.tsx) doesn't call this hook at all, so it keeps working for
// testing regardless of this flag — see docs/hidden-features.md.
const WEATHER_HINTS_ENABLED = false;

/** `null` while loading, if the lookup failed, or while the feature is held back via
 * WEATHER_HINTS_ENABLED above — callers should treat that the same as "clear" (i.e. render
 * their normal sky) rather than showing a loading state. */
export function useWeatherCondition(): WeatherCondition | null {
  const [condition, setCondition] = useState<WeatherCondition | null>(null);
  useEffect(() => {
    if (!WEATHER_HINTS_ENABLED) return;
    let cancelled = false;
    getWeatherCondition().then((result) => {
      if (!cancelled && result) setCondition(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return condition;
}
