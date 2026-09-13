# YouTube embedding — reopened: react-native-youtube-iframe confirmed working, live included

Status: **reopened and confirmed (2026-09-07).** The raw `react-native-webview` DIY
approach documented below is still dead — that specific technique is confirmed unfixable.
But it turned out that conclusion didn't apply to every way of embedding YouTube:
`react-native-youtube-iframe` (a dedicated wrapper around the real YouTube IFrame Player
API, not a hand-rolled `<iframe>`) was tested fresh and **successfully played both a
known-embeddable YouTube video AND a real, actively-running YouTube Live stream, on a real
device.** That was the one remaining unknown from the first round of testing, and it's now
resolved: this library plays YouTube Live embeds fine on Android.

What changed the picture: the assumption that *any* native-WebView-based YouTube embed
needs a real, deployed public domain turned out to be wrong for this specific library.
Checked directly against its source
(`src/constants.js`, `DEFAULT_BASE_URL = 'https://lonelycpp.github.io/react-native-youtube-iframe/iframe_v2.html'`) —
it already loads its player page from a real, publicly hosted GitHub Pages URL by default.
That's exactly the fix identified below as "the one confirmed-viable path," except the
library maintainer already built and hosts that page — there's no need to deploy anything
yourself. This was added in response to
[issue #89](https://github.com/LonelyCpp/react-native-youtube-iframe/issues/89) (Nov 2020),
well before this project ever touched YouTube embedding.

Also worth correcting: `PLAYER_ERROR` codes 101 and 150 both map to `EMBED_NOT_ALLOWED` in
the library's own source — confirming that a large share of real-world "video unavailable"
reports for this kind of embed are a **per-video restriction the uploader/rights-holder
set** (embedding disabled, or a copyright claim), not a structural WebView/origin problem.
No relay page, hosted or not, fixes that case — it only matters for videos this project
controls, where embedding can just be left enabled.

**What this proves:** the embedding mechanism works for both an ordinary video and a real
live stream — the two things that needed separate verification, since live embeds run
through a different code path in YouTube's player than VOD does. The test lives in
`mobile/components/YoutubeEmbedTest.tsx` (wired into `HomeScreen` behind a "🧪 YouTube LIVE
embed test" label), first tested against Google's own IFrame API demo video
(`M7lc1UVf-VE`), then swapped to a real public live stream's video ID and confirmed
playing on the real device via Metro fast refresh (no native rebuild needed — this was a
JS-only change, `react-native-webview`'s native module was already linked from the first
test). `VideoPanel.tsx` still ships direct video via `expo-video` in production for now —
this hasn't replaced the production path yet, but there's no longer a known technical
blocker to doing so once there's an actual Bruno live stream to point it at.

Original doc below, from when this looked like a closed case — kept as-is for the trail.

Tried one more thing before giving up on YouTube entirely, for the record: after the
Referer-header fix below still failed, switched to loading the embed via an HTML page with
an `<iframe>` and a spoofed `baseUrl` (option 2 in the original list) — this got past
Error 153 but hit a *different* error, **152-4** ("This video is unavailable"). Research
turned up a GitHub issue
([Cap-go/capacitor-youtube-player#49](https://github.com/Cap-go/capacitor-youtube-player/issues/49))
describing the identical error in a native WebView context on iOS, confirming this isn't
fixable with request headers or a spoofed origin — the only workaround reported is loading
the iframe from a page actually hosted on a real, publicly reachable HTTPS domain (a
synthetic/local HTML document isn't good enough, even with the right `Referer`/`baseUrl`).
That's a real infrastructure dependency (a domain to host a one-page relay), not a code fix,
and was judged not worth it: there's no live camera feed yet anyway, so real YouTube Live
integration wasn't actually needed yet, and direct video playback is simpler and matches
where the build plan already says this eventually goes (its own Phase 3 talks about moving
off YouTube-embedded video to a real video host). Revisit YouTube embedding only if there's
a specific reason to prefer it over direct video hosting later.

Original writeup below, for what was tried against the *first* error (153):

## What was tried

1. **Suspected the video itself** (embedding disabled by the uploader). Tested two
   different, unrelated videos (`2fwJKCXApJU`, then a video the user picked directly:
   `5eQu6MFGoG8`) — both failed identically. Ruled out: this isn't about video choice.
2. **Found the likely real cause**: Google's own support docs on Error 153
   (https://support.google.com/youtube/answer/171780) — the section on providing an HTTP
   Referer header — describe this exact failure mode: YouTube's embed player requires a
   `Referer` header on the request, and blocks playback without one. This matched: earlier,
   independently, trying to verify video IDs by navigating directly to
   `youtube.com/embed/<id>` in a browser tool (no referer, no enclosing page) produced the
   *same* Error 153 even for `jNQXAC9IVRw` ("Me at the zoo" — about as reliably embeddable
   as a YouTube video gets), which is strong independent evidence this is a
   missing-referer problem rather than a per-video restriction.
3. **Applied the fix Google's docs describe**: added
   `headers: { Referer: "https://www.youtube.com/" }` to the WebView's `source` object in
   `VideoPanel.tsx`. `react-native-webview` does support a `headers` field on `source` (this
   maps to Android's `WebView.loadUrl(url, headers)`, which does support extra headers on
   the initial request — confirmed against the library's own type definitions).
4. **Still failed after that fix**, tested live on the real device. So either:
   - `react-native-webview`'s Android implementation isn't actually attaching the `headers`
     to this particular request (e.g., some WebView versions/Android versions only honor
     `headers` on `loadUrl`-triggered navigations, not the WebView's initial `source` load —
     this is a documented rough edge in some `react-native-webview` versions/issues), or
   - the referer value itself (`https://www.youtube.com/`) isn't sufficient/accepted for
     this particular embed check, or
   - there's a second, different cause entirely that happens to also surface as Error 153.

## If the raw WebView/DIY approach is ever revisited

The one confirmed-viable path for a *hand-rolled* embed (per the GitHub issue above): host
a minimal one-page iframe relay on a real domain you control — e.g. a route on the website
once it's deployed — and point the WebView at that real URL instead of a
locally-constructed HTML document. A Claude Artifact was tried as a quick stand-in for "a
real domain" but doesn't work for this: Artifacts are private by default and a phone's
WebView has no login session, so it hits a sign-in wall instead of the video unless shared —
and even sharing didn't reliably resolve it in practice.

This whole section is now moot for the actual project, though: `react-native-youtube-iframe`
already solves the "real domain" problem internally (see the update at the top of this
doc), so there's no reason to build a relay page by hand anymore.

## Postscript: the "well-known" sample video URL was also dead

The first replacement for YouTube was a public Google sample-bucket URL
(`gtv-videos-bucket/sample/BigBuckBunny.mp4`), long used across the web for exactly this
kind of testing. It no longer works — Google locked the bucket down at some point; a direct
browser request now returns `AccessDenied`. Moved to a **bundled local asset**
(`assets/videos/sample.mp4`, `require()`d in `VideoPanel.tsx`) instead, which has zero
network dependency at all — no URL, no hosting, no embed policy, can't go dead.

One real bug found along the way, worth remembering: after adding the bundled-asset
fallback (`process.env.EXPO_PUBLIC_LIVE_VIDEO_URL || SAMPLE_VIDEO`), the video still didn't
play — turned out `.env.local` still had the dead Google URL *set*, so the `||` fallback
never triggered (a set env var, even pointing at a dead resource, is still truthy). Confirmed
via `adb logcat` filtering the app's own PID: `ExoPlaybackException: Source error … Response
code: 403` — the exact 403 from the dead URL, proving it was still trying to fetch over the
network. Device logs (`adb logcat -d --pid=<pid>`) turned out to be the fastest way to cut
through a debugging thread once several rounds of guessing hadn't converged — worth reaching
for earlier next time, rather than reasoning from JS-level symptoms alone.

## Update: YouTube ruled back out anyway — ads, not embedding, killed it

Embedding was never actually the final blocker. Testing the live embed above (a real
public live stream from another channel) surfaced YouTube ads in the player, which led to
digging into *why* — and the honest answer is worse than "that one channel is monetized."
Per Google's own support page
(https://support.google.com/youtube/answer/2475463?hl=en), since a 2020 ToS change:

> "YouTube may also place ads on videos in channels not in the YouTube Partner Program."

So there is **no monetization status, channel age, or subscriber count that protects a
video from ads** — YouTube reserves that right unconditionally, and a Content ID claim
from a rights holder is a second, independent path to ads neither the creator nor this
app controls. An earlier version of this doc claimed a new/unmonetized channel
"structurally cannot serve ads" — that was wrong, and is retracted. This also explains why
`initialPlayerParams.controls: false` didn't take effect during that same test: YouTube is
known to override control-hiding when an ad is eligible to run, specifically so viewers can
always identify and skip out to the ad/video — and that override is available on *any*
video, not just ones from monetized channels.

**Net conclusion:** the embedding mechanism works (both VOD and live, confirmed above),
but that no longer matters — an app marketed as a genuine, reliable alarm clock can't risk
a random ad appearing over Bruno's face at 6AM, and there's no way to prevent that while
using YouTube's player. Decided instead on **Cloudflare Stream for the live minutes +
Cloudflare R2 for the recorded replay** — see `JOURNEY.md`'s live-streaming plan section
for the full reasoning and the code now wired up for it
(`mobile/lib/liveStatus.ts`, `VideoPanel.tsx`). The YouTube-iframe test/experiment stays in
the repo as a dead end worth remembering, not something to build on.

## Impact

None on the shipped video path — `VideoPanel.tsx` still plays direct video via
`expo-video`, now pointed at Cloudflare Stream (live) / R2 (recorded) URLs instead of
YouTube. The live/VOD logic, countdown, "LIVE NOW" badge, and the debug
`setDebugForceLive` toggle (`lib/schedule.ts`) all still work exactly the same.
`YoutubeEmbedTest.tsx`/`react-native-youtube-iframe` can be removed from the app once
Cloudflare is actually wired up and tested end-to-end — kept for now only as a reference
for the embedding trail above.
