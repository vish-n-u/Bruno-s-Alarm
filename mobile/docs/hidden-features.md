# Hidden features

Features listed here are fully built and working, but intentionally not live in the shipped
app yet. Each one is gated behind a single boolean flag — flip it, rebuild, and it's back.
Check here before re-building something from scratch that already exists.

## "Bruno's Pack" — persistent chat tab

A third bottom-nav tab (`MessagesTab` → `screens/BrunosPackScreen.tsx`) — a real, working,
backend-wired chat room that's always open, distinct from the per-live-session chat below.
Not a UI mockup: sending, receiving, reporting, and blocking all work exactly like the live
chat, because it reuses the same `lib/chat.ts` functions, the same callable Cloud Function,
and the same Firestore security rules — the only difference is it's passed a fixed session ID
(`BRUNOS_PACK_SESSION_ID = "brunos-pack"` in `lib/chat.ts`) instead of one derived from the
real clock, so the "room" never resets.

- **Flag:** `CHAT_ENABLED` in [`App.tsx`](../App.tsx) (currently `false`)
- **What's hidden:** the tab itself. The backend has no flag of its own and is already live —
  turning `CHAT_ENABLED` on requires no backend work.
- **One backend change this needed:** the Cloud Function's per-session 500-message cap
  (`functions/src/index.ts`) assumed a session eventually resets, which a persistent room
  never does — it would have permanently "filled up" once and stayed that way forever. Fixed
  by exempting `"brunos-pack"` specifically (`UNCAPPED_SESSION_IDS`) from that cap; rate
  limiting (~1 msg/3s/device) still applies normally. **Already deployed** — this fix is live
  regardless of the `CHAT_ENABLED` flag.
- **Before this goes live for real users:** reconsider retention/moderation for a room with
  no natural reset point — the per-session chat's 500-cap and short lifetime meant a bad actor
  or a moderation backlog was naturally bounded; a persistent room isn't. Worth a real look at
  message history limits or a cleanup job before flipping this on for the public, not just
  before/during your own testing.
- **Important:** this flag does **not** control the per-session live chat overlay —
  `components/LiveChat.tsx` is unconditionally rendered on the Live screen and is live for
  real users right now, regardless of this flag. The two are separate chat rooms sharing the
  same backend, not the same feature.
- **To re-enable:** set `CHAT_ENABLED = true` in `App.tsx`
- **Verified working:** confirmed on-device with `CHAT_ENABLED` temporarily flipped on —
  the tab renders, a message sent via direct API call to the deployed function showed up
  in the app in real time, and a message sent from the app round-tripped through Firestore
  correctly (checked via direct Firestore REST read). Flag was set back to `false` afterward.

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
