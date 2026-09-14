import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
      {/* Video fills the entire screen — the ringing take-over IS the video, not a card
          floating inside a UI. Text/buttons sit on solid scrim bands over it, since video
          content isn't theme-aware and can't guarantee contrast against arbitrary footage. */}
      <VideoPanel allowUnmute={false} />

      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <View style={styles.topScrim}>
          <View style={styles.titleRow}>
            <Ionicons name={isRealSession ? "paw" : "alarm"} size={22} color="#fff" />
            <Text style={styles.title}>{isRealSession ? "Bruno is howling!" : "Your Bruno alarm"}</Text>
          </View>
          {timeLabel && <Text style={styles.timeLabel}>{timeLabel}</Text>}
        </View>

        <View style={styles.bottomScrim}>
          <Pressable style={styles.stopButton} onPress={() => stopRingingAlarm(alarmId)}>
            <Text style={styles.stopButtonText}>Stop</Text>
          </Pressable>

          <Pressable style={styles.snoozeButton} onPress={() => snoozeRingingAlarm(alarmId)}>
            <Ionicons name="moon-outline" size={16} color="#fff" />
            <Text style={styles.snoozeButtonText}>Snooze 10 min</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: "#000",
    },
    overlay: {
      flex: 1,
      justifyContent: "space-between",
    },
    topScrim: {
      backgroundColor: "rgba(0,0,0,0.45)",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      gap: spacing.xs,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    title: {
      color: "#fff",
      fontFamily: fonts.display,
      fontSize: 22,
      textAlign: "center",
    },
    timeLabel: {
      color: colors.live,
      fontFamily: fonts.monoBold,
      fontSize: 15,
      textAlign: "center",
    },
    bottomScrim: {
      backgroundColor: "rgba(0,0,0,0.45)",
      padding: spacing.xl,
      gap: spacing.lg,
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
      borderColor: "rgba(255,255,255,0.4)",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    snoozeButtonText: {
      color: "#fff",
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
    },
  });
}
