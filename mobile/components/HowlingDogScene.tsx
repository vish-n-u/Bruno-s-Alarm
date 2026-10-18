import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from "react-native-svg";
import { fonts } from "../lib/theme";

// The About screen's story as a flat, outline-style drawing seen from high up and far away on
// a warm morning: paddy fields stretch to the horizon, a small church stands far off, Bruno
// walks along the dirt path between the fields, the church bell rings, he stops and howls at
// it, then walks on. Fixed sunrise colours (not the app theme) — it's always his morning.
//
// Each moving part (legs, tail, head, the bell, the "ding" marks) is its own small Svg inside
// an Animated.View, and everything runs off ONE timeline value on the native driver.

const LOOP_S = 11;
const WALK_IN: [number, number] = [0, 3.4];
const BELL: [number, number] = [3.8, 5.8];
const HOWL: [number, number] = [5, 8.2];
const WALK_OUT: [number, number] = [8.6, LOOP_S];
const STEP_S = 0.55;

export const SKY = "#fde5cc";
export const GROUND = "#f3d3a8";
export const INK = "#5a3a24";
export const ORANGE = "#e8743a";
const FAINT_INK = "rgba(90,58,36,0.4)";
const BUND = "rgba(90,58,36,0.35)";
// Parts are "filled" with the sky colour only so overlapping lines hide — it reads as outline.
const FILL = SKY;
const SUN_FILL = "#fcc690";
const SUN_LINE = "#ee8a46";
const PADDY = ["#cfe2a2", "#bdd78e", "#dbe9c4"]; // two greens and a flooded, watery plot
const TUFT = "#7fa65a";
const STROKE = 2.6;

const DOG_W = 200;
const DOG_H = 130;
const PAW_Y = 124; // where his paws are in the 200×130 drawing

const at = (s: number) => s / LOOP_S;

/** Rest value, except during `segments`, where it swings between rest ± amp every half period. */
function zigzag(segments: [number, number][], period: number, amp: number, rest = 0) {
  const inputRange: number[] = [0];
  const outputRange: number[] = [rest];
  for (const [start, end] of segments) {
    inputRange.push(at(start));
    outputRange.push(rest);
    let sign = 1;
    for (let s = start + period / 4; s < end - period / 4; s += period / 2) {
      inputRange.push(at(s));
      outputRange.push(rest + sign * amp);
      sign = -sign;
    }
    inputRange.push(at(end));
    outputRange.push(rest);
  }
  inputRange.push(1);
  outputRange.push(rest);
  return { inputRange, outputRange };
}

function swing(segments: [number, number][], period: number, amp: number, rest = 0) {
  const { inputRange, outputRange } = zigzag(segments, period, amp, rest);
  return { inputRange, outputRange: outputRange.map((d) => `${d}deg`) };
}

/** 0 until `from`, eases to `peak`, holds, back to 0 by `to`. */
function hold(from: number, to: number, peak: number, ramp = 0.35) {
  return {
    inputRange: [0, at(from), at(from + ramp), at(to - ramp), at(to), 1],
    outputRange: [0, 0, peak, peak, 0, 0],
  };
}

function Leg({ far }: { far?: boolean }) {
  const color = far ? FAINT_INK : INK;
  return (
    <Svg width={16} height={62}>
      <Line x1={8} y1={2} x2={8} y2={56} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1={8} y1={56} x2={13} y2={56} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

/** Paddy plots in perspective from the horizon down to `bottom`: rows get deeper toward the
 * viewer, bund lines run toward a vanishing point above the horizon, rice tufts in the plots. */
function PaddyFields({ width, top, bottom }: { width: number; top: number; bottom: number }) {
  const shapes = useMemo(() => {
    const rows = 6;
    const cols = 9;
    const vx = width * 0.55;
    const vy = top - (bottom - top) * 0.6;
    const rowY = (k: number) => top + (bottom - top) * Math.pow(k / rows, 1.5);
    const xAt = (j: number, y: number) => {
      const xb = -width * 0.9 + (j * width * 2.8) / cols; // where the line meets `bottom`
      return vx + (xb - vx) * ((y - vy) / (bottom - vy));
    };
    const plots: { points: string; fill: string }[] = [];
    const tufts: { x: number; y: number; s: number }[] = [];
    for (let k = 0; k < rows; k++) {
      const y0 = rowY(k);
      const y1 = rowY(k + 1);
      for (let j = 0; j < cols; j++) {
        const kind = (k * 2 + j * 3) % 3;
        const pts = [
          [xAt(j, y0), y0],
          [xAt(j + 1, y0), y0],
          [xAt(j + 1, y1), y1],
          [xAt(j, y1), y1],
        ];
        plots.push({ points: pts.map((p) => p.join(",")).join(" "), fill: PADDY[kind] });
        // Rice tufts, bigger nearer the viewer; none on the flooded plots.
        if (kind !== 2 && k >= 1) {
          const cy = (y0 + y1) / 2 + (y1 - y0) * 0.2;
          const cx = (xAt(j, cy) + xAt(j + 1, cy)) / 2;
          const s = 2 + (k / rows) * 7;
          const spread = (xAt(j + 1, cy) - xAt(j, cy)) * 0.25;
          tufts.push({ x: cx - spread, y: cy, s }, { x: cx + spread, y: cy, s });
        }
      }
    }
    const rowLines = Array.from({ length: rows + 1 }, (_, k) => rowY(k));
    const colLines = Array.from({ length: cols + 1 }, (_, j) => [xAt(j, top), top, xAt(j, bottom), bottom]);
    return { plots, tufts, rowLines, colLines };
  }, [width, top, bottom]);

  return (
    <G>
      {shapes.plots.map((p, i) => (
        <Polygon key={i} points={p.points} fill={p.fill} />
      ))}
      {shapes.rowLines.map((y, i) => (
        <Line key={`r${i}`} x1={0} y1={y} x2={width} y2={y} stroke={BUND} strokeWidth={1.2} />
      ))}
      {shapes.colLines.map(([x1, y1, x2, y2], i) => (
        <Line key={`c${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={BUND} strokeWidth={1.2} />
      ))}
      {shapes.tufts.map((tf, i) => (
        <Path
          key={`t${i}`}
          d={`M${tf.x - tf.s * 0.6} ${tf.y - tf.s} L${tf.x} ${tf.y} L${tf.x + tf.s * 0.6} ${tf.y - tf.s} M${tf.x} ${tf.y} L${tf.x} ${tf.y - tf.s * 1.2}`}
          stroke={TUFT}
          strokeWidth={1.3}
          strokeLinecap="round"
          fill="none"
        />
      ))}
    </G>
  );
}

export default function HowlingDogScene({
  height = 180,
  dogScale = 0.5,
  rounded = true,
}: {
  height?: number;
  /** Bruno is drawn at 200×130 and shown at this scale. */
  dogScale?: number;
  /** Rounded card corners (false: full-bleed, e.g. the whole About screen). */
  rounded?: boolean;
}) {
  const SCALE = dogScale;
  // Scaling is about the dog's centre, so his visible box is inset by this much sideways.
  const INSET_X = (DOG_W * (1 - SCALE)) / 2;
  const [width, setWidth] = useState(360);
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: LOOP_S * 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  // A high camera: the horizon sits well up, the land below it.
  const horizonY = Math.round(height * 0.32);
  const pathTop = Math.round(height * 0.74);
  const pathBottom = Math.round(height * 0.84);
  const pawY = pathTop + (pathBottom - pathTop) * 0.62;
  const dogTop = pawY - DOG_H / 2 - (PAW_Y - DOG_H / 2) * SCALE;
  const walking: [number, number][] = [WALK_IN, WALK_OUT];

  // Straight along the path, left to right, stopping a little left of centre.
  const shownW = DOG_W * SCALE;
  const stopLeft = width * 0.28;
  const dogX = t.interpolate({
    inputRange: [0, at(WALK_IN[1]), at(WALK_OUT[0]), 1],
    outputRange: [-shownW - 10 - INSET_X, stopLeft - INSET_X, stopLeft - INSET_X, width + 10 - INSET_X],
  });
  const bob = t.interpolate(zigzag(walking, STEP_S / 2, 1.5));
  const legA = t.interpolate(swing(walking, STEP_S, 22));
  const legB = t.interpolate(swing(walking, STEP_S, -22));
  const tail = t.interpolate(swing(walking, 0.4, 8));
  const headRange = hold(HOWL[0], HOWL[1], -34);
  const headUp = t.interpolate({ ...headRange, outputRange: headRange.outputRange.map((d) => `${d}deg`) });
  const mouth = t.interpolate(hold(HOWL[0] + 0.3, HOWL[1] - 0.2, 1, 0.15));

  // The far church, small on the horizon; its bell swings and "ding" marks flare out.
  const CHURCH = 0.55;
  const churchX = width * 0.8;
  const sunX = width * 0.6;
  const bell = t.interpolate({
    inputRange: [0, at(BELL[0]), at(BELL[0] + 0.3), at(BELL[0] + 0.7), at(BELL[0] + 1.1), at(BELL[0] + 1.5), at(BELL[1]), 1],
    outputRange: ["0deg", "0deg", "24deg", "-20deg", "14deg", "-8deg", "0deg", "0deg"],
  });
  const ding = (delay: number) => ({
    opacity: t.interpolate({
      inputRange: [0, at(BELL[0] + delay), at(BELL[0] + delay + 0.1), at(BELL[0] + delay + 0.9), 1],
      outputRange: [0, 0, 1, 0, 0],
    }),
    transform: [
      {
        scale: t.interpolate({
          inputRange: [0, at(BELL[0] + delay), at(BELL[0] + delay + 0.9), 1],
          outputRange: [0.6, 0.6, 1.3, 1.3],
        }),
      },
    ],
  });

  return (
    <View
      style={[styles.scene, rounded && styles.rounded, { height, backgroundColor: SKY }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {/* Low sun, half-risen; a few far birds; faint far hills. */}
        <Circle cx={sunX} cy={horizonY} r={24} fill={SUN_FILL} stroke={SUN_LINE} strokeWidth={2} />
        {[-60, -30, 0, 30, 60].map((deg) => {
          const rad = ((deg - 90) * Math.PI) / 180;
          return (
            <Line
              key={deg}
              x1={sunX + Math.cos(rad) * 31}
              y1={horizonY + Math.sin(rad) * 31}
              x2={sunX + Math.cos(rad) * 40}
              y2={horizonY + Math.sin(rad) * 40}
              stroke={SUN_LINE}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
        {[
          // low in the sky, clear of anything a screen puts at the top
          [0.1, 0.27, 6],
          [0.17, 0.25, 4],
          [0.9, 0.24, 5],
        ].map(([fx, fy, s], i) => {
          const x = width * fx;
          const y = height * fy;
          return (
            <Path
              key={`b${i}`}
              d={`M${x - s} ${y} Q${x - s / 2} ${y - s / 2} ${x} ${y} Q${x + s / 2} ${y - s / 2} ${x + s} ${y}`}
              stroke={INK}
              strokeWidth={1.4}
              fill="none"
              strokeLinecap="round"
            />
          );
        })}
        <Path
          d={`M0 ${horizonY - 3} Q ${width * 0.2} ${horizonY - 14} ${width * 0.42} ${horizonY - 1}`}
          stroke={FAINT_INK}
          strokeWidth={1.4}
          fill="none"
        />

        {/* Land: paddy fields to the horizon, the dirt path, a strip of field in front. */}
        <Rect x={0} y={horizonY} width={width} height={height - horizonY} fill={GROUND} />
        <PaddyFields width={width} top={horizonY} bottom={pathTop} />
        <Rect x={0} y={pathTop} width={width} height={pathBottom - pathTop} fill={GROUND} />
        <Line x1={0} y1={pathTop} x2={width} y2={pathTop} stroke={INK} strokeWidth={1.4} />
        <Line x1={0} y1={pathBottom} x2={width} y2={pathBottom} stroke={INK} strokeWidth={1.4} />
        <Rect x={0} y={pathBottom} width={width} height={height - pathBottom} fill={PADDY[1]} />
        {Array.from({ length: Math.ceil(width / 34) }, (_, i) => {
          const x = 14 + i * 34;
          const y = pathBottom + (height - pathBottom) * 0.55;
          return (
            <Path
              key={`f${i}`}
              d={`M${x - 6} ${y - 10} L${x} ${y} L${x + 6} ${y - 10} M${x} ${y} L${x} ${y - 13}`}
              stroke={TUFT}
              strokeWidth={1.5}
              strokeLinecap="round"
              fill="none"
            />
          );
        })}
        <Line x1={0} y1={horizonY} x2={width} y2={horizonY} stroke={INK} strokeWidth={1.4} />

        {/* The far-off church on the horizon. */}
        <G transform={`translate(${churchX} ${horizonY}) scale(${CHURCH})`}>
          <Path d="M0 0 V-30 H18 V0 M18 -14 H40 V0" stroke={INK} strokeWidth={2.4} fill={FILL} />
          <Path d="M-3 -30 L9 -44 L21 -30 Z M16 -14 L29 -24 L43 -14" stroke={INK} strokeWidth={2.4} fill={FILL} strokeLinejoin="round" />
          <Line x1={9} y1={-44} x2={9} y2={-53} stroke={INK} strokeWidth={2.4} />
          <Line x1={5} y1={-49} x2={13} y2={-49} stroke={INK} strokeWidth={2.4} />
          <Path d="M4 -17 V-25 Q9 -30 14 -25 V-17" stroke={INK} strokeWidth={2} fill="none" />
          <Path d="M26 0 V-7 Q29 -10 32 -7 V0" stroke={INK} strokeWidth={2} fill="none" />
        </G>
      </Svg>

      {/* The bell, swinging in the tower's opening. */}
      <Animated.View
        style={[
          styles.bell,
          {
            left: churchX + 5 * CHURCH - 4 * (1 - CHURCH),
            top: horizonY - 25 * CHURCH - 4 * (1 - CHURCH),
            transform: [{ scale: CHURCH }, { rotate: bell }],
          },
        ]}
      >
        <Svg width={8} height={8}>
          <Path d="M1 7 Q1 1 4 1 Q7 1 7 7 Z" fill={ORANGE} />
        </Svg>
      </Animated.View>
      {/* "ding" marks flaring out to the left of the church, toward Bruno. */}
      {[0, 0.5].map((delay, i) => (
        <Animated.View
          key={i}
          style={[styles.ding, { left: churchX - 16 - i * 8, top: horizonY - 30 - i * 3 }, ding(delay)]}
        >
          <Svg width={14} height={22}>
            <Path d="M11 3 Q4 11 11 19" stroke={ORANGE} strokeWidth={2} fill="none" strokeLinecap="round" />
          </Svg>
        </Animated.View>
      ))}

      {/* Bruno: a lean street dog — deep chest, tucked belly, long legs, curled tail, tall
          pointy ears. Drawn at 200×130, shown scaled. */}
      <Animated.View
        style={[styles.dog, { top: dogTop, transform: [{ translateX: dogX }, { translateY: bob }, { scale: SCALE }] }]}
      >
        {/* far legs, fainter, behind the body */}
        <Animated.View style={[styles.leg, { left: 70, transform: [{ rotate: legB }] }]}>
          <Leg far />
        </Animated.View>
        <Animated.View style={[styles.leg, { left: 128, transform: [{ rotate: legA }] }]}>
          <Leg far />
        </Animated.View>

        {/* tail, curled up over the back */}
        <Animated.View style={[styles.tail, { transform: [{ rotate: tail }] }]}>
          <Svg width={40} height={44}>
            <Path d="M28 40 C16 32 12 16 22 8 C30 2 38 10 32 18" stroke={INK} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
          </Svg>
        </Animated.View>

        <Svg width={DOG_W} height={DOG_H} style={StyleSheet.absoluteFill}>
          <Path
            d="M64 60 C62 50 72 46 86 46 L124 44 C138 44 148 52 148 62 C148 74 140 80 130 80 C118 80 108 72 96 72 C84 72 72 78 67 72 C63 68 63 64 64 60 Z"
            fill={FILL}
            stroke={INK}
            strokeWidth={STROKE}
            strokeLinejoin="round"
          />
        </Svg>

        {/* near legs */}
        <Animated.View style={[styles.leg, { left: 80, transform: [{ rotate: legA }] }]}>
          <Leg />
        </Animated.View>
        <Animated.View style={[styles.leg, { left: 138, transform: [{ rotate: legB }] }]}>
          <Leg />
        </Animated.View>

        {/* head + neck, tipping back from where the neck meets the chest */}
        <Animated.View style={[styles.head, { transform: [{ rotate: headUp }] }]}>
          <Svg width={76} height={70}>
            <Path d="M10 60 Q15 42 26 32 L41 36 Q33 48 28 64" fill={FILL} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" strokeLinecap="round" />
            <Path d="M22 19 L22 1 L30 15" fill={FILL} stroke={FAINT_INK} strokeWidth={STROKE} strokeLinejoin="round" />
            <Ellipse cx={32} cy={27} rx={13} ry={11} fill={FILL} stroke={INK} strokeWidth={STROKE} />
            <Path d="M27 17 L32 -1 L38 16" fill={FILL} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
            <Path d="M42 22 L62 27 Q65 30 61 32 L43 34" fill={FILL} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
            <Circle cx={61.5} cy={28.5} r={2.5} fill={INK} />
            <Circle cx={36} cy={24} r={1.7} fill={INK} />
            <Line x1={19} y1={44} x2={37} y2={48} stroke={ORANGE} strokeWidth={3.2} strokeLinecap="round" />
          </Svg>
          {/* open mouth while howling */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: mouth }]}>
            <Svg width={76} height={70}>
              <Path d="M45 33 Q53 40 60 32" fill={FILL} stroke={INK} strokeWidth={STROKE} strokeLinecap="round" />
            </Svg>
          </Animated.View>
        </Animated.View>

        {/* "awoooo", one letter at a time, rising from his mouth */}
        <View style={styles.howlText}>
          {"awoooo".split("").map((letter, i) => {
            const show = HOWL[0] + 0.55 + i * 0.25;
            return (
              <Animated.Text
                key={i}
                style={[
                  styles.howlLetter,
                  {
                    opacity: t.interpolate({
                      inputRange: [0, at(show), at(show) + 0.005, at(HOWL[1] - 0.25), at(HOWL[1]), 1],
                      outputRange: [0, 0, 1, 1, 0, 0],
                    }),
                    transform: [{ translateY: -i * 6 }],
                  },
                ]}
              >
                {letter}
              </Animated.Text>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    overflow: "hidden",
  },
  rounded: {
    borderRadius: 20,
  },
  bell: {
    position: "absolute",
    width: 8,
    height: 8,
    transformOrigin: "top",
  },
  ding: {
    position: "absolute",
  },
  dog: {
    position: "absolute",
    left: 0,
    width: DOG_W,
    height: DOG_H,
  },
  leg: {
    position: "absolute",
    top: 66,
    width: 16,
    height: 62,
    transformOrigin: "top",
  },
  tail: {
    position: "absolute",
    left: 40,
    top: 18,
    width: 40,
    height: 44,
    transformOrigin: "70% 92%",
  },
  head: {
    position: "absolute",
    left: 120,
    top: 8,
    width: 76,
    height: 70,
    transformOrigin: "22% 90%",
  },
  howlText: {
    position: "absolute",
    left: 150,
    top: -70,
    flexDirection: "row",
    alignItems: "flex-end",
    transform: [{ rotate: "-20deg" }],
  },
  howlLetter: {
    color: ORANGE,
    fontFamily: fonts.hand,
    fontSize: 48,
  },
});
