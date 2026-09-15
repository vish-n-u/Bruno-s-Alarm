import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import SchedulePattern from "./SchedulePattern";
import NotifyToggle from "./NotifyToggle";
import type { RootStackParamList } from "../App";
import { fonts, spacing, useNow, useThemeColors, type ThemeColors } from "../lib/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SCREEN_WIDTH = Dimensions.get("window").width;

// Same dawn/midday/sunset/night window used for the color theme (lib/theme.ts) — kept as
// plain hour numbers here rather than imported, since this is about the sun/moon's position
// in an arc, not which palette is active.
const SUNRISE_HOUR = 5;
const SUNSET_HOUR = 18.5;

/** Where the sun (daytime) or moon (nighttime) actually sits right now: which body is up,
 * and how far along its arc from horizon to horizon — 0 at rise, 1 at set. Pure function of
 * the real clock, not animated on its own; HomeScreen turns this into a screen position. */
function getCelestialPosition(now: Date) {
  const hour = now.getHours() + now.getMinutes() / 60;
  const isDaytime = hour >= SUNRISE_HOUR && hour < SUNSET_HOUR;
  const daySpan = SUNSET_HOUR - SUNRISE_HOUR;
  const nightSpan = 24 - daySpan;
  const progress = isDaytime
    ? (hour - SUNRISE_HOUR) / daySpan
    : ((hour < SUNRISE_HOUR ? hour + 24 : hour) - SUNSET_HOUR) / nightSpan;
  return { isDaytime, progress: Math.min(1, Math.max(0, progress)) };
}

/** Smoothly glides a percentage value (e.g. a "top"/"left" style) toward a new target
 * whenever it changes, instead of snapping — this is what makes the sun/moon's real
 * time-of-day position actually read as continuous left-to-right motion rather than a
 * once-a-tick jump. Returns an interpolated Animated.Value usable directly as a style prop. */
function useGlidingPercent(target: number, duration: number) {
  const value = useRef(new Animated.Value(target)).current;
  useEffect(() => {
    Animated.timing(value, { toValue: target, duration, easing: Easing.linear, useNativeDriver: false }).start();
  }, [value, target, duration]);
  return value.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
}

/** A slow side-to-side sway, e.g. for a cloud drifting on the spot. */
function useSway(duration: number, distance: number) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, duration]);
  return value.interpolate({ inputRange: [0, 1], outputRange: [-distance, distance] });
}

/** A cloud drifting the full width of the screen, off-screen edge to off-screen edge, then
 * looping back to the starting side and crossing again — staggered per-cloud via an initial
 * delay so they don't all traverse the screen in lockstep. */
function useDriftAcross(duration: number, size: number, startDelay: number) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(startDelay),
      Animated.loop(
        Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
      ),
    ]);
    animation.start();
    return () => animation.stop();
  }, [value, duration, startDelay]);
  return value.interpolate({ inputRange: [0, 1], outputRange: [-size, SCREEN_WIDTH + size] });
}

/** A very slow spin for the sun's rays — just enough to feel alive, not like a pinwheel. */
function useSpin(duration: number) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [value, duration]);
  return value.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
}

/** A leaf repeatedly falling: drifts down, wobbles side to side, fades out, then resets to
 * the top invisibly and falls again — staggered per-leaf via an initial delay. */
function useFall(duration: number, fallDistance: number, startDelay: number) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(startDelay),
      Animated.loop(
        Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ),
    ]);
    animation.start();
    return () => animation.stop();
  }, [value, duration, startDelay]);
  return {
    translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, fallDistance] }),
    translateX: value.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 7, -5] }),
    rotate: value.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "50deg"] }),
    opacity: value.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
  };
}

/** A star's slow twinkle — fades between dim and bright, staggered per-star via delay. */
function useTwinkle(duration: number, startDelay: number) {
  const value = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(startDelay),
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.25, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
    ]);
    animation.start();
    return () => animation.stop();
  }, [value, duration, startDelay]);
  return value;
}

// The first three are visible all night; the rest only appear once the sky gets properly
// dark, deepest around the middle of the night span — sparse right after sunset and again
// near dawn, fullest around midnight, rather than a flat on/off count. minDarkness is
// compared against the sin-curve "how deep into the night" value computed below.
type StarConfig = {
  top: `${number}%`;
  left: `${number}%`;
  size: number;
  duration: number;
  delay: number;
  minDarkness: number;
};
const STARS: StarConfig[] = [
  { top: "4%", left: "20%", size: 12, duration: 5200, delay: 0, minDarkness: 0 },
  { top: "12%", left: "48%", size: 9, duration: 6400, delay: 1800, minDarkness: 0 },
  { top: "7%", left: "68%", size: 10, duration: 4400, delay: 3200, minDarkness: 0 },
  { top: "9%", left: "6%", size: 8, duration: 5800, delay: 900, minDarkness: 0.3 },
  { top: "3%", left: "36%", size: 7, duration: 4800, delay: 2600, minDarkness: 0.45 },
  { top: "15%", left: "80%", size: 8, duration: 6000, delay: 1200, minDarkness: 0.6 },
];

/** A rare shooting star crossing part of the sky, only at night — pure delight, no
 * functional meaning. Fires on a random 8-20s interval from a fresh random start point each
 * time, rather than a fixed repeating path. */
function useShootingStar(active: boolean) {
  const progress = useRef(new Animated.Value(0)).current;
  const [start, setStart] = useState({ top: 4, left: 15 });

  useEffect(() => {
    if (!active) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const fire = () => {
      const delay = 8000 + Math.random() * 12000;
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        setStart({ top: 2 + Math.random() * 14, left: 5 + Math.random() * 55 });
        progress.setValue(0);
        Animated.timing(progress, {
          toValue: 1,
          duration: 850,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished && !cancelled) fire();
        });
      }, delay);
    };
    fire();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [active, progress]);

  return {
    top: start.top,
    left: start.left,
    translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 90] }),
    translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }),
    opacity: progress.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
  };
}

// Both leaves fall from the same starting height near the top of the screen (like they're
// coming off the same branch), offset only horizontally — the fall distance is computed
// from this so each one actually reaches the bottom edge, regardless of device screen height.
const LEAF_START_TOP_PERCENT = 7;
const LEAF_FALL_SPEED_PX_PER_MS = 0.014;

export default function HomeScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  // Ticks every 15s (rather than theme.ts's own once-a-minute clock) specifically so the
  // sun/moon's position below has enough steps to glide smoothly instead of jumping.
  const now = useNow(15000);

  const celestial = getCelestialPosition(now);
  // The sun/moon's real position: low near the horizon at rise/set, arcing up towards the
  // top of the screen at solar noon/midnight — sin() turns the 0→1 progress into that curve.
  // Capped at 16% so even its lowest point stays clear of the (opaque) schedule card below —
  // otherwise, near rise/set, it would sit right behind the card and effectively vanish.
  const celestialTop = 16 - 16 * Math.sin(celestial.progress * Math.PI);
  const celestialLeft = 6 + 62 * celestial.progress;
  // Glides toward each new position over the same 15s the clock ticks at, so the motion
  // reads as one continuous left-to-right sweep across the day (or night) instead of a
  // once-a-minute snap — a symmetric idle jitter would otherwise fight against and mask
  // that sense of steady one-directional progress.
  const celestialTopAnim = useGlidingPercent(celestialTop, 15000);
  const celestialLeftAnim = useGlidingPercent(celestialLeft, 15000);
  const sunSpin = useSpin(180000);
  // How deep into the night it is — 0 right at sunset/sunrise (still twilight), peaking at 1
  // around the middle of the night span — drives how many stars show and how bright.
  const nightDarkness = celestial.isDaytime ? 0 : Math.sin(celestial.progress * Math.PI);
  // One explicit useTwinkle call per STARS entry — called directly (not via .map) so the
  // number of hook calls is visibly fixed, not just fixed in practice.
  const starTwinkles = [
    useTwinkle(STARS[0].duration, STARS[0].delay),
    useTwinkle(STARS[1].duration, STARS[1].delay),
    useTwinkle(STARS[2].duration, STARS[2].delay),
    useTwinkle(STARS[3].duration, STARS[3].delay),
    useTwinkle(STARS[4].duration, STARS[4].delay),
    useTwinkle(STARS[5].duration, STARS[5].delay),
  ];
  const shootingStar = useShootingStar(!celestial.isDaytime);

  const cloud1X = useDriftAcross(28000, 92, 0);
  const cloud2X = useDriftAcross(36000, 68, 7000);
  const cloud3X = useDriftAcross(22000, 56, 14000);

  const leafFallDistance = ((100 - LEAF_START_TOP_PERCENT) / 100) * SCREEN_HEIGHT;
  const leafDuration = leafFallDistance / LEAF_FALL_SPEED_PX_PER_MS;
  const leaf1 = useFall(leafDuration, leafFallDistance, 0);
  const leaf2 = useFall(leafDuration, leafFallDistance, 1800);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* A real sky behind the content — real vector glyphs (already in the icon set the
          app uses everywhere else) instead of hand-built shapes, so they actually look
          designed rather than pasted-on clip art. Purely decorative: renders behind the
          ScrollView (transparent background) and never intercepts touches. The sun/moon's
          position tracks the real clock (low at rise/set, high at noon/midnight); clouds
          sway and leaves fall on their own independent loops so the sky reads as alive. */}
      <Animated.View
        style={[
          styles.celestial,
          {
            top: celestialTopAnim,
            left: celestialLeftAnim,
          },
        ]}
        pointerEvents="none"
      >
        {/* A halo behind the icon — without it, the sun's own yellow-orange can nearly vanish
            against a similarly warm sky (e.g. the evening peach background), since both sit
            in the same hue family. During the day it's a bright, mostly-white disc for
            contrast; at night it's a much dimmer, cool-toned glow — a bright white spotlight
            behind the moon reads as a stage light, not moonlight. */}
        {celestial.isDaytime ? (
          <View style={styles.celestialHaloDay}>
            <Animated.View style={{ transform: [{ rotate: sunSpin }] }}>
              <Ionicons name="sunny" size={100} color="#ffb300" />
            </Animated.View>
          </View>
        ) : (
          <View style={styles.celestialHaloNight}>
            <Ionicons name="moon" size={72} color="#e4ecf7" />
          </View>
        )}
      </Animated.View>
      {!celestial.isDaytime &&
        STARS.map((star, i) =>
          nightDarkness < star.minDarkness ? null : (
            <Animated.View
              key={i}
              style={[
                styles.starPosition,
                { top: star.top, left: star.left, opacity: Animated.multiply(starTwinkles[i], nightDarkness) },
              ]}
              pointerEvents="none"
            >
              <Ionicons name="star" size={star.size} color="#eaf2fb" />
            </Animated.View>
          ),
        )}
      {!celestial.isDaytime && (
        <Animated.View
          style={[
            styles.shootingStar,
            {
              top: `${shootingStar.top}%`,
              left: `${shootingStar.left}%`,
              opacity: shootingStar.opacity,
              transform: [
                { translateX: shootingStar.translateX },
                { translateY: shootingStar.translateY },
                { rotate: "25deg" },
              ],
            },
          ]}
          pointerEvents="none"
        />
      )}
      <Animated.View style={[styles.cloud1, { transform: [{ translateX: cloud1X }] }]} pointerEvents="none">
        <Ionicons name="cloud" size={92} color="#ffffff" />
      </Animated.View>
      <Animated.View style={[styles.cloud2, { transform: [{ translateX: cloud2X }] }]} pointerEvents="none">
        <Ionicons name="cloud" size={68} color="#ffffff" />
      </Animated.View>
      <Animated.View style={[styles.cloud3, { transform: [{ translateX: cloud3X }] }]} pointerEvents="none">
        <Ionicons name="cloud" size={56} color="#ffffff" />
      </Animated.View>
      <Animated.View
        style={[
          styles.leaf1,
          {
            opacity: leaf1.opacity,
            transform: [{ translateY: leaf1.translateY }, { translateX: leaf1.translateX }, { rotate: leaf1.rotate }],
          },
        ]}
        pointerEvents="none"
      >
        <Ionicons name="leaf" size={30} color="#4f8f4a" />
      </Animated.View>
      <Animated.View
        style={[
          styles.leaf2,
          {
            opacity: leaf2.opacity,
            transform: [
              { translateY: leaf2.translateY },
              { translateX: leaf2.translateX },
              { rotate: "140deg" },
              { rotate: leaf2.rotate },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <Ionicons name="leaf" size={24} color="#4f8f4a" />
      </Animated.View>

      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Bruno's Alarm</Text>
                <Text style={styles.titleEmoji}>🐕🌙</Text>
              </View>
              <Text style={styles.subtitle}>A real dog. Two alarms a day. Never once late.</Text>
            </View>
            <Pressable
              style={styles.settingsButton}
              onPress={() => navigation.navigate("Settings")}
              hitSlop={12}
            >
              <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.section}>
            <SchedulePattern />
          </View>

          <View style={styles.section}>
            <NotifyToggle />
          </View>

          <Pressable style={styles.customAlarmRow} onPress={() => navigation.navigate("CustomAlarm")}>
            <View style={styles.customAlarmLeft}>
              <Ionicons name="alarm-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.customAlarmText}>Set your own alarm time</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* A quiet closing mark, not more content — gives the page a deliberate bottom
            edge instead of trailing off into empty space below the last real control. */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <Ionicons name="paw" size={14} color={colors.textSecondary} />
          <Text style={styles.footerText}>No filters. No edits. Just Bruno.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    // top/left are set inline per-render from the real clock (see celestialTop/Left above)
    // rather than fixed here.
    celestial: {
      position: "absolute",
    },
    celestialHaloDay: {
      width: 132,
      height: 132,
      borderRadius: 66,
      backgroundColor: "rgba(255,255,255,0.4)",
      alignItems: "center",
      justifyContent: "center",
    },
    celestialHaloNight: {
      width: 108,
      height: 108,
      borderRadius: 54,
      backgroundColor: "rgba(200,215,240,0.14)",
      alignItems: "center",
      justifyContent: "center",
    },
    // top/left come from each STARS entry inline; this just fixes the position mode.
    starPosition: {
      position: "absolute",
    },
    shootingStar: {
      position: "absolute",
      width: 46,
      height: 2,
      borderRadius: 1,
      backgroundColor: "#eaf2fb",
    },
    // left: 0 anchors each cloud at the screen's left edge; useDriftAcross's translateX then
    // carries it the full width, off one side and back in from the other.
    cloud1: {
      position: "absolute",
      top: "60%",
      left: 0,
    },
    cloud2: {
      position: "absolute",
      top: "69%",
      left: 0,
    },
    cloud3: {
      position: "absolute",
      top: "77%",
      left: 0,
    },
    // Same top for both — they fall from the same height, just offset horizontally so they
    // don't overlap.
    leaf1: {
      position: "absolute",
      top: `${LEAF_START_TOP_PERCENT}%`,
      right: "26%",
    },
    leaf2: {
      position: "absolute",
      top: `${LEAF_START_TOP_PERCENT}%`,
      left: "10%",
    },
    content: {
      flexGrow: 1,
      justifyContent: "space-between",
      padding: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.xxl - spacing.xs,
      gap: spacing.md,
    },
    headerTitleWrap: {
      flex: 1,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.display,
      fontSize: 26,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 3,
    },
    titleEmoji: {
      fontSize: 22,
      marginBottom: 3,
    },
    subtitle: {
      color: colors.textSecondary,
      fontFamily: fonts.hand,
      fontSize: 17,
    },
    settingsButton: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    section: {
      marginBottom: spacing.lg,
    },
    customAlarmRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
    },
    customAlarmLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    customAlarmText: {
      color: colors.textPrimary,
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
    },
    footer: {
      alignItems: "center",
      gap: spacing.sm,
      paddingTop: spacing.xl,
    },
    footerDivider: {
      width: 32,
      height: 1,
      backgroundColor: colors.border,
      marginBottom: spacing.xs,
    },
    footerText: {
      color: colors.textSecondary,
      fontFamily: fonts.hand,
      fontSize: 16,
    },
  });
}
