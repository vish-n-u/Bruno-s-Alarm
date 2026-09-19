import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { WeatherCondition } from "../lib/weather";

// Extracted out of HomeScreen so the exact same decorative rendering can be driven by a real
// clock + real weather (HomeScreen) or by a debug slider's chosen values (screens/
// WeatherPreviewScreen.tsx) — one implementation, never two copies that can drift apart.
// Purely decorative: renders behind whatever the caller stacks on top of it and never
// intercepts touches.

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SCREEN_WIDTH = Dimensions.get("window").width;

// Same dawn/midday/sunset/night window used for the color theme (lib/theme.ts) — kept as
// plain hour numbers here rather than imported, since this is about the sun/moon's position
// in an arc, not which palette is active.
const SUNRISE_HOUR = 5;
const SUNSET_HOUR = 18.5;

/** Where the sun (daytime) or moon (nighttime) actually sits right now: which body is up,
 * and how far along its arc from horizon to horizon — 0 at rise, 1 at set. Pure function of
 * the given clock time, not animated on its own; Sky turns this into a screen position. */
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

/** Whether the sun (vs. the moon) would be showing at the given time — exported so a caller
 * like screens/WeatherPreviewScreen.tsx can tint its own UI (e.g. the time slider) to match,
 * without duplicating the sunrise/sunset math. */
export function isDaytimeAt(now: Date): boolean {
  return getCelestialPosition(now).isDaytime;
}

// The sun/moon's own colors, reused for the time slider's day/night tint in the debug
// preview screen so that control actually looks connected to what it's previewing.
export const DAYTIME_TINT = "#ffb300";
export const NIGHTTIME_TINT = "#8ea9c9";

/** Smoothly glides a percentage value (e.g. a "top"/"left" style) toward a new target
 * whenever it changes, instead of snapping — this is what makes the sun/moon's position
 * read as continuous left-to-right motion rather than a once-a-tick jump. Returns an
 * interpolated Animated.Value usable directly as a style prop. */
function useGlidingPercent(target: number, duration: number) {
  const value = useRef(new Animated.Value(target)).current;
  useEffect(() => {
    Animated.timing(value, { toValue: target, duration, easing: Easing.linear, useNativeDriver: false }).start();
  }, [value, target, duration]);
  return value.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
}

/** A cloud drifting the full width of the screen, off-screen edge to off-screen edge, then
 * looping back to the starting side and crossing again — staggered per-cloud via an initial
 * delay so they don't all traverse the screen in lockstep. */
function useDriftAcross(duration: number, size: number, startDelay: number) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(startDelay),
      Animated.loop(Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true })),
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
    const loop = Animated.loop(Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [value, duration]);
  return value.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
}

/** A leaf/flake repeatedly falling: drifts down, wobbles side to side, fades out, then
 * resets to the top invisibly and falls again — staggered per-item via an initial delay. */
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

// Positions for the rain/snow "hint" overlays — a fixed, hand-placed set rather than
// randomly generated each render, same reasoning as STARS below.
type PrecipConfig = { left: `${number}%`; size: number; duration: number; delay: number };
// `size` is a streak length for rain, an icon size for snow — a plain thin tilted line reads
// as falling rain at a glance, where a "water" glyph (a static, rounded teardrop) just looked
// like floating drops sitting in place. More drops than the first pass, and each one's
// rendered as a soft "glow" behind a brighter "core" (see the render below) rather than one
// flat rectangle — a single flat tint read as a stray tally mark, not rain.
const RAIN_DROPS: PrecipConfig[] = [
  { left: "4%", size: 20, duration: 650, delay: 0 },
  { left: "15%", size: 24, duration: 560, delay: 150 },
  { left: "27%", size: 17, duration: 700, delay: 500 },
  { left: "38%", size: 22, duration: 610, delay: 300 },
  { left: "49%", size: 19, duration: 680, delay: 80 },
  { left: "60%", size: 25, duration: 590, delay: 350 },
  { left: "71%", size: 18, duration: 660, delay: 420 },
  { left: "83%", size: 23, duration: 580, delay: 220 },
  { left: "93%", size: 20, duration: 630, delay: 100 },
];
// The fixed tilt every rain streak is rotated by — see useRainFall's doc for why this isn't
// also paired with a proportional translateX.
const RAIN_TILT_DEG = 12;
const SNOW_FLAKES: PrecipConfig[] = [
  { left: "10%", size: 14, duration: 4200, delay: 0 },
  { left: "26%", size: 10, duration: 5200, delay: 900 },
  { left: "44%", size: 16, duration: 3800, delay: 1800 },
  { left: "60%", size: 11, duration: 4800, delay: 500 },
  { left: "76%", size: 15, duration: 4400, delay: 2400 },
  { left: "90%", size: 10, duration: 5000, delay: 1300 },
];

/** A raindrop falling fast, fading out near the bottom, then resetting to the top and
 * falling again — staggered per-drop via delay. The wind-blown angle comes entirely from
 * the streak's own static `rotate` (applied where this is used), not from also translating
 * it sideways: an earlier version tried a proportional translateX here and it looked like
 * streaks were flying wildly off in every direction rather than falling — the rotate alone
 * already reads as "windswept" without needing real diagonal travel. Storm reuses this with
 * more drops and shorter durations rather than a separate effect, since the visual
 * difference that actually reads at a glance is "how much rain," not a distinct animation. */
function useRainFall(duration: number, fallDistance: number, startDelay: number) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(startDelay),
      Animated.loop(Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true })),
    ]);
    animation.start();
    return () => animation.stop();
  }, [value, duration, startDelay]);
  return {
    translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, fallDistance] }),
    opacity: value.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0.9, 0.9, 0] }),
  };
}

/** A brief double-flash of the whole sky, at a random 4-10s interval — the one hint that
 * actually reads as "storm" rather than just "rain," since otherwise storm only differs
 * from rain by being a bit denser/faster, which doesn't read clearly at a glance. */
function useLightningFlash(active: boolean) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const fire = () => {
      const delay = 4000 + Math.random() * 6000;
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.5, duration: 55, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 110, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.3, duration: 50, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start(({ finished }) => {
          if (finished && !cancelled) fire();
        });
      }, delay);
    };
    fire();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [active, opacity]);
  return opacity;
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
type StarConfig = { top: `${number}%`; left: `${number}%`; size: number; duration: number; delay: number; minDarkness: number };
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

type Props = {
  now: Date;
  /** `null` is treated exactly like "clear" — see lib/weather.ts. */
  weatherCondition: WeatherCondition | null;
};

export default function Sky({ now, weatherCondition }: Props) {
  const celestial = getCelestialPosition(now);
  // The sun/moon's position: low near the horizon at rise/set, arcing up towards the top of
  // the screen at solar noon/midnight — sin() turns the 0→1 progress into that curve. Capped
  // at 16% so even its lowest point stays clear of the (opaque) schedule card below — other-
  // wise, near rise/set, it would sit right behind the card and effectively vanish.
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

  const cloud1X = useDriftAcross(50000, 92, 0);
  const cloud2X = useDriftAcross(65000, 68, 7000);
  const cloud3X = useDriftAcross(40000, 56, 14000);

  const isStorm = weatherCondition === "storm";
  const isCloudy = weatherCondition === "cloudy";
  const isSnow = weatherCondition === "snow";
  const showRain = weatherCondition === "rain" || isStorm;
  const showSnow = isSnow;
  const showFog = weatherCondition === "fog";
  // Storm reuses the rain drops but faster, rather than a separate animation — see
  // useRainFall's own doc for why.
  const rainSpeedFactor = isStorm ? 0.55 : 1;
  const lightningFlash = useLightningFlash(isStorm);
  // Distinctly darker/greyer than "clear," not just a slightly-off-white — the first pass
  // used a near-white that was nearly indistinguishable from clear at a glance.
  const cloudColor = showRain ? "#8b96a1" : isCloudy || isSnow || showFog ? "#c3cad1" : "#ffffff";
  // A soft dimming wash behind the clouds — this, not the cloud tint alone, is what actually
  // makes "cloudy" read as a different sky rather than "clear" with slightly duller clouds.
  // Storm gets the heaviest wash so it reads as visibly darker/heavier than plain rain even
  // before the lightning flash or denser drops register.
  const overcastOpacity = isStorm ? 0.28 : showRain ? 0.16 : isCloudy || isSnow ? 0.11 : 0;
  // Fixed hook-call count regardless of whether rain is actually showing right now — same
  // convention as starTwinkles above.
  const rainDrops = [
    useRainFall(RAIN_DROPS[0].duration * rainSpeedFactor, SCREEN_HEIGHT, RAIN_DROPS[0].delay),
    useRainFall(RAIN_DROPS[1].duration * rainSpeedFactor, SCREEN_HEIGHT, RAIN_DROPS[1].delay),
    useRainFall(RAIN_DROPS[2].duration * rainSpeedFactor, SCREEN_HEIGHT, RAIN_DROPS[2].delay),
    useRainFall(RAIN_DROPS[3].duration * rainSpeedFactor, SCREEN_HEIGHT, RAIN_DROPS[3].delay),
    useRainFall(RAIN_DROPS[4].duration * rainSpeedFactor, SCREEN_HEIGHT, RAIN_DROPS[4].delay),
    useRainFall(RAIN_DROPS[5].duration * rainSpeedFactor, SCREEN_HEIGHT, RAIN_DROPS[5].delay),
    useRainFall(RAIN_DROPS[6].duration * rainSpeedFactor, SCREEN_HEIGHT, RAIN_DROPS[6].delay),
    useRainFall(RAIN_DROPS[7].duration * rainSpeedFactor, SCREEN_HEIGHT, RAIN_DROPS[7].delay),
    useRainFall(RAIN_DROPS[8].duration * rainSpeedFactor, SCREEN_HEIGHT, RAIN_DROPS[8].delay),
  ];
  const snowFlakes = [
    useFall(SNOW_FLAKES[0].duration, SCREEN_HEIGHT, SNOW_FLAKES[0].delay),
    useFall(SNOW_FLAKES[1].duration, SCREEN_HEIGHT, SNOW_FLAKES[1].delay),
    useFall(SNOW_FLAKES[2].duration, SCREEN_HEIGHT, SNOW_FLAKES[2].delay),
    useFall(SNOW_FLAKES[3].duration, SCREEN_HEIGHT, SNOW_FLAKES[3].delay),
    useFall(SNOW_FLAKES[4].duration, SCREEN_HEIGHT, SNOW_FLAKES[4].delay),
    useFall(SNOW_FLAKES[5].duration, SCREEN_HEIGHT, SNOW_FLAKES[5].delay),
  ];

  const leafFallDistance = ((100 - LEAF_START_TOP_PERCENT) / 100) * SCREEN_HEIGHT;
  const leafDuration = leafFallDistance / LEAF_FALL_SPEED_PX_PER_MS;
  const leaf1 = useFall(leafDuration, leafFallDistance, 0);
  const leaf2 = useFall(leafDuration, leafFallDistance, 1800);

  return (
    <>
      {/* A halo behind the icon — without it, the sun's own yellow-orange can nearly vanish
          against a similarly warm sky (e.g. the evening peach background), since both sit in
          the same hue family. During the day it's a bright, mostly-white disc for contrast;
          at night it's a much dimmer, cool-toned glow — a bright white spotlight behind the
          moon reads as a stage light, not moonlight. */}
      <Animated.View
        style={[styles.celestial, { top: celestialTopAnim, left: celestialLeftAnim }]}
        pointerEvents="none"
      >
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
        <Ionicons name="cloud" size={92} color={cloudColor} />
      </Animated.View>
      <Animated.View style={[styles.cloud2, { transform: [{ translateX: cloud2X }] }]} pointerEvents="none">
        <Ionicons name="cloud" size={68} color={cloudColor} />
      </Animated.View>
      <Animated.View style={[styles.cloud3, { transform: [{ translateX: cloud3X }] }]} pointerEvents="none">
        <Ionicons name="cloud" size={56} color={cloudColor} />
      </Animated.View>
      {overcastOpacity > 0 && (
        <View style={[styles.overcastHaze, { opacity: overcastOpacity }]} pointerEvents="none" />
      )}
      {isStorm && <Animated.View style={[styles.lightningFlash, { opacity: lightningFlash }]} pointerEvents="none" />}
      {showRain &&
        RAIN_DROPS.map((drop, i) => (
          <Animated.View
            key={i}
            style={[
              styles.rainDropWrap,
              {
                left: drop.left,
                opacity: rainDrops[i].opacity,
                transform: [{ translateY: rainDrops[i].translateY }, { rotate: `${RAIN_TILT_DEG}deg` }],
              },
            ]}
            pointerEvents="none"
          >
            {/* A wider, dimmer "glow" behind a thin, brighter "core" — one flat rectangle read
                as a stray tally mark; this pairing is what actually reads as a wet streak of
                light catching a falling drop. */}
            <View
              style={[
                styles.rainGlow,
                { height: drop.size + 8, backgroundColor: isStorm ? "rgba(110,124,136,0.35)" : "rgba(148,175,196,0.35)" },
              ]}
            />
            <View
              style={[
                styles.rainCore,
                { height: drop.size, backgroundColor: isStorm ? "rgba(195,204,212,0.9)" : "rgba(214,232,244,0.92)" },
              ]}
            />
          </Animated.View>
        ))}
      {showSnow &&
        SNOW_FLAKES.map((flake, i) => (
          <Animated.View
            key={i}
            style={[
              styles.snowFlake,
              {
                left: flake.left,
                opacity: snowFlakes[i].opacity,
                transform: [
                  { translateY: snowFlakes[i].translateY },
                  { translateX: snowFlakes[i].translateX },
                  { rotate: snowFlakes[i].rotate },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <Ionicons name="snow" size={flake.size} color="#eaf3fb" />
          </Animated.View>
        ))}
      {showFog && <View style={styles.fogHaze} pointerEvents="none" />}
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
    </>
  );
}

const styles = StyleSheet.create({
  // top/left are set inline per-render from `now` (see celestialTop/Left above) rather than
  // fixed here.
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
  // The wrap only sets position — its glow/core children are absolutely positioned within
  // it (so their own `left` centers them; a parent `alignItems` would have no effect on
  // absolutely-positioned children) and share its height via their own `height`.
  rainDropWrap: {
    position: "absolute",
    top: 0,
    width: 6,
  },
  rainGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 6,
    borderRadius: 3,
  },
  rainCore: {
    position: "absolute",
    top: 0,
    left: 2,
    width: 2,
    borderRadius: 1,
  },
  snowFlake: {
    position: "absolute",
    top: 0,
  },
  // A low-opacity wash over the whole decorative layer (rendered above the sky/clouds but
  // still behind whatever opaque content the caller stacks on top), just enough to soften
  // contrast so the sky reads as hazy rather than perfectly clear.
  fogHaze: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  // A cooler, darker wash than fogHaze — dims the whole sky rather than whitening it, which
  // is what actually distinguishes "overcast" from "hazy." Storm reuses this at a heavier
  // opacity rather than a separate style, since it's the same effect turned up.
  overcastHaze: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(35,42,52,1)",
  },
  lightningFlash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#f4f6ff",
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
});
