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

// Once the live session actually ends, keep showing the (now-VOD) player for a few more
// minutes instead of cutting straight to "no signal" — someone opening the tab right as it
// wraps up still gets to see it, rather than an abrupt dead end.
const POST_LIVE_GRACE_MS = 5 * 60 * 1000;

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
  const [nextTime, setNextTime] = useState(() => formatTime(nextSessionAt()));
  // 0 means "never seen live this session" — Date.now() is always far past that, so the
  // grace period is naturally already expired until the first real live sighting.
  const lastLiveAtRef = useRef(0);
  // Only exists to force a re-render as the grace period ticks past — `live`/`lastLiveAtRef`
  // alone wouldn't trigger one on their own since nothing else changes during that window.
  const [, forceTick] = useState(0);

  function handleLiveChange(isLive: boolean) {
    if (isLive) lastLiveAtRef.current = Date.now();
    setLive(isLive);
  }

  const withinGrace = !live && Date.now() - lastLiveAtRef.current <= POST_LIVE_GRACE_MS;
  const showNoSignal = !live && !withinGrace;
  const playing = isFocused && (live || withinGrace);

  // The next-live time only needs to be right, not live-ticking — recomputed once a minute
  // is plenty, and avoids a full per-second re-render just for this screen.
  useEffect(() => {
    const id = setInterval(() => setNextTime(formatTime(nextSessionAt())), 60000);
    return () => clearInterval(id);
  }, []);

  // Re-checks the grace period every 10s so it actually expires into "no signal" on its own,
  // rather than only re-evaluating whenever `live` itself happens to change.
  useEffect(() => {
    if (!withinGrace) return;
    const id = setInterval(() => forceTick((n) => n + 1), 10000);
    return () => clearInterval(id);
  }, [withinGrace]);

  return (
    <View style={styles.root}>
      {/* VideoPanel stays mounted (paused unless live or in the post-live grace period) so
          its own Cloudflare poll keeps running underneath — the moment it reports live, the
          no-signal screen disappears and real video is already loaded and ready, not started
          fresh from a cold mount. */}
      <VideoPanel allowUnmute={true} paused={!playing} onLiveChange={handleLiveChange} />
      {showNoSignal && <NoSignalScreen nextTime={nextTime} />}
      {/* Chat is scoped to the actual live session, not the post-live grace period's replay —
          the grace window is a viewing courtesy, not a real live moment to chat about. Skipped
          entirely once NoSignal is showing, so its own "not live" placeholder doesn't double
          up against NoSignal's already-clear messaging. */}
      {!showNoSignal && <LiveChat sessionId={currentSessionId()} live={live} />}
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
