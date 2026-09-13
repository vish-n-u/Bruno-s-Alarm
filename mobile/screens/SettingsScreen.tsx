import { useCallback, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import appConfig from "../app.json";
import NotifyToggle from "../components/NotifyToggle";
import type { RootStackParamList } from "../App";
import {
  cancelAllScheduledAlarms,
  getAllScheduledAlarms,
  openAlarmPermissionSettings,
  openFullScreenIntentSettings,
  requestPermission,
  scheduleTestAlarmSoon,
  type ScheduledAlarmKind,
  type ScheduledAlarmSummary,
} from "../lib/notifications";
import { getCustomAlarm, type CustomAlarmState, type RepeatMode } from "../lib/customAlarm";
import { setDebugForceLive } from "../lib/schedule";
import { fonts, radius, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

const PRIVACY_POLICY_URL =
  "https://plant-garnet-37d.notion.site/BRUNO-S-ALARM-3d327ffbfc9180a3b404f1de22bf62b8";

const KIND_LABEL: Record<ScheduledAlarmKind, string> = {
  session: "Real sessions (Bruno's actual schedule)",
  custom: "Your custom alarm",
  test: "Debug test alarms",
  other: "Unrecognized",
};

function formatAlarmTime(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return "unknown time";
  return new Date(timestamp).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeOnly(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return "unknown time";
  return new Date(timestamp).toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

const REPEAT_DESCRIPTION: Record<RepeatMode, string> = {
  once: "Once",
  everyday: "Every day",
  weekdays: "Weekdays",
  custom: "",
};
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function describeCustomPattern(customState: CustomAlarmState | null): string {
  if (!customState) return "Daily";
  if (customState.repeatMode === "custom") {
    return customState.customDays.length
      ? customState.customDays.slice().sort().map((d) => DAY_NAMES[d]).join(", ")
      : "Custom";
  }
  return REPEAT_DESCRIPTION[customState.repeatMode];
}

// A real alarm clock never shows someone "14 alarms" for one daily 7:00 AM repeat — that
// count is only an artifact of how Android's lack of native daily-recurrence forces this
// app to pre-schedule a batch of individual future occurrences (see lib/notifications.ts /
// lib/customAlarm.ts). Describe each group the way a person actually thinks about it.
function describeGroup(
  kind: ScheduledAlarmKind,
  items: ScheduledAlarmSummary[],
  customState: CustomAlarmState | null
): string {
  switch (kind) {
    case "session":
      return "6:00 AM & 6:00 PM IST, every day";
    case "custom":
      return `${describeCustomPattern(customState)} at ${formatTimeOnly(items[0].timestamp)}`;
    case "test":
      return items.length === 1 ? "1 test alarm pending" : `${items.length} test alarms pending`;
    case "other":
      return items.length === 1 ? "1 unrecognized alarm" : `${items.length} unrecognized alarms`;
  }
}

function SectionLabel({ children }: { children: string }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export default function SettingsScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [forcingLive, setForcingLive] = useState(false);
  const [alarms, setAlarms] = useState<ScheduledAlarmSummary[]>([]);
  const [customState, setCustomState] = useState<CustomAlarmState | null>(null);

  const refreshAlarms = useCallback(() => {
    getAllScheduledAlarms()
      .then(setAlarms)
      .catch(() => setAlarms([]));
    getCustomAlarm()
      .then(setCustomState)
      .catch(() => setCustomState(null));
  }, []);

  // Refresh every time this screen comes into focus, not just on first mount — so it
  // reflects whatever just changed (subscribed/unsubscribed, set a custom alarm, ran a
  // debug test) without needing a manual pull-to-refresh.
  useFocusEffect(refreshAlarms);

  function handleClearAll() {
    Alert.alert(
      "Clear all scheduled alarms?",
      "Cancels every alarm — real sessions, your custom alarm, and any leftover test alarms. You'll need to re-subscribe/re-enable afterward.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: async () => {
            await cancelAllScheduledAlarms();
            refreshAlarms();
          },
        },
      ]
    );
  }

  const groups: { kind: ScheduledAlarmKind; items: ScheduledAlarmSummary[] }[] = (
    ["session", "custom", "test", "other"] as ScheduledAlarmKind[]
  )
    .map((kind) => ({ kind, items: alarms.filter((a) => a.kind === kind) }))
    .filter((g) => g.items.length > 0);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <SectionLabel>Notifications</SectionLabel>
      <View style={styles.card}>
        <NotifyToggle />
      </View>

      <SectionLabel>Scheduled alarms</SectionLabel>
      <View style={styles.card}>
        {groups.length === 0 ? (
          <Text style={styles.cardHint}>Nothing scheduled right now.</Text>
        ) : (
          groups.map((group, index) => (
            <View key={group.kind}>
              {index > 0 && <View style={styles.rowDivider} />}
              <Text style={styles.rowText}>{KIND_LABEL[group.kind]}</Text>
              <Text style={styles.cardHint}>{describeGroup(group.kind, group.items, customState)}</Text>
              <Text style={styles.cardHint}>Next: {formatAlarmTime(group.items[0].timestamp)}</Text>
            </View>
          ))
        )}
        {alarms.length > 0 && (
          <Pressable style={styles.debugButton} onPress={handleClearAll}>
            <Ionicons name="trash-outline" size={15} color={colors.danger} />
            <Text style={[styles.debugButtonText, { color: colors.danger }]}>
              Clear all scheduled alarms
            </Text>
          </Pressable>
        )}
      </View>

      {Platform.OS === "android" && (
        <>
          <SectionLabel>Real alarm permissions</SectionLabel>
          <View style={styles.card}>
            <Text style={styles.cardHint}>
              One-time setup so the alarm actually rings through Do Not Disturb and over the
              lock screen — safe to revisit any time.
            </Text>
            <Pressable style={styles.row} onPress={openAlarmPermissionSettings}>
              <Text style={styles.rowText}>Allow exact alarms</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </Pressable>
            <View style={styles.rowDivider} />
            <Pressable style={styles.row} onPress={openFullScreenIntentSettings}>
              <Text style={styles.rowText}>Allow full-screen alerts</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
        </>
      )}

      <SectionLabel>About</SectionLabel>
      <View style={styles.card}>
        <Text style={styles.cardHint}>
          Bruno is a real dog who howls at a church bell, twice a day, no accounts and no
          tracking involved.
        </Text>
        <Pressable style={styles.row} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
          <Text style={styles.rowText}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>
        <View style={styles.rowDivider} />
        <View style={styles.row}>
          <Text style={styles.rowText}>Version</Text>
          <Text style={styles.rowValue}>{appConfig.expo.version}</Text>
        </View>
      </View>

      <SectionLabel>Debug</SectionLabel>
      <View style={styles.card}>
        <Text style={styles.cardHint}>Testing tools — not visible to real users.</Text>
        <Pressable style={styles.debugButton} onPress={() => navigation.navigate("OnboardingPreview")}>
          <Ionicons name="eye-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.debugButtonText}>Preview onboarding</Text>
        </Pressable>
        {Platform.OS === "android" && (
          <>
            <Pressable
              style={styles.debugButton}
              onPress={async () => {
                const granted = await requestPermission();
                if (!granted) {
                  Alert.alert("Permission needed", "Grant notification permission first.");
                  return;
                }
                await scheduleTestAlarmSoon();
                refreshAlarms();
                Alert.alert("Test alarm set", "Fires in ~90 seconds. Lock the phone and try silent/DND now.");
              }}
            >
              <Ionicons name="flask-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.debugButtonText}>Test alarm in 90s</Text>
            </Pressable>
            <Pressable
              style={styles.debugButton}
              onPress={() => {
                const next = !forcingLive;
                setDebugForceLive(next ? true : null);
                setForcingLive(next);
              }}
            >
              <Ionicons name="radio-button-on" size={15} color={colors.live} />
              <Text style={styles.debugButtonText}>
                {forcingLive ? "Forcing LIVE — tap to clear" : "Force LIVE (debug)"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    sectionLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: spacing.sm,
      marginTop: spacing.lg,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    cardHint: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 19,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.sm,
    },
    rowDivider: {
      height: 1,
      backgroundColor: colors.border,
    },
    rowText: {
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: 15,
    },
    rowValue: {
      color: colors.textSecondary,
      fontFamily: fonts.mono,
      fontSize: 14,
    },
    debugButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
      borderRadius: radius.md,
      paddingVertical: spacing.md,
    },
    debugButtonText: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 13,
    },
  });
}
