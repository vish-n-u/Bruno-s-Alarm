import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView, type VideoSource } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { getCachedAlarmVideoUri, refreshAlarmSound } from "../lib/alarmSound";
import { getDebugForceLive, isLiveWindow, isNearLiveWindow } from "../lib/schedule";
import { getCloudflareLiveManifestUrl, isCloudflareConfigured, isCloudflareStreamLive } from "../lib/liveStatus";

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

// Only rendered on the alarm-ringing screen now (Home doesn't show video at all). Starts
// muted (autoplay shouldn't blast sound the moment the alarm fires) — allowUnmute={false}
// there because the actual alarm sound comes from the native alarm itself (see
// plugins/withAlarmSound.js), which loops continuously via react-native-alarmageddon's own
// MediaPlayer until Stop/Snooze — unmuting the video too would just overlap/echo against it.
export default function VideoPanel({
  allowUnmute = true,
  paused = false,
  onLiveChange,
}: {
  allowUnmute?: boolean;
  /** Pauses playback (video + audio) without unmounting the player — pass `!isFocused` from a
   * screen inside a tab navigator, since switching tabs doesn't unmount by default and a
   * playing/unmuted video would otherwise keep making sound in the background. */
  paused?: boolean;
  /** Reports this panel's own live/not-live determination (the real Cloudflare-confirmed one,
   * not just the clock window) — lets a parent screen react to the same signal instead of
   * running its own separate, potentially inconsistent check. */
  onLiveChange?: (live: boolean) => void;
}) {
  const [live, setLive] = useState(isLiveWindow());

  useEffect(() => {
    onLiveChange?.(live);
    // Only the parent's latest callback identity should matter, not re-fire this on every
    // parent re-render — it should fire when `live` itself actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);
  const [muted, setMuted] = useState(true);
  // Bruno's actual latest recording, if one's ever been downloaded — takes priority over the
  // fixed placeholder clip so the VOD fallback shows the real thing, not one static video
  // forever.
  const [cachedVideoUri, setCachedVideoUri] = useState<string | undefined>(undefined);

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
    setMuted((m) => !m);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    iconOpacity.stopAnimation();
    iconOpacity.setValue(1);
    hideTimer.current = setTimeout(() => {
      Animated.timing(iconOpacity, { toValue: 0, duration: 350, useNativeDriver: true }).start();
    }, 550);
  }

  // Re-checks (and actively tries to refresh) the cached recording every time we're about to
  // show the VOD fallback rather than only once on mount — e.g. right as a live session ends,
  // the recording that just happened may not have been cached yet; refreshAlarmSound() is
  // safe to call opportunistically (no-ops if there's nothing newer, per its own doc) so this
  // gives the fallback its best shot at actually being the latest one, not a stale/previous
  // recording or the bundled placeholder.
  useEffect(() => {
    if (live) return;
    let cancelled = false;
    getCachedAlarmVideoUri().then((uri) => {
      if (!cancelled) setCachedVideoUri(uri);
    });
    refreshAlarmSound()
      .then(() => getCachedAlarmVideoUri())
      .then((uri) => {
        if (!cancelled && uri) setCachedVideoUri(uri);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [live]);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const forced = getDebugForceLive();
      if (forced !== null) {
        // A true override — skips the real Cloudflare check entirely, so this actually
        // forces the state rather than merely widening the window in which we're willing to
        // ask (which would still report "not live" for a genuinely offline camera).
        if (!cancelled) setLive(forced);
        return;
      }
      if (!isCloudflareConfigured()) {
        // Not wired up yet — fall back to trusting the clock window alone, same as
        // before this existed, so local testing/the debug toggle still work.
        if (!cancelled) setLive(isLiveWindow());
        return;
      }
      // The two sessions are fixed and known in advance, so there's no reason to hit
      // Cloudflare's API the other ~23 hours of the day — only actually ask once we're
      // close enough to a scheduled session for the answer to possibly be "yes" (a little
      // before it, too, since Bruno doesn't always start exactly on schedule).
      if (!isNearLiveWindow()) {
        if (!cancelled) setLive(false);
        return;
      }
      const actuallyLive = await isCloudflareStreamLive();
      if (!cancelled) setLive(actuallyLive);
    };

    check();
    const id = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const vodSource: VideoSource = cachedVideoUri || FALLBACK_VOD_SOURCE;
  const source = live ? LIVE_SOURCE : vodSource;

  // The first load is handled entirely by useVideoPlayer's own source argument — play()
  // right in its setup callback. This ref exists only to detect a *later* change (live/VOD
  // toggling), so we don't call replace() redundantly on mount and race the initial load.
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
      player.play();
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
        console.warn("Live stream failed to play — falling back to the recorded replay.", error);
        setLive(false);
      }
    });
    return () => subscription.remove();
  }, [player, live]);

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
  // Fills whatever full-screen container it's placed in (only ever the alarm-ringing
  // screen now) — no card frame/rounded corners, this is the entire screen's background.
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
