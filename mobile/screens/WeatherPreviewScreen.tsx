import { useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Sky, { DAYTIME_TINT, isDaytimeAt, NIGHTTIME_TINT } from "../components/Sky";
import type { HomeStackParamList } from "../App";
import { fonts, radius, spacing, useThemeColors } from "../lib/theme";
import type { WeatherCondition } from "../lib/weather";

// A debug-only tool (reached from Settings' Debug section) for actually seeing every sky
// state — real weather rarely cooperates with "let me check what a storm looks like right
// now." Renders the exact same <Sky> component Home does, just fed a chosen time/condition
// instead of the real clock/weather fetch, so what you see here is guaranteed to match what
// Home would show at that time in that weather — no separate preview implementation to drift
// out of sync.

const WEATHER_OPTIONS: { value: WeatherCondition; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "clear", label: "Clear", icon: "sunny-outline" },
  { value: "cloudy", label: "Cloudy", icon: "cloud-outline" },
  { value: "rain", label: "Rain", icon: "rainy-outline" },
  { value: "storm", label: "Storm", icon: "thunderstorm-outline" },
  { value: "snow", label: "Snow", icon: "snow-outline" },
  { value: "fog", label: "Fog", icon: "eye-off-outline" },
];

const MINUTES_IN_DAY = 24 * 60;

function formatMinutes(minutes: number): string {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** A plain, dependency-free draggable slider (track + thumb via PanResponder) — pulling in a
 * native slider library for one debug screen isn't worth the extra native dependency/rebuild
 * this project's had to do for every other addition this session. */
function DebugSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  color,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** The fill/thumb color — callers pass something that reflects what the slider is
   * actually previewing (e.g. gold for daytime, blue for night) rather than every slider
   * on the screen defaulting to the same fixed accent regardless of context. */
  color: string;
}) {
  const trackRef = useRef<View>(null);
  const trackLayout = useRef({ pageX: 0, width: 0 });

  function updateFromPageX(pageX: number) {
    const { pageX: trackX, width } = trackLayout.current;
    if (width === 0) return;
    const ratio = Math.min(1, Math.max(0, (pageX - trackX) / width));
    const raw = min + ratio * (max - min);
    const snapped = Math.round(raw / step) * step;
    onChange(Math.min(max, Math.max(min, snapped)));
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Measured fresh at the start of each touch (rather than relying on onLayout's own
      // measure(), which can still report a stale/zero pageX right after first mount on
      // Android) — cheap, since it only runs once per gesture, and it means a still-mounting
      // screen can never leave the slider stuck reading a layout of 0.
      onPanResponderGrant: (evt) => {
        trackRef.current?.measure((_x, _y, width, _height, pageX) => {
          trackLayout.current = { pageX, width };
          updateFromPageX(evt.nativeEvent.pageX);
        });
      },
      onPanResponderMove: (evt) => updateFromPageX(evt.nativeEvent.pageX),
    }),
  ).current;

  const percent = ((value - min) / (max - min)) * 100;

  // The touchable area is a generous 40px-tall band, not the thin 4px line drawn inside it —
  // a real slider's hit target is always much bigger than its visible track for exactly this
  // reason; relying on hitSlop alone on a 4px view measured too small to reliably register.
  return (
    <View ref={trackRef} {...panResponder.panHandlers} style={styles.sliderHitArea}>
      <View style={styles.sliderTrack}>
        <View style={[styles.sliderFill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
      <View style={[styles.sliderThumb, { left: `${percent}%`, backgroundColor: color }]} />
    </View>
  );
}

type Props = NativeStackScreenProps<HomeStackParamList, "WeatherPreview">;

export default function WeatherPreviewScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const [minutes, setMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  const [weatherIndex, setWeatherIndex] = useState(0);

  const previewNow = new Date();
  previewNow.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  const weather = WEATHER_OPTIONS[weatherIndex];
  const timeSliderColor = isDaytimeAt(previewNow) ? DAYTIME_TINT : NIGHTTIME_TINT;

  return (
    <View style={styles.root}>
      <Sky now={previewNow} weatherCondition={weather.value} />

      <SafeAreaView style={styles.headerWrap} edges={["top"]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
          <Text style={styles.backText}>Preview weather &amp; time</Text>
        </Pressable>
      </SafeAreaView>

      <SafeAreaView style={styles.panelWrap} edges={["bottom"]}>
        <View style={styles.panel}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Time of day</Text>
            <Text style={styles.rowValue}>{formatMinutes(minutes)}</Text>
          </View>
          <DebugSlider
            value={minutes}
            min={0}
            max={MINUTES_IN_DAY - 1}
            step={1}
            onChange={setMinutes}
            color={timeSliderColor}
          />

          <View style={[styles.row, styles.rowSpaced]}>
            <Text style={styles.rowLabel}>Weather</Text>
            <View style={styles.weatherValueRow}>
              <Ionicons name={weather.icon} size={16} color="#fff" />
              <Text style={styles.rowValue}>{weather.label}</Text>
            </View>
          </View>
          <DebugSlider
            value={weatherIndex}
            min={0}
            max={WEATHER_OPTIONS.length - 1}
            step={1}
            onChange={setWeatherIndex}
            color={colors.accent}
          />
          <View style={styles.weatherTicks}>
            {WEATHER_OPTIONS.map((option) => (
              <Text key={option.value} style={styles.weatherTickText}>
                {option.label}
              </Text>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0f1c2e",
  },
  headerWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    margin: spacing.lg,
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  backText: {
    color: "#fff",
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  panelWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  panel: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderTopLeftRadius: radius.lg + 8,
    borderTopRightRadius: radius.lg + 8,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowSpaced: {
    marginTop: spacing.lg,
  },
  rowLabel: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  rowValue: {
    color: "#fff",
    fontFamily: fonts.monoBold,
    fontSize: 16,
  },
  weatherValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  sliderHitArea: {
    height: 40,
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  sliderThumb: {
    position: "absolute",
    top: "50%",
    marginTop: -11,
    width: 22,
    height: 22,
    borderRadius: 11,
    marginLeft: -11,
    borderWidth: 2,
    borderColor: "#fff",
  },
  weatherTicks: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  weatherTickText: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: fonts.body,
    fontSize: 10,
  },
});
