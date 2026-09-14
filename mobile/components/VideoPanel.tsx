import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView, type VideoSource } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { getCachedAlarmVideoUri } from "../lib/alarmSound";
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
// Static fallback for the recorded replay, used only until the real cached recording (see
// lib/alarmSound.ts — the same file periodically refreshed from Cloudflare for the native
// alarm sound) has been downloaded at least once.
const FALLBACK_VOD_SOURCE: VideoSource = process.env.EXPO_PUBLIC_VOD_VIDEO_URL || SAMPLE_VIDEO;

// Only rendered on the alarm-ringing screen now (Home doesn't show video at all). Starts
// muted (autoplay shouldn't blast sound the moment the alarm fires) — allowUnmute={false}
// there because the actual alarm sound comes from the native alarm itself (see
// plugins/withAlarmSound.js), which loops continuously via react-native-alarmageddon's own
// MediaPlayer until Stop/Snooze — unmuting the video too would just overlap/echo against it.
export default function VideoPanel({ allowUnmute = true }: { allowUnmute?: boolean }) {
  const [live, setLive] = useState(isLiveWindow());
  const [muted, setMuted] = useState(true);
  // Bruno's actual latest recording, if one's ever been downloaded — takes priority over the
  // fixed placeholder clip so the ringing screen shows the real thing, not one static video
  // forever. Checked once on mount; refreshAlarmSound() (run periodically in the background
  // and at schedule time) is what keeps the underlying file itself up to date.
  const [cachedVideoUri, setCachedVideoUri] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getCachedAlarmVideoUri().then((uri) => {
      if (!cancelled) setCachedVideoUri(uri);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
      <VideoView style={styles.video} player={player} contentFit="cover" />
      {allowUnmute && (
        <Pressable style={styles.muteButton} onPress={() => setMuted((m) => !m)} hitSlop={10}>
          <Ionicons name={muted ? "volume-mute" : "volume-high"} size={16} color="#fff" />
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
