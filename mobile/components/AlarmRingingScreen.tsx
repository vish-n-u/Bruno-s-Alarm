import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import VideoPanel from "./VideoPanel";
import { snoozeRingingAlarm, stopRingingAlarm } from "../lib/notifications";
import { fonts, radius, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

export default function AlarmRingingScreen({ alarmId }: { alarmId: string }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  // bruno-session- alarms are a real, live howl; bruno-custom- alarms are a user-chosen
  // wake time that likely doesn't line up with an actual live session — say so honestly
  // rather than implying Bruno is howling right this second.
  const isRealSession = alarmId.startsWith("bruno-session-");
  // Android alarm ids end in the scheduled timestamp (bruno-session-<ms> / bruno-custom-
  // <ms>) — pull it out to show the exact scheduled time in the same mono "departure
  // board" language used on Home, rather than just a generic title.
  const scheduledAt = Number(alarmId.slice(alarmId.lastIndexOf("-") + 1));
  const timeLabel = Number.isFinite(scheduledAt) && scheduledAt > 0
    ? new Date(scheduledAt).toLocaleString(undefined, { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <View style={styles.root}>
      <View style={styles.titleRow}>
        <Ionicons
          name={isRealSession ? "paw" : "alarm"}
          size={22}
          color={colors.accent}
        />
        <Text style={styles.title}>{isRealSession ? "Bruno is howling!" : "Your Bruno alarm"}</Text>
      </View>
      {timeLabel && <Text style={styles.timeLabel}>{timeLabel}</Text>}

      <View style={styles.videoWrap}>
        <VideoPanel allowUnmute={false} />
      </View>

      <Pressable style={styles.stopButton} onPress={() => stopRingingAlarm(alarmId)}>
        <Text style={styles.stopButtonText}>Stop</Text>
      </Pressable>

      <Pressable style={styles.snoozeButton} onPress={() => snoozeRingingAlarm(alarmId)}>
        <Ionicons name="moon-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.snoozeButtonText}>Snooze 10 min</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: "center",
      padding: spacing.xxl,
      gap: spacing.lg,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.display,
      fontSize: 22,
      textAlign: "center",
    },
    timeLabel: {
      color: colors.live,
      fontFamily: fonts.monoBold,
      fontSize: 15,
      textAlign: "center",
      marginTop: -spacing.sm,
    },
    videoWrap: {
      marginVertical: spacing.sm,
    },
    stopButton: {
      width: "100%",
      paddingVertical: 16,
      borderRadius: radius.md + 2,
      backgroundColor: colors.accent,
      alignItems: "center",
    },
    stopButtonText: {
      color: colors.accentText,
      fontFamily: fonts.bodyBold,
      fontSize: 18,
    },
    snoozeButton: {
      width: "100%",
      flexDirection: "row",
      paddingVertical: spacing.lg,
      borderRadius: radius.md + 2,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    snoozeButtonText: {
      color: colors.textSecondary,
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
    },
  });
}
