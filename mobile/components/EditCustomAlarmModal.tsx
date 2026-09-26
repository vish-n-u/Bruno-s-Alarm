import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type FlatList,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Touchable from "./Touchable";
import { ensureAlarmPermissions } from "../lib/alarmPermissions";
import { success, tapLight, tick, warning } from "../lib/haptics";
import { playDeleteSound } from "../lib/uiSound";
import {
  deleteCustomAlarm,
  getCustomAlarm,
  saveCustomAlarm,
  type CustomAlarm,
  type RepeatMode,
} from "../lib/customAlarm";
import { todaysSessions } from "../lib/schedule";
import { fonts, radius, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
const PADDING = ROW_HEIGHT * Math.floor(VISIBLE_ROWS / 2);

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0..23
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0..59

// How many copies of the real data a looping wheel renders back-to-back, so it can be spun
// past either end and land back on 0 (or 23/59) exactly like a real clock, instead of hitting
// a hard stop. Enough copies that a normal fling never reaches either physical edge of the
// list; if one somehow did, it'd just stop there rather than crash — an acceptable fallback
// for a case that shouldn't happen in practice, not a true infinite list.
const LOOP_COPIES = 15;

// A numeric rate (rather than the "fast"/"normal" presets) so both platforms glide with the
// same weight — heavier than "fast" (which stops almost the instant your finger lifts) but
// short of "normal"'s floaty coast, closer to how a real clicking dial carries its own momentum.
const WHEEL_DECELERATION = 0.985;

const REPEAT_MODES: RepeatMode[] = ["once", "everyday", "weekdays", "custom"];
const REPEAT_LABEL: Record<RepeatMode, string> = {
  once: "Once",
  everyday: "Every day",
  weekdays: "Weekdays",
  custom: "Custom",
};
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"]; // index = Date.getDay(), 0=Sun

// Bruno's two real sessions today, converted to this device's local wall-clock time —
// Date getters already reflect local timezone, so no Intl/toLocaleString parsing needed.
function liveMoments() {
  return todaysSessions().map((ts) => {
    const d = new Date(ts);
    return { hour: d.getHours(), minute: d.getMinutes() };
  });
}

type Styles = ReturnType<typeof createStyles>;

// Animated.FlatList's own TS typing assumes `data` is itself animatable (it's meant for
// style-driven lists), which doesn't fit this plain typed data list — recast it once to a
// properly generic component instead of fighting those typings at every call site.
const AnimatedFlatList = Animated.FlatList as unknown as new <T>() => FlatList<T>;

// Rest-state vs. centered-state size for a row — matches the native picker's own hard two-tier
// contrast (a big jump, not a gradual one) rather than the softer multi-step fade the previous
// five-row design used. Expressed as a scale ratio, not a literal fontSize: fontSize edits text
// layout, which only the JS thread can recompute — driving the wheel's whole scroll position off
// a JS-thread value (rather than the native thread) reintroduced real lag, the exact "highlights
// the previous one too" symptom this was meant to fix. `transform: scale` is paint-only, so it
// stays on the native thread and tracks the actual scroll position every frame, no exceptions.
const REST_FONT_SIZE = 19;
const FOCUS_SCALE = 30 / REST_FONT_SIZE;

// How far from a row's own center its highlight extends, as a fraction of ROW_HEIGHT. Using
// the full row (a fraction of 1) meant two neighboring rows were each still half-blended
// toward "focused" right at the midpoint between them — both visibly lit up at once while
// scrolling past, reading as a glitch rather than a handoff. Keeping this under 0.5 guarantees
// the two rows' highlight windows never overlap: there's a brief, deliberate gap right at the
// midpoint where neither is highlighted, then the next row snaps on — a clean single "spotlight"
// that only ever lights one row at a time, instead of a mushy cross-fade between two.
const FOCUS_WINDOW = ROW_HEIGHT * 0.42;

/** A single row's size and color track the wheel's scrollY continuously, so the "this is the
 * one that's selected" look updates every frame in lockstep with the actual scroll position —
 * never gated behind the settled `selectedIndex` state, which visibly lagged a beat behind
 * during a fast spin. Only three rows are ever on screen at once (see VISIBLE_ROWS), so there's
 * only ever one interpolation stop on each side to worry about. */
function WheelRow({
  index,
  scrollY,
  rowStyle,
  textStyle,
  label,
  live,
  colors,
}: {
  index: number;
  scrollY: Animated.Value;
  rowStyle: object;
  textStyle: object;
  label: string;
  live: boolean;
  colors: ThemeColors;
}) {
  const focusRange = [index * ROW_HEIGHT - FOCUS_WINDOW, index * ROW_HEIGHT, index * ROW_HEIGHT + FOCUS_WINDOW];
  const restColor = live ? colors.live : colors.textSecondary;
  const color = scrollY.interpolate({
    inputRange: focusRange,
    outputRange: [restColor, colors.textPrimary, restColor],
    extrapolate: "clamp",
  });
  const scale = scrollY.interpolate({
    inputRange: focusRange,
    outputRange: [1, FOCUS_SCALE, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={rowStyle}>
      <Animated.Text style={[textStyle, live && { fontFamily: fonts.monoBold }, { color, transform: [{ scale }] }]}>
        {label}
      </Animated.Text>
    </View>
  );
}

function Wheel<T extends string | number>({
  data,
  format,
  selectedIndex,
  onSettle,
  isLive,
  styles,
  colors,
  /** Renders several back-to-back copies of `data` so scrolling past either end lands back on
   * the other side (23 → 0, 59 → 0) instead of stopping dead — a real clock wheel, not a
   * bounded list. */
  loop = false,
}: {
  data: T[];
  format: (value: T) => string;
  selectedIndex: number;
  onSettle: (index: number) => void;
  isLive: (value: T) => boolean;
  styles: Styles;
  colors: ThemeColors;
  loop?: boolean;
}) {
  const listRef = useRef<FlatList<T>>(null);
  // Which copy of the data a looping wheel starts centered on — picked once so there's equal
  // room to spin in either direction before ever reaching a physical end of the list.
  const middleOffset = loop ? Math.floor(LOOP_COPIES / 2) * data.length : 0;
  const virtualData = useMemo(
    () => (loop ? Array.from({ length: data.length * LOOP_COPIES }, (_, i) => data[i % data.length]) : data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loop, data.length],
  );

  // Drives both the per-row depth effect (native-driven, so it stays smooth regardless of what
  // the JS thread is doing) and, via the listener below, the row-crossing haptic tick.
  const scrollY = useRef(new Animated.Value(0)).current;

  // Fires a light "tick" once per row crossed while spinning, the way a real clicking dial
  // would — not just once when it finally settles. Tracked in a ref (not state) since it only
  // needs to suppress duplicate calls for the same row, never trigger a re-render itself.
  const lastHapticRow = useRef<number | null>(null);

  function rowAt(offsetY: number): number {
    return Math.round(offsetY / ROW_HEIGHT);
  }

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const row = rowAt(e.nativeEvent.contentOffset.y);
    if (row !== lastHapticRow.current) {
      lastHapticRow.current = row;
      tick();
    }
  }

  // Native-driven: color and transform (scale) are both native-driver-safe, so the whole
  // per-row effect updates on the native thread, every frame, regardless of what the JS thread
  // is doing — this is what keeps it feeling instant rather than a beat behind the finger.
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
    listener: handleScroll,
  });

  // Which virtual row the list is actually resting at, so the effect below can tell "did this
  // selectedIndex change come from our own settle" apart from "did the parent just hand us a
  // genuinely new value" (loading a saved alarm's time after the modal already mounted).
  const lastVirtualRow = useRef<number | null>(null);
  // Set right before calling onSettle, and consumed (cleared) the very next time the effect
  // below runs — a same-tick way to pass "this update came from us" without needing state.
  const settledInternally = useRef(false);

  // Scroll the wheel to the correct position whenever selectedIndex changes for a real reason:
  // the first render, or the edit-existing-alarm case where state updates after mount (covers
  // initialScrollIndex only positioning things at first render, not reacting to later prop
  // changes). For our own settle, only recenter back onto the middle copy once actually close to
  // running out of room on one side — jumping on every single settle risked landing a frame out
  // of sync with the native scroll position (this is what the intermittent flicker was: a jump
  // that, most of the time, coincided cleanly with the native settle, but occasionally didn't).
  useEffect(() => {
    const target = middleOffset + selectedIndex;
    const internal = settledInternally.current;
    settledInternally.current = false;

    if (!internal || lastVirtualRow.current === null) {
      listRef.current?.scrollToIndex({ index: target, animated: false });
      lastVirtualRow.current = target;
      return;
    }
    if (!loop) return;

    const margin = data.length * 2;
    const current = lastVirtualRow.current;
    const driftedNearEdge = current < margin || current > data.length * LOOP_COPIES - margin;
    if (driftedNearEdge) {
      listRef.current?.scrollToIndex({ index: target, animated: false });
      lastVirtualRow.current = target;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, loop]);

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const row = rowAt(e.nativeEvent.contentOffset.y);
    lastVirtualRow.current = row;
    const real = loop
      ? ((row % data.length) + data.length) % data.length
      : Math.max(0, Math.min(data.length - 1, row));
    settledInternally.current = true;
    onSettle(real);
  }

  return (
    <View style={styles.wheelWrap}>
      <AnimatedFlatList<T>
        ref={listRef}
        data={virtualData}
        keyExtractor={(_, index) => String(index)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_HEIGHT}
        decelerationRate={WHEEL_DECELERATION}
        contentContainerStyle={{ paddingVertical: PADDING }}
        getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
        initialScrollIndex={middleOffset + selectedIndex}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        renderItem={({ item, index }) => (
          <WheelRow
            index={index}
            scrollY={scrollY}
            rowStyle={styles.wheelRow}
            textStyle={styles.wheelText}
            label={format(item)}
            live={isLive(item)}
            colors={colors}
          />
        )}
      />
    </View>
  );
}

type Props = {
  visible: boolean;
  /** Omit to create a new alarm; pass an existing id to edit it. */
  alarmId?: string;
  onClose: () => void;
  /** Called after a successful save or delete, so the caller can refresh its own list. */
  onSaved: () => void;
};

// A true in-place popup (RN's own Modal, sliding up over a dimmed backdrop) rather than a
// pushed navigation route — even a "modal presentation" stack screen still reads as
// "went to a new page." This is opened directly from HomeScreen/CustomAlarmScreen via local
// state, not navigation.
export default function EditCustomAlarmModal({ visible, alarmId, onClose, onSaved }: Props) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const isEditing = Boolean(alarmId);

  const [name, setName] = useState("");
  const [hourIndex, setHourIndex] = useState(7); // default 7 AM — HOURS[7] = 7 in 24hr form
  const [minuteIndex, setMinuteIndex] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("everyday");
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [editingEnabled, setEditingEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reloads (or resets to defaults for a new alarm) every time the popup opens — mirrors
  // the previous screen's mount-time load, just keyed off `visible` instead.
  useEffect(() => {
    if (!visible) return;
    if (!alarmId) {
      setName("");
      setHourIndex(7);
      setMinuteIndex(0);
      setRepeatMode("everyday");
      setCustomDays([]);
      setEditingEnabled(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    getCustomAlarm(alarmId).then((alarm) => {
      if (alarm) {
        setName(alarm.name);
        setHourIndex(alarm.hour);
        setMinuteIndex(alarm.minute);
        setRepeatMode(alarm.repeatMode);
        setCustomDays(alarm.customDays);
        setEditingEnabled(alarm.enabled);
      }
      setLoading(false);
    });
  }, [visible, alarmId]);

  function toggleDay(day: number) {
    tapLight();
    setCustomDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  const moments = useMemo(() => liveMoments(), []);
  const liveHourSet = useMemo(() => new Set(moments.map((m) => m.hour)), [moments]);
  const liveMinuteSet = useMemo(() => new Set(moments.map((m) => m.minute)), [moments]);

  const liveLabel = moments
    .map((m) => `${String(m.hour).padStart(2, "0")}:${String(m.minute).padStart(2, "0")}`)
    .join(" and ");

  async function handleDone() {
    // saveCustomAlarm() below does a network call plus up to 14 native scheduleAlarm()
    // calls, which is slow enough that a real tap felt unresponsive — without this guard,
    // that invited a second tap, which created a second, duplicate alarm entirely.
    if (saving) return;

    if (repeatMode === "custom" && customDays.length === 0) {
      Alert.alert("Pick at least one day", "Choose which days this alarm should repeat on.");
      return;
    }

    // Fires immediately, before the slow part below — see the comment above about why a real
    // tap can otherwise feel unresponsive for a moment; success() at the end still confirms
    // the save actually completed.
    tapLight();
    setSaving(true);
    try {
      // Asks for whatever is still missing (notifications, exact alarms, lock-screen display)
      // and explains it; false means it already told them why, so just stop here.
      if (!(await ensureAlarmPermissions())) return;

      const hour = HOURS[hourIndex];
      const minute = MINUTES[minuteIndex];

      const alarm: CustomAlarm = {
        id: alarmId ?? `custom-${Date.now()}`,
        name: name.trim(),
        hour,
        minute,
        // Preserve the existing enabled state when editing — saving a disabled alarm to rename
        // it shouldn't silently re-enable it. New alarms always start enabled.
        enabled: alarmId ? editingEnabled : true,
        repeatMode,
        customDays,
      };
      await saveCustomAlarm(alarm);
      success();
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!alarmId) return;
    warning();
    playDeleteSound();
    await deleteCustomAlarm(alarmId);
    onSaved();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={saving ? () => {} : onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTapArea} onPress={saving ? undefined : onClose} />
        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Touchable
              onPress={() => {
                tapLight();
                onClose();
              }}
              disabled={saving}
              hitSlop={8}
            >
              <Text style={[styles.headerAction, saving && styles.headerActionDisabled]}>Cancel</Text>
            </Touchable>
            <Text style={styles.headerTitle}>{isEditing ? "Edit alarm" : "New alarm"}</Text>
            <Touchable onPress={handleDone} disabled={saving} hitSlop={8}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={[styles.headerAction, styles.headerActionPrimary]}>Done</Text>
              )}
            </Touchable>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <View style={styles.content}>
              <Text style={styles.liveHint}>Bruno is live around {liveLabel} your time</Text>

              <View style={styles.wheelCard}>
                {/* One pair of hairlines spanning both columns — the native picker frames its
                    selected row this way, rather than each wheel drawing its own boxed band. */}
                <View pointerEvents="none" style={styles.wheelsDivider} />
                <View style={styles.wheelsRow}>
                  <Wheel
                    data={HOURS}
                    format={(v) => String(v).padStart(2, "0")}
                    selectedIndex={hourIndex}
                    onSettle={setHourIndex}
                    isLive={(v) => liveHourSet.has(v)}
                    styles={styles}
                    colors={colors}
                    loop
                  />
                  <Wheel
                    data={MINUTES}
                    format={(v) => String(v).padStart(2, "0")}
                    selectedIndex={minuteIndex}
                    onSettle={setMinuteIndex}
                    isLive={(v) => liveMinuteSet.has(v)}
                    styles={styles}
                    colors={colors}
                    loop
                  />
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.repeatRow}
                style={styles.repeatRowScroll}
              >
                {REPEAT_MODES.map((mode) => (
                  <Touchable
                    key={mode}
                    style={[styles.repeatChip, repeatMode === mode && styles.repeatChipActive]}
                    onPress={() => {
                      tapLight();
                      setRepeatMode(mode);
                    }}
                  >
                    <Text style={[styles.repeatChipText, repeatMode === mode && styles.repeatChipTextActive]}>
                      {REPEAT_LABEL[mode]}
                    </Text>
                  </Touchable>
                ))}
              </ScrollView>

              {repeatMode === "custom" && (
                <View style={styles.daysRow}>
                  {DAY_LETTERS.map((letter, day) => (
                    <Touchable
                      key={day}
                      style={[styles.dayCircle, customDays.includes(day) && styles.dayCircleActive]}
                      onPress={() => toggleDay(day)}
                    >
                      <Text style={[styles.dayCircleText, customDays.includes(day) && styles.dayCircleTextActive]}>
                        {letter}
                      </Text>
                    </Touchable>
                  ))}
                </View>
              )}

              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Alarm name (optional)"
                placeholderTextColor={colors.textSecondary}
                maxLength={40}
              />

              {isEditing && (
                <Touchable style={styles.deleteButton} onPress={handleDelete}>
                  <Text style={styles.deleteButtonText}>Delete alarm</Text>
                </Touchable>
              )}
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    backdropTapArea: {
      flex: 1,
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.lg + 8,
      borderTopRightRadius: radius.lg + 8,
      maxHeight: "92%",
    },
    grabber: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: spacing.sm,
    },
    loadingWrap: {
      paddingVertical: spacing.xxl * 2,
      alignItems: "center",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    headerAction: {
      color: colors.textSecondary,
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
    },
    headerActionPrimary: {
      color: colors.accent,
      fontFamily: fonts.bodyBold,
    },
    headerActionDisabled: {
      opacity: 0.4,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontFamily: fonts.displaySemiBold,
      fontSize: 17,
    },
    content: {
      padding: spacing.xl,
      paddingBottom: spacing.xxl,
      alignItems: "center",
    },
    liveHint: {
      color: colors.live,
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      textAlign: "center",
      marginTop: spacing.md,
    },
    // The wheel gets its own card, separate from the rest of the sheet — matching the native
    // picker presenting its wheel as a distinct white surface rather than floating on the
    // sheet's plain background.
    wheelCard: {
      position: "relative",
      marginTop: spacing.xxl,
      width: "100%",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingVertical: spacing.sm,
    },
    // One pair of full-width hairlines framing the centered row — no fill, no rounded box —
    // the native picker's only visual cue for "this is the selected row" besides size/color.
    wheelsDivider: {
      position: "absolute",
      left: spacing.lg,
      right: spacing.lg,
      top: PADDING,
      height: ROW_HEIGHT,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    wheelsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xxl,
    },
    wheelWrap: {
      width: 90,
      height: WHEEL_HEIGHT,
    },
    wheelRow: {
      height: ROW_HEIGHT,
      alignItems: "center",
      justifyContent: "center",
    },
    // Base size only — the focused row is scaled up on top of this (see WheelRow), never given
    // a literal larger fontSize, which would need a JS-thread relayout every frame.
    wheelText: {
      fontFamily: fonts.mono,
      fontSize: REST_FONT_SIZE,
    },
    repeatRowScroll: {
      width: "100%",
      marginTop: spacing.xl,
    },
    repeatRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    repeatChip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    repeatChipActive: {
      borderColor: colors.accentBorder,
      backgroundColor: colors.accent,
    },
    repeatChipText: {
      color: colors.textSecondary,
      fontFamily: fonts.bodyBold,
      fontSize: 13,
    },
    repeatChipTextActive: {
      color: colors.accentText,
    },
    daysRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    dayCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    dayCircleActive: {
      borderColor: colors.accentBorder,
      backgroundColor: colors.accent,
    },
    dayCircleText: {
      color: colors.textSecondary,
      fontFamily: fonts.bodyBold,
      fontSize: 13,
    },
    dayCircleTextActive: {
      color: colors.accentText,
    },
    nameInput: {
      width: "100%",
      marginTop: spacing.xxl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: 15,
    },
    deleteButton: {
      width: "100%",
      marginTop: spacing.xl,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    deleteButtonText: {
      color: colors.danger,
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
    },
  });
}
