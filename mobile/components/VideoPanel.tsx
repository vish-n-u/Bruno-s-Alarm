import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView, type VideoSource } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { isLiveWindow } from "../lib/schedule";
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
// The recorded replay — a plain R2 (or any direct) URL, same fallback chain.
const VOD_SOURCE: VideoSource = process.env.EXPO_PUBLIC_VOD_VIDEO_URL || SAMPLE_VIDEO;

// Starts muted (autoplay shouldn't blast sound the moment the video loads), with a
// tap-to-unmute control — same pattern most apps use for autoplaying video. On the
// alarm-ringing screen, pass allowUnmute={false}: the actual alarm sound there comes from
// the native alarm itself (see plugins/withAlarmSound.js), which loops continuously via
// react-native-alarmageddon's own MediaPlayer until Stop/Snooze — unmuting the video too
// would just overlap/echo against it for the entire ringing duration.
export default function VideoPanel({ allowUnmute = true }: { allowUnmute?: boolean }) {
  const [live, setLive] = useState(isLiveWindow());
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!isLiveWindow()) {
        if (!cancelled) setLive(false);
        return;
      }
      if (!isCloudflareConfigured()) {
        // Not wired up yet — fall back to trusting the clock alone, same as
        // before this existed, so local testing/the debug toggle still work.
        if (!cancelled) setLive(true);
        return;
      }
      // Inside the scheduled window — confirm the camera is actually
      // connected before switching, so a dead camera doesn't show as "LIVE".
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

  const source = live ? LIVE_SOURCE : VOD_SOURCE;

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

  // Covers the gap Cloudflare's own live-status check can't see: it confirms a camera is
  // connected, but not that *this* playback of the HLS stream actually succeeds (a dropped
  // segment, a local network hiccup, a CDN edge that hasn't caught up yet). If the player
  // errors out while we're supposed to be showing the live feed, fall back to the recorded
  // replay rather than getting stuck on a stalled/black player — the next 15s poll will try
  // live again on its own if it's actually still up.
  useEffect(() => {
    const subscription = player.addListener("statusChange", ({ status, error }) => {
      if (status === "error" && live) {
        console.warn("Live stream failed to play — falling back to the recorded replay.", error);
        setLive(false);
      }
    });
    return () => subscription.remove();
  }, [player, live]);

  return (
    <View style={styles.frame}>
      <VideoView style={styles.video} player={player} nativeControls contentFit="cover" />
      {allowUnmute && (
        <Pressable style={styles.muteButton} onPress={() => setMuted((m) => !m)} hitSlop={10}>
          <Ionicons name={muted ? "volume-mute" : "volume-high"} size={16} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  video: {
    flex: 1,
    backgroundColor: "#000",
  },
  muteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
