# Hidden features

Features listed here are fully built and working, but intentionally not live in the shipped
app yet. Each one is gated behind a single boolean flag — flip it, rebuild, and it's back.
Check here before re-building something from scratch that already exists.

## "Bruno's Pack" — persistent chat tab

**No longer hidden — switched on 2 Oct 2026 (app v20).** See PROJECT_GUIDE.md §4.5. The server
keeps only the room's newest 200 messages. Shown/hidden for everyone by `packEnabled` in the
Firestore doc `config/app` (no app update needed).

## Weather hints on the Home screen sky

The Home screen's animated sky (already time-of-day aware) also reacting to real weather at
the viewer's approximate location — grey/darker clouds and a dimming wash for cloudy, falling
rain streaks for rain, denser rain plus a darker wash and an occasional lightning flash for
storm, drifting snowflakes for snow, a haze overlay for fog. Looked up via a free, keyless
IP-geolocation + Open-Meteo forecast call, cached for 30 minutes — no location permission, no
API key.

- **Flag:** `WEATHER_HINTS_ENABLED` in [`lib/weather.ts`](../lib/weather.ts) (currently
  `false`)
- **What's hidden:** `useWeatherCondition()` never fetches or reports a real condition while
  the flag is off, so `HomeScreen`'s sky always renders exactly as it did before this feature
  existed (plain white clouds, no precipitation)
- **What still works regardless of the flag:** Settings → Debug (tap "Version" 7×) →
  "preview weather & time" — a full-screen slider tool to preview every time-of-day/weather
  combination on demand. It feeds `components/Sky.tsx` directly with locally-chosen values
  and never calls `useWeatherCondition()`, so it's unaffected by this flag either way — useful
  for continuing to test/tune this feature while it's still hidden from real users.
- **To re-enable:** set `WEATHER_HINTS_ENABLED = true` in `lib/weather.ts`
