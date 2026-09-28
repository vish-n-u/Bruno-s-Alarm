import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import LiveChat from "../components/LiveChat";
import VideoPanel from "../components/VideoPanel";
import { currentSessionId, nextSessionAt } from "../lib/schedule";
import { fonts, radius, spacing, useThemeColors } from "../lib/theme";

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Classic broadcast test-card color bars (SMPTE order) — a static, zero-cost detail that
// makes the "no signal" screen read as an actual dead broadcast rather than a generic empty
// state.
const COLOR_BARS = ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"];

/** A jittery opacity flicker (irregular, not a smooth sine) — reads as signal interference
 * rather than a deliberate fade, unlike HomeScreen's slow, smooth twinkle. */
function useFlicker(min: number, max: number): Animated.Value {
  const value = useRef(new Animated.Value(max)).current;
  useEffect(() => {
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      const toValue = min + Math.random() * (max - min);
      const duration = 160 + Math.random() * 340;
      Animated.timing(value, { toValue, duration, easing: Easing.linear, useNativeDriver: true }).start(() => {
        if (!cancelled) step();
      });
    };
    step();
    return () => {
      cancelled = true;
    };
  }, [value, min, max]);
  return value;
}

/** Shown in place of the video entirely when Bruno isn't actually live — an old-TV
 * "no signal" test card instead of quietly playing the recorded replay, so it's unmistakable
 * that this isn't the live feed. */
function NoSignalScreen({ nextTime }: { nextTime: string }) {
  const scanlineFlicker = useFlicker(0.06, 0.16);
  const titleFlicker = useFlicker(0.5, 1);

  return (
    <View style={styles.noSignalRoot}>
      <Animated.View style={[styles.scanlineOverlay, { opacity: scanlineFlicker }]} pointerEvents="none" />
      <View style={styles.noSignalCenter}>
        <Ionicons name="tv-outline" size={36} color="#8a8a8a" />
        <Animated.Text style={[styles.noSignalTitle, { opacity: titleFlicker }]}>NO SIGNAL</Animated.Text>
        <Text style={styles.noSignalSubtitle}>Bruno's not live right now</Text>
        <Text style={styles.noSignalNext}>Next live at {nextTime}</Text>
      </View>
      <View style={styles.colorBars}>
        {COLOR_BARS.map((color, i) => (
          <View key={i} style={[styles.colorBar, { backgroundColor: color }]} />
        ))}
      </View>
    </View>
  );
}

// A dedicated tab for watching Bruno, separate from Home's schedule/alarm content. Reuses
// VideoPanel exactly as the ringing screen does for the actual live feed — VideoPanel already
// handles the live/VOD switch, its own Cloudflare polling, and (via allowUnmute) the
// Reels-style center tap-to-mute internally. This screen listens to VideoPanel's own
// `onLiveChange` (the real Cloudflare-confirmed signal, not just the clock window) so the
// "no signal" decision below never disagrees with what VideoPanel itself would show.
export default function LiveScreen() {
  const colors = useThemeColors();
  // Switching tabs doesn't unmount this screen (React Navigation keeps tabs mounted to
  // preserve their state), so without this an unmuted video would keep playing audio in
  // the background after leaving the Live tab.
  const isFocused = useIsFocused();
  const [live, setLive] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [nextTime, setNextTime] = useState(() => formatTime(nextSessionAt()));

  function handleLiveChange(isLive: boolean, id: string | null) {
    setLive(isLive);
    setStreamId(id);
  }

  // No replay once a stream ends — the only thing this screen could replay is whatever the
  // phone last downloaded (often an older or test clip), which read as a frozen, wrong picture.
  // VideoPanel already lets the viewer finish the live footage before reporting "not live".
  const showNoSignal = !live;
  const playing = isFocused && live;
  // One chat room per broadcast (Cloudflare's ID for it), so a new stream never shows the
  // previous stream's messages. Falls back to the clock-based room only if the ID is missing
  // (debug "force live", or Cloudflare not configured).
  const chatRoom = streamId ? `stream-${streamId}` : currentSessionId();

  // The next-live time only needs to be right, not live-ticking — recomputed once a minute
  // is plenty, and avoids a full per-second re-render just for this screen.
  useEffect(() => {
    const id = setInterval(() => setNextTime(formatTime(nextSessionAt())), 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.root}>
      {/* VideoPanel stays mounted (paused unless live) so
          its own Cloudflare poll keeps running underneath — the moment it reports live, the
          no-signal screen disappears and real video is already loaded and ready, not started
          fresh from a cold mount. */}
      {/* alwaysCheckLive: this tab's whole point is showing Bruno live, so it can't be limited
          to only checking Cloudflare near the two fixed 6AM/6PM windows the way the default
          shortcut assumes — an ad-hoc/off-schedule stream needs to be detected here too. */}
      <VideoPanel allowUnmute={true} paused={!playing} onLiveChange={handleLiveChange} alwaysCheckLive={true} />
      {showNoSignal && <NoSignalScreen nextTime={nextTime} />}
      {/* Chat only exists while live — skipped entirely once NoSignal is showing, so its own
          "not live" placeholder doesn't double up against NoSignal's already-clear messaging. */}
      {live && <LiveChat sessionId={chatRoom} live={live} />}
      {live && (
        <SafeAreaView style={styles.overlay} edges={["top"]} pointerEvents="none">
          <View style={styles.liveBadge}>
            <View style={[styles.liveDot, { backgroundColor: colors.live }]} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  overlay: {
    flex: 1,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    margin: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: "#fff",
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  noSignalRoot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0a0a0a",
    alignItems: "center",
    justifyContent: "center",
  },
  scanlineOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
  },
  noSignalCenter: {
    alignItems: "center",
    gap: spacing.xs,
  },
  noSignalTitle: {
    color: "#d8d8d8",
    fontFamily: fonts.mono,
    fontSize: 22,
    letterSpacing: 4,
    marginTop: spacing.sm,
  },
  noSignalSubtitle: {
    color: "#8a8a8a",
    fontFamily: fonts.body,
    fontSize: 14,
    marginTop: spacing.md,
  },
  noSignalNext: {
    color: "#6b6b6b",
    fontFamily: fonts.body,
    fontSize: 13,
  },
  colorBars: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    height: 28,
  },
  colorBar: {
    flex: 1,
  },
});
