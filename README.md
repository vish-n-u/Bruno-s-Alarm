# Bruno's Alarm — website

The countdown/video/notify-me site, now backed by a small YouTube automation pipeline: a
cron job creates Bruno's live broadcast, polls it, and falls back to the latest recording —
all fully testable without a single real YouTube API call, via a built-in mock mode.

## Architecture

```
GitHub Actions (every 5 min)
   │
   ├─ POST /api/cron/sync-youtube  ──►  lib/youtube.ts  ──►  data/status.json
   │        (creates broadcast,               │
   │         polls live status,          mock mode (no creds) or
   │         refreshes VOD)              real YouTube Data API calls
   │
   └─ POST /api/cron/notify  ──►  lib/subscriptions.ts (who + their IANA timezone)
            (pushes to subscribers          +
             whose local clock just    data/status.json (to say "live now" vs "latest howl")
             hit 6AM/6PM)

Browser  ──►  GET /api/status (public, safe subset only)  ──►  VideoPanel live/VOD switch
Browser  ──►  GET /status?key=...  (you, for debugging — includes the private RTMP ingest URL/key)
```

- **Countdown** ([app/Countdown.tsx](app/Countdown.tsx)) — counts down to the next 6:00/18:00
  IST session in the visitor's own local time.
- **Video panel** ([app/VideoPanel.tsx](app/VideoPanel.tsx)) — polls `/api/status` and shows
  either the live embed ("🔴 Live now in India!") or the latest VOD ("Bruno's latest howl") —
  honest about which one you're getting, since only India-timezone visitors ever see a
  genuinely live stream.
- **Notify me** ([app/NotifyButton.tsx](app/NotifyButton.tsx)) — Web Push subscription,
  storing the visitor's IANA timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`)
  so notification timing stays correct across DST changes.
- **`/api/cron/sync-youtube`** ([app/api/cron/sync-youtube/route.ts](app/api/cron/sync-youtube/route.ts))
  — `CRON_SECRET`-guarded. A few minutes before each session it creates that session's YouTube
  broadcast, polls its lifecycle status, and refreshes the fallback VOD whenever nothing's live.
- **`/api/cron/notify`** ([app/api/cron/notify/route.ts](app/api/cron/notify/route.ts)) —
  pushes to subscribers whose local time just hit a session, with copy that reflects whether
  it's actually live right now.
- **`/api/status`** ([app/api/status/route.ts](app/api/status/route.ts)) — public, returns only
  `{ isLive, liveVideoId, vodId, lastVodFetchAt }`. Never exposes the RTMP ingest URL/key.
- **`/status?key=...`** ([app/status/page.tsx](app/status/page.tsx)) — your own debug page:
  current mode (mock/live), live status, last VOD fetch time, subscriber count, and — since
  this is where you'd configure the camera/FFmpeg relay — the current broadcast's private
  ingest URL/key.
- **`lib/schedule.ts`** — all the 6AM/18:00 IST time math, plus per-timezone matching that
  recomputes each subscriber's UTC offset fresh from their IANA zone every time (no drift
  when their clocks change for DST).
- **`lib/youtube.ts`** — see "Mock mode" below.

## Mock mode — fully testable with zero YouTube API access

`lib/youtube.ts` checks for four env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REFRESH_TOKEN`, `YOUTUBE_CHANNEL_ID`.

- **All four unset (the default today)** — every YouTube call is mocked: "creating a
  broadcast" just fabricates an ID and a fake `rtmp://mock.invalid/...` ingest URL, "is it
  live" is answered by the same clock check the site always used
  (`isLiveWindow()` in `lib/schedule.ts`), and "latest VOD" returns whatever you've put in
  `NEXT_PUBLIC_YOUTUBE_VOD_ID`. The cron job, `data/status.json`, `/api/status`, and the
  video panel's live/VOD switch all run for real against this mock data — nothing about the
  pipeline is stubbed out or skipped, only the actual network calls to Google are.
- **All four set** — real `liveBroadcasts.insert`/`liveStreams.insert`/bind, real lifecycle
  polling, real uploads-playlist lookup for the latest VOD. No frontend or cron-job code
  changes needed to switch over — just fill in the env vars.

Check which mode you're in any time at `/status?key=...` (see below).

## Run it locally

```bash
npm install
npm run generate-vapid-keys
```

Copy the printed keys into `.env.local` (copy `.env.example` first). Then:

```bash
npm run dev
```

Open http://localhost:3000. Everything works in mock mode with no further setup — try:

```bash
curl -X POST localhost:3000/api/cron/sync-youtube -H "Authorization: Bearer <CRON_SECRET>"
curl localhost:3000/api/status
```

## Configuration (`.env.local`)

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` / `YOUTUBE_CHANNEL_ID` | Real YouTube Data API credentials. Leave any unset to stay in mock mode. |
| `NEXT_PUBLIC_YOUTUBE_LIVE_ID` / `NEXT_PUBLIC_YOUTUBE_VOD_ID` | Mock-mode fallback video IDs. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push keys, from `npm run generate-vapid-keys`. |
| `CRON_SECRET` | Bearer token required by `/api/cron/notify` and `/api/cron/sync-youtube`. |
| `STATUS_SECRET` | Query-param key (`?key=...`) required by `/status`. |

## Getting real YouTube credentials

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project, enable
   **YouTube Data API v3**, and create an OAuth 2.0 Client ID of type "Web application" with
   `http://localhost:4321/oauth2callback` as an authorized redirect URI.
2. Run the one-time helper (opens a browser consent screen, captures the refresh token):
   ```bash
   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... npm run get-youtube-refresh-token
   ```
3. Paste the four printed values into `.env.local` (and your deploy host's env vars).

## Scheduling: GitHub Actions, not Vercel Cron

Vercel's free (Hobby) Cron Jobs tier caps each job at **one invocation per day**, which can't
express "check every 5 minutes." Instead, [.github/workflows/cron.yml](.github/workflows/cron.yml)
runs on a `*/5 * * * *` schedule and calls both cron endpoints. `sync-youtube` checks the
time itself rather than trusting the trigger to fire exactly on time, so occasional GitHub
Actions scheduling delays don't matter.

To use it: in your GitHub repo's Settings → Secrets, add `APP_URL` (your deployed site URL)
and `CRON_SECRET` (same value as your deploy's env var). The workflow runs automatically
once pushed. If you later move to Vercel Pro, you can switch to Vercel Cron instead.

## Known limitations (by design, matching the "least engineering possible" philosophy)

- Both `data/subscriptions.json` and `data/status.json` are flat files. Fine for local/dev
  and small always-on hosting; **not durable on serverless platforms** (Vercel, etc.) where
  the filesystem resets between deploys/invocations — swap in a real datastore (Postgres,
  SQLite on a persistent volume, Upstash Redis) before relying on this in production.
- No accounts — a push subscription plus a browser-reported IANA timezone is the only
  identity.

## Deploying

Any Next.js host works (Vercel is the path of least resistance — free tier). Set the same
env vars there, and point the GitHub Actions workflow's `APP_URL` secret at the deployed URL.
