import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView, type VideoSource } from "expo-video";
import Touchable from "./Touchable";
import { tapLight } from "../lib/haptics";
import { fonts, radius, spacing } from "../lib/theme";

/**
 * The Live tab's "Watch his last howl": plays one clip of Bruno full-screen with sound, over the
 * NO SIGNAL card, labelled so it can't be mistaken for the live feed (grey badge, recording
 * date). Plays once; the viewer closes it with X, or it closes itself when the clip ends.
 */
export default function LastHowlPlayer({
  source,
  label,
  paused,
  onClose,
}: {
  source: VideoSource;
  /** e.g. "Sat 18:00" — when the clip was recorded, or null for the built-in clip. */
  label: string | null;
  /** The Live tab lost focus: stop the sound. */
  paused: boolean;
  onClose: () => void;
}) {
  const player = useVideoPlayer(source, (p) => {
    p.muted = false;
    p.play();
  });

  useEffect(() => {
    if (paused) player.pause();
  }, [paused, player]);

  const { status } = useEvent(player, "statusChange", { status: player.status });
  useEffect(() => {
    const sub = player.addListener("playToEnd", onClose);
    return () => sub.remove();
  }, [player, onClose]);
  // A clip that won't play (e.g. the saved file was just replaced) just closes.
  useEffect(() => {
    if (status === "error") onClose();
  }, [status, onClose]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <SafeAreaView style={styles.overlay} edges={["top"]}>
        <View style={styles.badge}>
          <View style={styles.dot} />
          <Text style={styles.badgeText}>{label ? `LAST HOWL · ${label}` : "HIS HOWL"}</Text>
        </View>
        <Touchable
          style={styles.close}
          onPress={() => {
            tapLight();
            onClose();
          }}
          hitSlop={12}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </Touchable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: spacing.lg,
  },
  // Same pill as the Live tab's LIVE/REPLAY badge, with the grey (not live) dot.
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#9a9a9a",
  },
  badgeText: {
    color: "#fff",
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
