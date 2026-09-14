import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { requestPermission } from "../lib/notifications";
import {
  deleteCustomAlarm,
  getCustomAlarm,
  saveCustomAlarm,
  type CustomAlarm,
  type RepeatMode,
} from "../lib/customAlarm";
import { todaysSessions } from "../lib/schedule";
import type { RootStackParamList } from "../App";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fonts, radius, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
const PADDING = ROW_HEIGHT * Math.floor(VISIBLE_ROWS / 2);

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0..59
const AMPM = ["AM", "PM"] as const;

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
    const h24 = d.getHours();
    const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return { hour12, minute: d.getMinutes(), ampm: h24 >= 12 ? "PM" : "AM" };
  });
}

type Styles = ReturnType<typeof createStyles>;

function Wheel<T extends string | number>({
  data,
  format,
  selectedIndex,
  onSettle,
  isLive,
  styles,
}: {
  data: T[];
  format: (value: T) => string;
  selectedIndex: number;
  onSettle: (index: number) => void;
  isLive: (value: T) => boolean;
  styles: Styles;
}) {
  const listRef = useRef<FlatList<T>>(null);

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.y / ROW_HEIGHT);
    onSettle(Math.max(0, Math.min(data.length - 1, index)));
  }

  return (
    <View style={styles.wheelWrap}>
      <View pointerEvents="none" style={styles.wheelSelectionBand} />
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item) => String(item)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: PADDING }}
        getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
        initialScrollIndex={selectedIndex}
        onMomentumScrollEnd={handleScrollEnd}
        renderItem={({ item, index }) => (
          <View style={styles.wheelRow}>
            <Text style={[styles.wheelText, isLive(item) && styles.wheelTextLive, index === selectedIndex && styles.wheelTextSelected]}>
              {format(item)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

type Props = NativeStackScreenProps<RootStackParamList, "EditCustomAlarm">;

export default function EditCustomAlarmScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const alarmId = route.params?.alarmId;
  const isEditing = Boolean(alarmId);

  const [name, setName] = useState("");
  const [hourIndex, setHourIndex] = useState(6); // default 7 (index 6 -> HOURS[6] = 7)
  const [minuteIndex, setMinuteIndex] = useState(0);
  const [ampmIndex, setAmpmIndex] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("everyday");
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(isEditing);

  useEffect(() => {
    if (!alarmId) return;
    getCustomAlarm(alarmId).then((alarm) => {
      if (alarm) {
        setName(alarm.name);
        const hour12 = alarm.hour % 12 === 0 ? 12 : alarm.hour % 12;
        setHourIndex(HOURS.indexOf(hour12));
        setMinuteIndex(MINUTES.indexOf(alarm.minute));
        setAmpmIndex(alarm.hour >= 12 ? 1 : 0);
        setRepeatMode(alarm.repeatMode);
        setCustomDays(alarm.customDays);
      }
      setLoading(false);
    });
  }, [alarmId]);

  function toggleDay(day: number) {
    setCustomDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  const moments = useMemo(() => liveMoments(), []);
  const liveHourSet = useMemo(() => new Set(moments.map((m) => m.hour12)), [moments]);
  const liveMinuteSet = useMemo(() => new Set(moments.map((m) => m.minute)), [moments]);
  const liveAmpmSet = useMemo(() => new Set(moments.map((m) => m.ampm)), [moments]);

  const liveLabel = moments
    .map((m) => `${m.hour12}:${String(m.minute).padStart(2, "0")} ${m.ampm}`)
    .join(" and ");

  async function handleDone() {
    if (repeatMode === "custom" && customDays.length === 0) {
      Alert.alert("Pick at least one day", "Choose which days this alarm should repeat on.");
      return;
    }

    const granted = await requestPermission();
    if (!granted) {
      Alert.alert("Permission needed", "Grant notification permission first (from the Home screen or Settings).");
      return;
    }

    const hour12 = HOURS[hourIndex];
    const hour24 = ampmIndex === 1 ? (hour12 === 12 ? 12 : hour12 + 12) : hour12 === 12 ? 0 : hour12;
    const minute = MINUTES[minuteIndex];

    const alarm: CustomAlarm = {
      id: alarmId ?? `custom-${Date.now()}`,
      name: name.trim(),
      hour: hour24,
      minute,
      enabled: true,
      repeatMode,
      customDays,
    };
    await saveCustomAlarm(alarm);
    navigation.goBack();
  }

  function handleDelete() {
    if (!alarmId) return;
    Alert.alert("Delete this alarm?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteCustomAlarm(alarmId);
          navigation.goBack();
        },
      },
    ]);
  }

  if (loading) return null;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.headerAction}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{isEditing ? "Edit alarm" : "New alarm"}</Text>
        <Pressable onPress={handleDone} hitSlop={8}>
          <Text style={[styles.headerAction, styles.headerActionPrimary]}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.liveHint}>Bruno is live around {liveLabel} your time</Text>

        <View style={styles.wheelsRow}>
          <Wheel
            data={HOURS}
            format={(v) => String(v)}
            selectedIndex={hourIndex}
            onSettle={setHourIndex}
            isLive={(v) => liveHourSet.has(v)}
            styles={styles}
          />
          <Text style={styles.colon}>:</Text>
          <Wheel
            data={MINUTES}
            format={(v) => String(v).padStart(2, "0")}
            selectedIndex={minuteIndex}
            onSettle={setMinuteIndex}
            isLive={(v) => liveMinuteSet.has(v)}
            styles={styles}
          />
          <Wheel
            data={[...AMPM]}
            format={(v) => v}
            selectedIndex={ampmIndex}
            onSettle={setAmpmIndex}
            isLive={(v) => liveAmpmSet.has(v)}
            styles={styles}
          />
        </View>

        <View style={styles.repeatRow}>
          {REPEAT_MODES.map((mode) => (
            <Pressable
              key={mode}
              style={[styles.repeatChip, repeatMode === mode && styles.repeatChipActive]}
              onPress={() => setRepeatMode(mode)}
            >
              <Text style={[styles.repeatChipText, repeatMode === mode && styles.repeatChipTextActive]}>
                {REPEAT_LABEL[mode]}
              </Text>
            </Pressable>
          ))}
        </View>

        {repeatMode === "custom" && (
          <View style={styles.daysRow}>
            {DAY_LETTERS.map((letter, day) => (
              <Pressable
                key={day}
                style={[styles.dayCircle, customDays.includes(day) && styles.dayCircleActive]}
                onPress={() => toggleDay(day)}
              >
                <Text style={[styles.dayCircleText, customDays.includes(day) && styles.dayCircleTextActive]}>
                  {letter}
                </Text>
              </Pressable>
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
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete alarm</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
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
    headerTitle: {
      color: colors.textPrimary,
      fontFamily: fonts.displaySemiBold,
      fontSize: 17,
    },
    content: {
      flex: 1,
      padding: spacing.xl,
      alignItems: "center",
    },
    liveHint: {
      color: colors.live,
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      textAlign: "center",
      marginTop: spacing.md,
    },
    wheelsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.xxl,
    },
    wheelWrap: {
      width: 90,
      height: WHEEL_HEIGHT,
    },
    wheelSelectionBand: {
      position: "absolute",
      top: PADDING,
      left: 0,
      right: 0,
      height: ROW_HEIGHT,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
    },
    wheelRow: {
      height: ROW_HEIGHT,
      alignItems: "center",
      justifyContent: "center",
    },
    wheelText: {
      color: colors.textSecondary,
      fontFamily: fonts.mono,
      fontSize: 19,
    },
    wheelTextLive: {
      color: colors.live,
      fontFamily: fonts.monoBold,
    },
    wheelTextSelected: {
      color: colors.textPrimary,
      fontFamily: fonts.monoBold,
    },
    colon: {
      color: colors.textPrimary,
      fontFamily: fonts.monoBold,
      fontSize: 20,
      marginHorizontal: spacing.xs,
    },
    repeatRow: {
      flexDirection: "row",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.xl,
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
