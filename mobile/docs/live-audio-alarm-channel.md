# Live audio on the alarm channel (research, not built)

Status: **researched, deliberately not built yet.** Parked so the basic alarm sound could be fixed
first. Come back to this when the alarm ringing behavior (loop, volume, sync) is solid.

## The problem

When Bruno is live and an alarm rings, the ringing screen shows the **live video** but the **sound
is the saved recording**, played by the native alarm engine (`react-native-alarmageddon`, on the
alarm audio channel). They are different content, so they can never match. The live stream has its
own audio, but the ringing screen mutes the video so the two don't overlap.

Playing the live stream's audio for real has a catch: **Do Not Disturb**.

- The saved clip plays on the **alarm channel** (`USAGE_ALARM`), which Do Not Disturb lets through
  by default.
- The video player (`expo-video`) plays on the **media channel**. In "Alarms only" mode, or if the
  person turned off the media exception, DND mutes it. The stream would look like it is playing
  while nothing is audible. If the saved clip had already been switched off, the alarm would be
  silent.
- The phone's silent/vibrate switch does not affect media, only ringtones/notifications.

## What Alarmy does (from its help pages)

Sources: Alarmy Android help center, WakeUpBroo, alar.my blog.

- Lock-screen display: uses the **"Display over other apps"** overlay permission, not the
  full-screen-intent prompt. Its help pages say Android 10+ stops apps appearing over the lock
  screen without it.
- Volume: a per-alarm volume slider, applied when the alarm rings regardless of the phone volume.
  Nothing found says it blocks the volume buttons while ringing.
- Ring duration: user-chosen; auto-dismiss after at most 3 hours.
- "Prevent power-off": optional, uses the Accessibility service, on some phone brands only.
- Not confirmed (the permission explainer page returned 403): the exact wording of the overlay
  permission page.

## What our libraries allow (checked in node_modules)

- `expo-video` 57.0.3 hardcodes `USAGE_MEDIA` / `CONTENT_TYPE_MOVIE` for its audio focus
  (`AudioFocusManager.kt`). There is no JS option to change it.
- Its JS API only offers `audioMixingMode` (mixWithOthers / duckOthers / auto / doNotMix) and
  `staysActiveInBackground`. None change the audio usage.
- `expo-video` already bundles Media3 ExoPlayer (with HLS) via `androidxMedia3Version`.
- `react-native-alarmageddon` has no media library dependency (only Kotlin stdlib, react-android,
  core-ktx).
- Live stream URL is Cloudflare HLS: `customer-<code>.cloudflarestream.com/<uid>/manifest/video.m3u8`.

## The options

### Way A: make the video player itself use the alarm channel (recommended)

A small patch to `expo-video`, switched on by a new prop only on the ringing screen, so the Live tab
stays on normal media sound.

Pros
- One stream carries both picture and its own sound, so they are automatically in sync.
- Do Not Disturb does not block it. The alarm volume we force to max applies.
- No extra bandwidth or cost.

Cons
- We patch a third-party library (patch-package already in use) and must re-check it on every
  `expo-video` upgrade.
- Audio-focus interplay with the alarm's own `MediaPlayer` (`AUDIOFOCUS_GAIN_TRANSIENT`) needs care:
  pause the saved clip at handover, then test on device.
- Needs a native rebuild and on-device testing.

### Way B: play the live audio separately inside the alarm engine

Add an audio-only live player next to the saved-clip player.

Pros
- Leaves `expo-video` alone.

Cons
- Two separate downloads of the same broadcast: picture and sound can be seconds apart, and the
  live delivery cost **doubles** per phone.
- Needs either a Media3 dependency added to the alarm module, or Android's platform `MediaPlayer`.
  Whether the platform player handles Cloudflare's HLS segment format is **unverified** and would
  need a device test.

### Way C: the light version (fallback)

Keep the saved clip as the guaranteed sound. Before switching to live sound, check whether Do Not
Disturb is on (readable without any permission). Switch only if DND is off **and** the stream has
played properly for a couple of seconds. If DND is on or the stream stalls, the clip keeps ringing
and the live video shows muted. Media volume also has to be raised while it rings.

## Notes that apply to all of them

- "Total silence" DND blocks alarms too, on every path. Nothing fixes that.
- Whatever is chosen, the saved clip must stay as the backup until live audio has proven it plays.
- Decision so far: use live audio automatically when live (option 3 in the chat), with the clip as
  backup. Which of A / B / C is unresolved. Leaning A.
