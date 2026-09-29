import { useEffect, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView, type VideoSource } from "expo-video";
import { getAlarmClipVideoUri } from "../lib/alarmSound";

// The built-in howl (assets/audio/alarm_default.mp3) was cut from this exact clip — same 26 s —
// so when the alarm falls back to the built-in sound, this is its matching video.
const BUILT_IN_CLIP: VideoSource = require("../assets/videos/Bruno Howl Alarm.mp4");

/**
 * The ringing screen's video: always the same clip the alarm sound is playing, started at the
 * point the sound has reached, looping alongside it (muted — the sound comes from the native
 * alarm player, which is what rings through silent mode and Do Not Disturb).
 *
 * Deliberately separate from VideoPanel: it never shows the live stream (a "Bruno's live — watch"
 * button on the ringing screen covers that), never downloads, and never swaps clips mid-ring, so
 * the picture can't come from a different clip than the sound. The two players run
 * independently, so they match to within about a second, not frame-perfect.
 */
export default function AlarmClipVideo({ startedAt }: { startedAt: number }) {
  const [source, setSource] = useState<VideoSource | null>(null);

  useEffect(() => {
    getAlarmClipVideoUri()
      .then((uri) => setSource(uri ? { uri } : BUILT_IN_CLIP))
      .catch(() => setSource(BUILT_IN_CLIP));
  }, []);

  if (!source) return <View style={styles.frame} />;
  // Keyed so falling back to the built-in clip creates a fresh player rather than reusing a
  // failed one.
  return (
    <ClipPlayer
      key={source === BUILT_IN_CLIP ? "built-in" : "saved"}
      source={source}
      startedAt={startedAt}
      // If the saved file won't play here, the native player can't have played it either — it
      // falls back to the built-in howl in that case, so the video does the same.
      onError={() => setSource(BUILT_IN_CLIP)}
    />
  );
}

function ClipPlayer({ source, startedAt, onError }: { source: VideoSource; startedAt: number; onError: () => void }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // Jump to where the sound is: time since the alarm started, wrapped to the clip's length (both
  // loop the same clip, so they stay roughly together).
  function syncToSound() {
    const duration = player.duration;
    if (!(duration > 0)) return;
    player.currentTime = ((Date.now() - startedAt) / 1000) % duration;
  }

  useEffect(() => {
    let synced = false;
    const subscription = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay" && !synced) {
        synced = true;
        syncToSound();
      } else if (status === "error") {
        onError();
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  // The screen turning off pauses the app, but the alarm sound keeps going — catch back up to it
  // when the screen comes back.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncToSound();
        player.play();
      } else if (state === "background") {
        player.pause();
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  return (
    <View style={styles.frame}>
      <VideoView style={styles.video} player={player} contentFit="cover" nativeControls={false} />
    </View>
  );
}

const styles = StyleSheet.create({
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
});
