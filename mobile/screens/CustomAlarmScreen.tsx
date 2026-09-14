import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import {
  getCustomAlarms,
  nextCustomAlarmOccurrence,
  setCustomAlarmEnabled,
  type CustomAlarm,
  type RepeatMode,
} from "../lib/customAlarm";
import { fonts, radius, shadow, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

const REPEAT_LABEL: Record<RepeatMode, string> = {
  once: "Once",
  everyday: "Every day",
  weekdays: "Weekdays",
  custom: "",
};
const DAY_LETTERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function repeatSummary(alarm: CustomAlarm): string {
  if (alarm.repeatMode !== "custom") return REPEAT_LABEL[alarm.repeatMode];
  if (alarm.customDays.length === 0) return "Custom";
  if (alarm.customDays.length === 7) return "Every day";
  return alarm.customDays.slice().sort().map((d) => DAY_LETTERS[d]).join(", ");
}

function formatTime(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

type Props = NativeStackScreenProps<RootStackParamList, "CustomAlarm">;

export default function CustomAlarmScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [alarms, setAlarms] = useState<CustomAlarm[]>([]);

  const refresh = useCallback(() => {
    getCustomAlarms()
      .then(setAlarms)
      .catch(() => setAlarms([]));
  }, []);

  useFocusEffect(refresh);

  const next = nextCustomAlarmOccurrence(alarms);

  async function toggle(alarm: CustomAlarm, value: boolean) {
    // Update immediately so the switch doesn't visually snap back while scheduling runs.
    setAlarms((prev) => prev.map((a) => (a.id === alarm.id ? { ...a, enabled: value } : a)));
    await setCustomAlarmEnabled(alarm.id, value);
    refresh();
  }

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <View style={styles.content}>
        <Text style={styles.title}>Your alarms</Text>
        <Text style={styles.subtitle}>
          {next !== null ? `Next alarm in ${formatCountdown(next - Date.now())}` : "No alarms set"}
        </Text>

        {alarms.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="alarm-outline" size={28} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No custom alarms yet.{"\n"}Tap + to set your own wake-up time.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {alarms.map((alarm) => (
              <Pressable
                key={alarm.id}
                style={[styles.card, !alarm.enabled && styles.cardDisabled]}
                onPress={() => navigation.navigate("EditCustomAlarm", { alarmId: alarm.id })}
              >
                <View style={styles.cardLeft}>
                  <Text style={[styles.cardTime, !alarm.enabled && styles.cardTextDisabled]}>
                    {formatTime(alarm.hour, alarm.minute)}
                  </Text>
                  <Text style={[styles.cardLabel, !alarm.enabled && styles.cardTextDisabled]}>
                    {repeatSummary(alarm)}
                    {alarm.name.trim() ? ` · ${alarm.name.trim()}` : ""}
                  </Text>
                </View>
                <Switch
                  value={alarm.enabled}
                  onValueChange={(value) => toggle(alarm, value)}
                  trackColor={{ false: colors.surfaceAlt, true: colors.accent }}
                  thumbColor={colors.surface}
                />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate("EditCustomAlarm", {})}
        hitSlop={8}
      >
        <Ionicons name="add" size={28} color={colors.accentText} />
      </Pressable>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      padding: spacing.xl,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.display,
      fontSize: 26,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    subtitle: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 14,
      marginTop: spacing.xs,
      marginBottom: spacing.xl,
    },
    empty: {
      alignItems: "center",
      gap: spacing.md,
      paddingTop: spacing.xxl * 2,
    },
    emptyText: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
    },
    list: {
      gap: spacing.md,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      ...shadow,
    },
    cardDisabled: {
      opacity: 0.55,
    },
    cardLeft: {
      gap: spacing.xs,
    },
    cardTime: {
      color: colors.textPrimary,
      fontFamily: fonts.monoBold,
      fontSize: 28,
    },
    cardLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 13,
    },
    cardTextDisabled: {
      color: colors.textSecondary,
    },
    fab: {
      position: "absolute",
      right: spacing.xl,
      bottom: spacing.xxl,
      width: 56,
      height: 56,
      borderRadius: radius.lg,
      backgroundColor: colors.accent,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      alignItems: "center",
      justifyContent: "center",
      ...shadow,
    },
  });
}
