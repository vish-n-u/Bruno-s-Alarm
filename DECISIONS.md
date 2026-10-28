# Bruno's Alarm — Decision log

Why things are the way they are. **Read the relevant entry before changing anything it covers**,
and if a change would undo or bend a decision, ask the owner first and record the outcome here.
Several features share the same files and numbers (one recording is the alarm sound, the ringing
video, the Live tab replay and "Watch his last howl"), so a change made for one can quietly break
another. Each entry says what it protects and what else depends on it.

Format: **Decision** · *why* · what depends on it · date / where in code.
Newest changes to an entry go at the end of that entry, never silently overwritten.

---

## Alarm sound and recordings

**D1. An alarm recording must be at least 30 s long.**
*Why (owner):* the alarm loops the clip; a clip shorter than 30 s loops too quickly and sounds
broken/repetitive. Also filters camera blips and test fragments.
Depends on it: every alarm's sound and the ringing-screen video (the saved file).
Code: `ALARM_MIN_SECONDS` in `lib/sessionRecordings.ts`, used by `/api/latest-recording` · set 28 Sep.
- 18 Oct: lowered to 20 s to unstick "Watch his last howl" (sessions had shrunk to ~25 s and the
  7 Oct clip was served for 10 days). **This broke D1's purpose for alarms** — the reason wasn't
  recorded then. Owner to decide the resolution (see D1a).

- 19 Oct: **restored to 30 s** for alarms (owner chose to split, see D1a).

**D1a. Alarms and "Watch his last howl" use different clips (split, owner 19 Oct).**
Alarms want a long, loop-friendly clip (D1, ≥30 s). "Watch his last howl" wants the newest
session even if short (≥20 s, `LAST_HOWL_MIN_SECONDS`): `/api/last-howl` returns its Cloudflare
uid and the app **streams** it (HLS), so it's always current with no 20 MB download to wait for
(the old way showed the previous clip until the phone finished downloading). Falls back to the
saved alarm clip, then the built-in one. Both routes share the session rules in
`lib/sessionRecordings.ts` so they can't drift apart. Cost: each play is ~25 s of Stream viewing.

**D2. Alarm sound and ringing video always come from the same clip ("Option A").**
*Why:* what you see must match what you hear. Native player plays the saved file or the bundled
howl; the video follows the same rule. · 29 Sep · `lib/alarmSound.ts`, `AlarmClipVideo.tsx`.

**D3. Only recordings of a real session (overlapping 06:00/18:00 IST, −10/+30 min) count.**
*Why:* on 28 Sep a test stream became everyone's alarm. · `overlapsSession()` in `lib/schedule.ts`.

**D4. Recordings are mirrored to R2 under a unique name per recording (not `latest.mp4`).**
*Why:* R2 downloads are free (Stream charges per minute delivered); a fixed name got stuck in
Cloudflare's cache and served old bytes. · `/api/latest-recording`.

**D5. The saved clip is never replaced while an alarm rings.**
*Why:* the native player keeps playing the old audio; swapping would show a different video.

**D6. Alarms ring via the patched react-native-alarmageddon on the alarm stream, not
notification-channel sounds.**
*Why:* only USAGE_ALARM rings through silent/DND; notification sounds were tried and failed.

**D7. The default (bundled) howl clip is the owner's original file, unchanged** (35 s, 1080p).
*Why:* owner prefers the original quality over a smaller re-encode (+~14 MB app size). · 8 Oct.

**D8. Recordings auto-delete after 30 days** (Live Input setting). *Why:* keeps Stream storage
inside the $5 block. Anything to keep (marketing) must be downloaded first. · verified 11 Oct.

## Live tab

**D9. Never play the phone's saved clip under NO SIGNAL; replay only the stream that just ended
(5 min), labelled REPLAY.** *Why:* old/test clips used to flash on screen. · v33.
- 7 Oct: "Watch his last howl" added — an explicit button that plays a clip with a
  "LAST HOWL · date" badge (user-initiated, clearly labelled, so it doesn't conflict with D9).
  Since v46 it streams the newest session (D1a).

**D10. A stream only "ends" after 2 not-live answers in a row; playback errors retry 10× / 3 s.**
*Why:* single failed checks caused LIVE↔REPLAY flip-flopping (4 Oct). · v29.

**D9a. "Watch his last howl" opens instantly with a loader, stays open at the end, and can be
rated 1–5 paws; everyone sees the average** (owner, 20 Oct). Ratings are keyed by the session's
Cloudflare uid, one per phone (re-rating replaces it), written only by the `rateHowl` Cloud
Function; `howlRatings/{uid}` = { count, sum } is public, votes are private to their phone.
Privacy policy updated (effective 20 Oct). Only streamed sessions can be rated (the offline
fallbacks have no uid).

## Copy and design

**D11. Tagline everywhere: "A real dog. Live twice a day."** Never "Two alarms a day" (reads as if
the app only sets two alarms). The About screen uses "A real dog. A real bell. Twice a day."

**D12. Session times are always shown in the user's local time** (`sessionTimesLabel()`), never a
bare "6AM & 6PM"; "his morning and evening", no country name. · v36.

**D13. No em dashes in user-facing copy.** · owner, 7 Oct.

**D14. The alarm time picker is a plain clock** — no Bruno times highlighted or hinted (owner found
it pushy, 29 Sep). It uses `snapToOffsets`, not `snapToInterval` (Android rounding drift).

**D15. Theme follows the real clock, not system dark mode**: seven looks; dawn is dark with a
sunrise glow (owner's pick, 7 Oct). The About screen is always morning orange line art.

**D16. Onboarding asks for nothing** (no permissions, no name) and its last button just goes Home
(12 Oct; it used to open the new-alarm sheet).

**D16a. The website has the app's energy and stays honest** (owner, 28 Oct). Same fonts, same
time-of-day colours (all seven phases), living hero sky, Bruno's real howl clip and real app
screenshots, "His last howl" (from /api/last-howl, with the app's paw-rating average), the line-art
morning story scene (always morning orange, like the app's About), and a blog. Blog posts state only
true facts; add new posts when the owner shares more about Bruno instead of guessing. Copy must
match the shipped app (e.g. no live-chat claims while D17a has it off).

## Chat

**D17. Chat writes only via the `sendChatMessage` Cloud Function** (rate limit, profanity filter,
200 chars); live chat is deleted ~2 h after a room goes quiet (privacy policy promises this).

**D17a. Live chat (on the Live tab during a stream) has an owner switch, and it's OFF for the
production launch** (owner, 24 Oct). `config/app.liveChatEnabled` (missing/false = off): the app
(v48+) hides the chat overlay, and `sendChatMessage` refuses live-room messages ("Live chat is
closed.") so older app versions can't post either. Bruno's Pack keeps its own switch. To turn live
chat on: set the field to true in the Firebase console; takes effect within ~30 s.

**D18. Bruno's Pack is shown only when the owner's `config/app.packEnabled` is on AND the user
hasn't hidden it** (Settings → Chat, 13 Oct). Owner switched it on 11 Oct.

## Build and release

**D19. Release builds are clean builds, verified by looking inside the AAB.** *Why:* Play v39
shipped a cached JS bundle (its Settings said "(38)"). Settings reads the version from the
installed package (`expo-application`). · 12 Oct · PROJECT_GUIDE §8.

**D20. No advertising ID; no typed foreground service.** *Why:* Play declarations (Advertising
ID = No; no foreground-service declaration needed). Keep until ads are actually added.

**D21. Analytics never send personal data** (no names, chat text, emails); per-tester lookup uses
the per-install analytics ID only.
