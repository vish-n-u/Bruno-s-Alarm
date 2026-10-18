import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, type VideoPlayer } from "expo-video";
import Touchable from "./Touchable";
import { fonts, useNow, useThemeColors } from "../lib/theme";

/**
 * A small phone showing what a ringing alarm looks like over the lock screen: Bruno's video
 * full-bleed with the same scrims and buttons as components/AlarmRingingScreen.tsx (title,
 * time, Stop, Snooze). Purely a picture for onboarding: the buttons do nothing, and tapping
 * anywhere on it calls onPress (play/stop). The player is owned by the caller so its sound
 * and the "Hear Bruno" button share one state.
 */
export default function LockScreenPreview({
  player,
  playing,
  height,
  onPress,
}: {
  player: VideoPlayer;
  playing: boolean;
  height: number;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const now = useNow();
  const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const width = Math.round(height * 0.48);

  return (
    <Touchable style={[styles.frame, { width, height }]} onPress={onPress}>
      {/* textureView, not the default SurfaceView: it has to slide with the onboarding pager
          and be clipped to the frame's rounded corners. */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
      />
      <View style={styles.topScrim}>
        <View style={styles.titleRow}>
          <Ionicons name="alarm" size={11} color="#fff" />
          <Text style={styles.title}>Your Bruno alarm</Text>
        </View>
        <Text style={styles.time}>{time}</Text>
      </View>

      {!playing && (
        <View style={styles.playBadge}>
          <Ionicons name="play" size={22} color="#fff" style={styles.playIcon} />
        </View>
      )}

      <View style={styles.bottomScrim}>
        <View style={[styles.stop, { backgroundColor: colors.accent }]}>
          <Text style={[styles.stopText, { color: colors.accentText }]}>Stop</Text>
        </View>
        <View style={styles.snooze}>
          <Ionicons name="moon-outline" size={9} color="#fff" />
          <Text style={styles.snoozeText}>Snooze 10 min</Text>
        </View>
      </View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 26,
    borderWidth: 5,
    borderColor: "#111",
    backgroundColor: "#000",
    overflow: "hidden",
    justifyContent: "space-between",
  },
  topScrim: {
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 10,
    gap: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  title: {
    color: "#fff",
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  time: {
    color: "#fff",
    fontFamily: fonts.display,
    fontSize: 26,
  },
  playBadge: {
    alignSelf: "center",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  // The play triangle's visual centre sits left of its box.
  playIcon: {
    marginLeft: 3,
  },
  bottomScrim: {
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 6,
    alignItems: "center",
  },
  stop: {
    alignSelf: "stretch",
    borderRadius: 999,
    paddingVertical: 6,
    alignItems: "center",
  },
  stopText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  snooze: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  snoozeText: {
    color: "#fff",
    fontFamily: fonts.body,
    fontSize: 9,
  },
});
