import { useCallback, useState } from "react";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import appConfig from "../app.json";
import LiveAlarmToggle from "../components/LiveAlarmToggle";
import NotifyToggle from "../components/NotifyToggle";
import Touchable from "../components/Touchable";
import type { HomeStackParamList } from "../App";
import {
  cancelAllScheduledAlarms,
  getAllScheduledAlarms,
  requestPermission,
  scheduleTestAlarmSoon,
  type ScheduledAlarmKind,
  type ScheduledAlarmSummary,
} from "../lib/notifications";
import { describeSavedRecording, getCachedAlarmSoundPath, refreshAlarmSound } from "../lib/alarmSound";
import { success, tapLight, warning } from "../lib/haptics";
import { animateNextLayout } from "../lib/layoutAnim";
import { setDebugForceLive } from "../lib/schedule";
import { fonts, radius, shadow, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

const PRIVACY_POLICY_URL =
  "https://plant-garnet-37d.notion.site/BRUNO-S-ALARM-3d327ffbfc9180a3b404f1de22bf62b8";

const KIND_LABEL: Record<ScheduledAlarmKind, string> = {
  session: "Bruno's real sessions",
  custom: "Your custom alarms",
  test: "Test alarms",
  other: "Unrecognized",
};

const KIND_ICON: Record<ScheduledAlarmKind, keyof typeof Ionicons.glyphMap> = {
  session: "paw-outline",
  custom: "alarm-outline",
  test: "flask-outline",
  other: "help-circle-outline",
};

function formatAlarmTime(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return "unknown time";
  return new Date(timestamp).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

// One compact line instead of a paragraph — count/description plus next-fire time together,
// the way a person actually scans a settings row rather than reads it.
function describeGroup(kind: ScheduledAlarmKind, items: ScheduledAlarmSummary[]): string {
  const next = `Next ${formatAlarmTime(items[0].timestamp)}`;
  switch (kind) {
    case "session":
      return `Every day · ${next}`;
    case "custom":
      return next;
    case "test":
      return `${items.length} pending · ${next}`;
    case "other":
      return `${items.length} · ${next}`;
  }
}

// Primary sections (Notifications) get a real heading; secondary/reference sections
// (permissions, about, debug) get a quieter label — signals "less central" without a
// second all-caps convention. Both still sit in the same card treatment (icon rows,
// dividers) so the screen reads as one consistent list, not a mix of two card styles.
// "Debug" console rows keep their own distinct monospace treatment further below.
function SectionLabel({ children, variant = "primary" }: { children: string; variant?: "primary" | "secondary" }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  return <Text style={variant === "primary" ? styles.sectionLabel : styles.sectionLabelSecondary}>{children}</Text>;
}

// One icon-led row shape reused everywhere instead of paragraphs of explanation above each
// section — a short subtitle carries the "why" inline, the way a real settings app does.
function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  colors,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const Wrapper = onPress ? Touchable : View;
  return (
    <Wrapper style={styles.row} onPress={onPress}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} style={styles.rowIcon} />
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowText}>{title}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      {value ? (
        <Text style={styles.rowValue}>{value}</Text>
      ) : (
        onPress && <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      )}
    </Wrapper>
  );
}

type Props = NativeStackScreenProps<HomeStackParamList, "Settings">;

export default function SettingsScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const [forcingLive, setForcingLive] = useState(false);
  const [alarms, setAlarms] = useState<ScheduledAlarmSummary[]>([]);
  // The Debug section's own copy claims these tools aren't visible to real users — that was
  // only true in wording, not in practice, since every build (including what testers install
  // from Play Store) showed it unconditionally. Same unlock gesture Android itself uses for
  // its hidden developer options: tap the version number 7 times. `__DEV__` still shows it
  // automatically in a debug build, so local development is unaffected.
  const [versionTapCount, setVersionTapCount] = useState(0);
  const [debugUnlocked, setDebugUnlocked] = useState(__DEV__);

  function handleVersionTap() {
    if (debugUnlocked) return;
    const next = versionTapCount + 1;
    if (next >= 7) {
      success();
      animateNextLayout();
      setDebugUnlocked(true);
      Alert.alert("Debug tools unlocked", "Scroll down: a Debug section just appeared.");
      return;
    }
    // A light tick per tap, same idea as Android's own hidden-developer-options easter egg
    // giving escalating feedback — without it, the first six taps look like they do nothing.
    tapLight();
    setVersionTapCount(next);
  }

  const refreshAlarms = useCallback(() => {
    getAllScheduledAlarms()
      .then((fetched) => {
        animateNextLayout();
        setAlarms(fetched);
      })
      .catch(() => setAlarms([]));
  }, []);

  // Refresh every time this screen comes into focus, not just on first mount — so it
  // reflects whatever just changed (subscribed/unsubscribed, set a custom alarm, ran a
  // debug test) without needing a manual pull-to-refresh.
  useFocusEffect(refreshAlarms);

  function handleClearAll() {
    Alert.alert(
      "Clear all scheduled alarms?",
      "Cancels every alarm: real sessions, your custom alarm, and any leftover test alarms. You'll need to re-subscribe/re-enable afterward.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: async () => {
            warning();
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
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + insets.bottom }]}
    >
      <View style={styles.card}>
        <NotifyToggle />
      </View>

      {Platform.OS === "android" && (
        <View style={[styles.card, { marginTop: spacing.md }]}>
          <LiveAlarmToggle />
        </View>
      )}

      <SectionLabel variant="secondary">About</SectionLabel>
      <View style={styles.card}>
        <SettingsRow
          icon="shield-checkmark-outline"
          title="Privacy Policy"
          onPress={() => {
            tapLight();
            Linking.openURL(PRIVACY_POLICY_URL);
          }}
          colors={colors}
          styles={styles}
        />
        <View style={styles.rowDivider} />
        <SettingsRow
          icon="information-circle-outline"
          title="Version"
          value={appConfig.expo.version}
          onPress={handleVersionTap}
          colors={colors}
          styles={styles}
        />
      </View>

      {debugUnlocked && (
        <>
          <SectionLabel variant="secondary">Scheduled alarms</SectionLabel>
          <View style={styles.card}>
            {groups.length === 0 ? (
              <Text style={styles.cardHint}>Nothing scheduled right now.</Text>
            ) : (
              groups.map((group, index) => (
                <View key={group.kind}>
                  {index > 0 && <View style={styles.rowDivider} />}
                  <SettingsRow
                    icon={KIND_ICON[group.kind]}
                    title={KIND_LABEL[group.kind]}
                    subtitle={describeGroup(group.kind, group.items)}
                    onPress={
                      group.kind === "custom"
                        ? () => {
                            tapLight();
                            navigation.navigate("CustomAlarm");
                          }
                        : undefined
                    }
                    colors={colors}
                    styles={styles}
                  />
                </View>
              ))
            )}
            {alarms.length > 0 && (
              <Touchable style={styles.dangerButton} onPress={handleClearAll}>
                <Text style={styles.dangerButtonText}>Clear all scheduled alarms</Text>
              </Touchable>
            )}
          </View>

          <SectionLabel variant="secondary">Debug</SectionLabel>
          <View style={styles.consoleList}>
            <Touchable
              style={styles.consoleRow}
              onPress={() => {
                tapLight();
                navigation.navigate("OnboardingPreview");
              }}
            >
              <Text style={styles.consoleText}>&gt; preview onboarding</Text>
            </Touchable>
            <View style={styles.rowDivider} />
            <Touchable
              style={styles.consoleRow}
              onPress={() => {
                tapLight();
                navigation.navigate("WeatherPreview");
              }}
            >
              <Text style={styles.consoleText}>&gt; preview weather &amp; time</Text>
            </Touchable>
            {Platform.OS === "android" && (
              <>
                <View style={styles.rowDivider} />
                <Touchable
                  style={styles.consoleRow}
                  onPress={async () => {
                    tapLight();
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
                  <Text style={styles.consoleText}>&gt; test alarm in 90s</Text>
                </Touchable>
                <View style={styles.rowDivider} />
                <Touchable
                  style={styles.consoleRow}
                  onPress={() => {
                    tapLight();
                    const next = !forcingLive;
                    setDebugForceLive(next ? true : null);
                    setForcingLive(next);
                  }}
                >
                  <Text style={[styles.consoleText, forcingLive && { color: colors.live }]}>
                    {forcingLive ? "> forcing live, tap to clear" : "> force live (debug)"}
                  </Text>
                </Touchable>
                <View style={styles.rowDivider} />
                <Touchable
                  style={styles.consoleRow}
                  onPress={async () => {
                    // Calls the exact function the periodic background task runs — a much more
                    // direct test than expo-background-task's own trigger-for-testing API, which
                    // silently no-ops whenever the app is in the foreground (i.e. always, when
                    // you're the one tapping this button).
                    tapLight();
                    await refreshAlarmSound();
                    const path = await getCachedAlarmSoundPath();
                    const summary = await describeSavedRecording();
                    Alert.alert(
                      path ? "Refreshed" : "No cached sound",
                      path
                        ? summary
                        : summary + "\n\nNothing is cached. Check EXPO_PUBLIC_BACKEND_URL and network access."
                    );
                  }}
                >
                  <Text style={styles.consoleText}>&gt; run background sound refresh now</Text>
                </Touchable>
                <Touchable
                  style={styles.consoleRow}
                  onPress={async () => {
                    tapLight();
                    Alert.alert("Saved recording", await describeSavedRecording());
                  }}
                >
                  <Text style={styles.consoleText}>&gt; saved recording status</Text>
                </Touchable>
              </>
            )}
          </View>
        </>
      )}
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
    // Primary sections (Notifications, Scheduled alarms) get a real heading — sentence
    // case, no letter-spacing — instead of the generic uppercase-tracked dashboard label.
    sectionLabel: {
      color: colors.textPrimary,
      fontFamily: fonts.displaySemiBold,
      fontSize: 16,
      marginBottom: spacing.sm,
      marginTop: spacing.xl,
    },
    // Secondary/reference sections get a quieter label — signals "less central" without
    // resorting to the same all-caps treatment used everywhere before.
    sectionLabelSecondary: {
      color: colors.textSecondary,
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      marginBottom: spacing.xs,
      marginTop: spacing.xl,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadow,
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
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    rowIcon: {
      width: 20,
    },
    rowTextWrap: {
      flex: 1,
      gap: 1,
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
    rowSubtitle: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 12,
    },
    rowValue: {
      color: colors.textSecondary,
      fontFamily: fonts.mono,
      fontSize: 14,
    },
    // A real, user-facing destructive action — styled as an honest outlined button, not a
    // dashed "debug" pill.
    dangerButton: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
    },
    dangerButtonText: {
      color: colors.danger,
      fontFamily: fonts.bodyBold,
      fontSize: 14,
    },
    // Debug tools read like console output rather than styled buttons — deliberately
    // distinct from every real control elsewhere in the app.
    consoleList: {
      gap: 0,
    },
    consoleRow: {
      paddingVertical: spacing.md,
    },
    consoleText: {
      color: colors.textSecondary,
      fontFamily: fonts.mono,
      fontSize: 13,
    },
  });
}
