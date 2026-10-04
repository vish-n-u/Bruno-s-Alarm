import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, AppState, Pressable, StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView, type VideoSource } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { getCachedAlarmVideoUri, onAlarmRecordingChanged, refreshAlarmSound } from "../lib/alarmSound";
import { tapLight } from "../lib/haptics";
import { getDebugForceLive, isLiveWindow, isNearLiveWindow } from "../lib/schedule";
import { getCloudflareLiveManifestUrl, getCloudflareLiveStatus, isCloudflareConfigured } from "../lib/liveStatus";

// Real footage of Bruno howling, bundled locally so it always plays with zero
// network/hosting dependency until Cloudflare Stream/R2 are configured. See
// docs/youtube-embed-error-153.md for why YouTube was ruled out (unavoidable ad risk) in
// favor of Cloudflare Stream (live) + R2 (recorded replay).
const SAMPLE_VIDEO = require("../assets/videos/Bruno Howl Alarm.mp4");

// Cloudflare Stream's live HLS manifest, once EXPO_PUBLIC_CF_STREAM_CUSTOMER_CODE and
// EXPO_PUBLIC_CF_LIVE_INPUT_UID are set — falls back to a raw URL override, then the
// bundled sample.
const LIVE_SOURCE: VideoSource =
  getCloudflareLiveManifestUrl() || process.env.EXPO_PUBLIC_LIVE_VIDEO_URL || SAMPLE_VIDEO;
// Static fallback for the recorded replay, used only until the real cached recording (see
// lib/alarmSound.ts — the same file periodically refreshed from Cloudflare for the native
// alarm sound) has been downloaded at least once.
const FALLBACK_VOD_SOURCE: VideoSource = process.env.EXPO_PUBLIC_VOD_VIDEO_URL || SAMPLE_VIDEO;

// A go-live alarm fires the instant Cloudflare's webhook sees the encoder connect — but
// Cloudflare's own "is this input live" status, and the HLS segments actually being
// fetchable, can lag a few seconds behind that. There's no legitimate "not live yet" outcome
// for this alarm specifically (it only ever fired because Bruno just went live), so it gets a
// short grace window of fast retries instead of the single check-and-concede the 6AM/6PM
// alarms correctly use (where "not live yet" can be genuinely true — he's running late).
const LIVE_ALARM_GRACE_MS = 90_000;
const LIVE_ALARM_RETRY_MS = 3_000;

const POLL_MS = 15_000;
// Viewers are several seconds behind the camera, so when Cloudflare reports the broadcast has
// stopped there's still footage left to watch. Keep playing it, and only switch away once the
// video actually stops moving (it ran out) — or after DRAIN_MAX_MS, so it can never hang.
const DRAIN_STALL_MS = 3_000;
const DRAIN_MAX_MS = 30_000;
// While Cloudflare still says live, a video that hasn't moved for this long is stuck rather than
// just buffering on a slow connection — reload the stream, a few times at most.
const FROZEN_MS = 15_000;
const MAX_FROZEN_RELOADS = 3;
const PROGRESS_CHECK_MS = 1_000;
// One "not live" answer can be a blip (Cloudflare between segments, a stream reconnecting), so
// a stream we're showing only counts as over after this many "not live" answers in a row, the
// second one asked for sooner than the normal poll.
const OFFLINE_CONFIRMATIONS = 2;
const OFFLINE_CONFIRM_MS = 5_000;
// A brand-new stream's live feed isn't playable for its first several seconds (Cloudflare is still
// building the first segments), and a reconnecting encoder causes short gaps too. A playback error
// while Cloudflare says live means "try again shortly", not "the stream ended" — retry for about
// half a minute before falling back.
const LIVE_ERROR_RETRY_MS = 3_000;
const MAX_LIVE_ERROR_RETRIES = 10;

// The Live tab's player: live stream, the replay of a stream that just ended, or (unused there,
// hidden behind NO SIGNAL) the saved recording. Starts muted; tap to unmute. The alarm-ringing
// screen does NOT use this — it has AlarmClipVideo, which only ever plays the clip the alarm
// sound is playing, so picture and sound can't come from different clips.
export default function VideoPanel({
  allowUnmute = true,
  paused = false,
  onLiveChange,
  alwaysCheckLive = false,
  replayUrl = null,
  onReplayError,
}: {
  /** While not live, play this instead of the saved recording — the Live tab passes the
   * recording of the stream that just ended, for its short replay window. */
  replayUrl?: string | null;
  /** The replay couldn't be played (e.g. Cloudflare hasn't made it available yet). */
  onReplayError?: () => void;
  allowUnmute?: boolean;
  /** Skips the "only ask Cloudflare near a scheduled 6AM/6PM session" shortcut and always
   * asks — for a go-live alarm, which by definition can happen at any time of day. */
  alwaysCheckLive?: boolean;
  /** Pauses playback (video + audio) without unmounting the player — pass `!isFocused` from a
   * screen inside a tab navigator, since switching tabs doesn't unmount by default and a
   * playing/unmuted video would otherwise keep making sound in the background. */
  paused?: boolean;
  /** Reports this panel's own live/not-live determination (the real Cloudflare-confirmed one,
   * not just the clock window) plus Cloudflare's ID for the current broadcast — lets a parent
   * screen react to the same signal instead of running its own, possibly inconsistent, check. */
  onLiveChange?: (live: boolean, streamId: string | null) => void;
}) {
  const [live, setLive] = useState(isLiveWindow());
  const [streamId, setStreamId] = useState<string | null>(null);
  const liveRef = useRef(live);
  liveRef.current = live;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    onLiveChange?.(live, live ? streamId : null);
    // Only the parent's latest callback identity should matter, not re-fire this on every
    // parent re-render — it should fire when the live state itself actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, streamId]);
  const [muted, setMuted] = useState(true);

  // Bruno's latest saved recording, if one's ever been downloaded — takes priority over the
  // fixed placeholder clip. `version` changes whenever a new recording replaces the file: the
  // path stays the same (scheduled alarms point at it), so without it the player would keep
  // showing a file that was deleted and swapped underneath it and freeze.
  const [recording, setRecording] = useState<{ uri: string; version: number } | null>(null);
  function applyRecording(uri: string | undefined, replaced: boolean) {
    if (!uri) return;
    setRecording((prev) =>
      prev && prev.uri === uri && !replaced ? prev : { uri, version: (prev?.version ?? 0) + 1 }
    );
  }

  // Computed once at mount: only a go-live alarm gets a grace window at all.
  const graceDeadline = useRef(alwaysCheckLive ? Date.now() + LIVE_ALARM_GRACE_MS : 0);
  // Set when Cloudflare says the broadcast stopped but the viewer still has footage to watch.
  const drainStartedAt = useRef<number | null>(null);
  // "Not live" answers in a row while showing the live feed (see OFFLINE_CONFIRMATIONS).
  const offlineStreak = useRef(0);
  // Live-feed playback errors retried so far (see MAX_LIVE_ERROR_RETRIES). Reset once it plays.
  const liveErrorRetries = useRef(0);

  // Reels-style tap-to-mute: tapping anywhere on the video toggles mute and briefly flashes a
  // centered speaker icon that fades back out, instead of a small always-on corner button.
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  function handleTap() {
    tapLight();
    setMuted((m) => !m);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    iconOpacity.stopAnimation();
    iconOpacity.setValue(1);
    hideTimer.current = setTimeout(() => {
      Animated.timing(iconOpacity, { toValue: 0, duration: 350, useNativeDriver: true }).start();
    }, 550);
  }

  // Re-checks (and actively tries to refresh) the cached recording every time we're about to
  // show the VOD fallback rather than only once on mount — refreshAlarmSound() is safe to call
  // opportunistically (no-ops if there's nothing newer), so the fallback has its best shot at
  // being the latest one, not a stale/previous recording or the bundled placeholder.
  useEffect(() => {
    if (live) return;
    let cancelled = false;
    getCachedAlarmVideoUri().then((uri) => {
      if (!cancelled) applyRecording(uri, false);
    });
    refreshAlarmSound().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [live]);

  // A newly downloaded recording has replaced the saved file — reload it.
  useEffect(
    () =>
      onAlarmRecordingChanged(() => {
        getCachedAlarmVideoUri().then((uri) => applyRecording(uri, true));
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      const forced = getDebugForceLive();
      if (forced !== null) {
        // A true override — skips the real Cloudflare check entirely, so this actually
        // forces the state rather than merely widening the window in which we're willing to
        // ask (which would still report "not live" for a genuinely offline camera).
        if (!cancelled) setLive(forced);
        timer = setTimeout(check, POLL_MS);
        return;
      }
      if (!isCloudflareConfigured()) {
        // Not wired up yet — fall back to trusting the clock window alone, same as
        // before this existed, so local testing/the debug toggle still work.
        if (!cancelled) setLive(isLiveWindow());
        timer = setTimeout(check, POLL_MS);
        return;
      }
      const inGrace = Date.now() < graceDeadline.current;
      // The two sessions are fixed and known in advance, so there's no reason to hit
      // Cloudflare's API the other ~23 hours of the day — only actually ask once we're
      // close enough to a scheduled session for the answer to possibly be "yes" (a little
      // before it, too, since Bruno doesn't always start exactly on schedule), or while a
      // go-live alarm's grace window (above) is still open.
      if (!alwaysCheckLive && !inGrace && !isNearLiveWindow()) {
        if (!cancelled) setLive(false);
        timer = setTimeout(check, POLL_MS);
        return;
      }
      const status = await getCloudflareLiveStatus();
      if (cancelled) return;
      let next = inGrace ? LIVE_ALARM_RETRY_MS : POLL_MS;
      if (status.live) {
        offlineStreak.current = 0;
        drainStartedAt.current = null;
        setStreamId(status.streamId);
        setLive(true);
      } else if (!status.reachable) {
        // Couldn't ask Cloudflare — unknown, not "off". Keep showing whatever we're showing.
      } else if (liveRef.current) {
        offlineStreak.current += 1;
        if (offlineStreak.current >= OFFLINE_CONFIRMATIONS) {
          // The broadcast really stopped — let the viewer finish the footage they're still behind
          // on; the progress watcher below switches away once it actually runs out.
          if (drainStartedAt.current === null) drainStartedAt.current = Date.now();
        } else {
          next = OFFLINE_CONFIRM_MS;
        }
      } else {
        setLive(false);
      }
      // Retry quickly while a go-live alarm's grace window is still open — even a "yes" here
      // can still fail to actually play for a couple more seconds while HLS segments
      // populate (see the playback-error handling below) — then settle into the normal cadence.
      timer = setTimeout(check, next);
    };

    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const vodSource: VideoSource = useMemo(
    () => (recording ? { uri: recording.uri } : FALLBACK_VOD_SOURCE),
    [recording]
  );
  const replaySource: VideoSource | null = useMemo(() => (replayUrl ? { uri: replayUrl } : null), [replayUrl]);
  const source = live ? LIVE_SOURCE : replaySource ?? vodSource;

  // The first load is handled entirely by useVideoPlayer's own source argument — play()
  // right in its setup callback. This ref exists only to detect a *later* change (live/VOD
  // toggling, or a new recording), so we don't call replace() redundantly on mount.
  const loadedSource = useRef(source);

  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    if (source !== loadedSource.current) {
      loadedSource.current = source;
      player.replace(source);
      player.loop = true;
      player.muted = muted;
      if (!pausedRef.current) player.play();
    }
  }, [source, player, muted]);

  // Keeps the player's actual mute state synced whenever the toggle button changes it.
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  // Stops playback (so audio can't keep going) the moment the screen loses focus, and
  // resumes when it regains it — see the `paused` prop doc above for why this is needed.
  useEffect(() => {
    if (paused) {
      player.pause();
    } else {
      player.play();
    }
  }, [paused, player]);

  // Leaving the app (home button, another app) pauses the video. Coming back to a live stream
  // reloads it at the live moment — resuming the old position left it stuck until the user
  // switched tabs.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        player.pause();
      } else if (state === "active" && !pausedRef.current) {
        if (liveRef.current) player.replace(LIVE_SOURCE);
        player.play();
      }
    });
    return () => subscription.remove();
  }, [player]);

  // Watches whether the live video is actually moving (its playback position advancing), once a
  // second. Two jobs: after the broadcast stops, switch away as soon as the remaining footage has
  // played out; and while it's still live, reload a stream that has been frozen for a while.
  useEffect(() => {
    if (!live) return;
    let lastTime = player.currentTime;
    let lastMovedAt = Date.now();
    let frozenReloads = 0;
    const id = setInterval(() => {
      const now = Date.now();
      if (player.currentTime !== lastTime) {
        lastTime = player.currentTime;
        lastMovedAt = now;
        frozenReloads = 0;
        liveErrorRetries.current = 0;
      }
      // Paused or in the background, it isn't supposed to move — don't count that as stuck.
      if (pausedRef.current || AppState.currentState !== "active") {
        lastMovedAt = now;
      }
      const stillFor = now - lastMovedAt;

      const drainStart = drainStartedAt.current;
      if (drainStart !== null) {
        if (stillFor >= DRAIN_STALL_MS || now - drainStart >= DRAIN_MAX_MS) {
          drainStartedAt.current = null;
          setLive(false);
        }
        return;
      }

      if (stillFor >= FROZEN_MS && frozenReloads < MAX_FROZEN_RELOADS) {
        frozenReloads += 1;
        lastMovedAt = now;
        player.replace(LIVE_SOURCE);
        player.play();
      }
    }, PROGRESS_CHECK_MS);
    return () => clearInterval(id);
  }, [live, player]);

  // Covers the gap Cloudflare's own live-status check can't see: it confirms a camera is
  // connected, but not that *this* playback of the HLS stream actually succeeds (a dropped
  // segment, a local network hiccup, a CDN edge that hasn't caught up yet). If the player
  // errors out while we're supposed to be showing the live feed, fall back to the recorded
  // replay rather than getting stuck on a stalled/black player — the next 15s poll will try
  // live again on its own if it's actually still up.
  useEffect(() => {
    const subscription = player.addListener("statusChange", ({ status, error }) => {
      // A debug-forced state is a deliberate override for testing — a real playback error
      // (expected here, since "force live" with no actual broadcast means the live manifest
      // genuinely doesn't exist) shouldn't silently undo it.
      if (status === "error" && live && getDebugForceLive() === null) {
        if (liveErrorRetries.current < MAX_LIVE_ERROR_RETRIES) {
          liveErrorRetries.current += 1;
          setTimeout(() => {
            if (!liveRef.current) return;
            player.replace(LIVE_SOURCE);
            if (!pausedRef.current) player.play();
          }, LIVE_ERROR_RETRY_MS);
          return;
        }
        console.warn("Live stream failed to play — falling back to the recorded replay.", error);
        liveErrorRetries.current = 0;
        drainStartedAt.current = null;
        setLive(false);
      } else if (status === "error" && !live && replayUrl) {
        console.warn("Replay of the last stream failed to play.", error);
        onReplayError?.();
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, live, replayUrl]);

  return (
    <View style={styles.frame}>
      {/* nativeControls explicitly off — this screen has its own Reels-style tap-to-mute
          (below) plus, on the Live tab, a chat overlay anchored to the bottom; the native
          play/pause/scrub bar not only duplicates that but paints a dimming scrim behind
          itself whenever shown, which made the whole video read as broken/black. */}
      <VideoView style={styles.video} player={player} contentFit="cover" nativeControls={false} />
      {allowUnmute && (
        <Pressable style={StyleSheet.absoluteFill} onPress={handleTap}>
          <Animated.View style={[styles.centerIconWrap, { opacity: iconOpacity }]} pointerEvents="none">
            <View style={styles.centerIconBubble}>
              <Ionicons name={muted ? "volume-mute" : "volume-high"} size={32} color="#fff" />
            </View>
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Fills whatever full-screen container it's placed in (the alarm-ringing screen or the Live
  // tab) — no card frame/rounded corners, this is the entire screen's background.
  frame: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
  },
  video: {
    flex: 1,
    backgroundColor: "#000",
  },
  centerIconWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  centerIconBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
