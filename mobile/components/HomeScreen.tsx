import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import EditCustomAlarmModal from "./EditCustomAlarmModal";
import Sky from "./Sky";
import Touchable from "./Touchable";
import type { HomeStackParamList } from "../App";
import {
  getCustomAlarms,
  setCustomAlarmEnabled,
  type CustomAlarm,
  type RepeatMode,
} from "../lib/customAlarm";
import { ensureAlarmPermissions } from "../lib/alarmPermissions";
import { tapLight } from "../lib/haptics";
import { animateNextLayout } from "../lib/layoutAnim";
import { isSubscribed, scheduleUpcomingSessions } from "../lib/notifications";
import { consumeNewAlarmRequest } from "../lib/onboarding";
import { sessionTimesLabel, todaysSessions } from "../lib/schedule";
import { fonts, radius, shadow, spacing, useNow, useThemeColors, type ThemeColors } from "../lib/theme";
import { useWeatherCondition } from "../lib/weather";

// Matches screens/CustomAlarmScreen.tsx's own repeat-summary convention exactly, so an
// alarm reads the same way whether you're looking at it on Home or on the full list.
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

function formatAlarmTime(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Onboarding no longer offers Bruno's daily alarm, so Home does — once, until turned on or
// dismissed. Settings keeps the toggle either way.
const DAILY_ALARM_CARD_DISMISSED_KEY = "bruno-daily-alarm-card-dismissed";

function formatLocalTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

type Props = NativeStackScreenProps<HomeStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  // Ticks every 15s (rather than theme.ts's own once-a-minute clock) specifically so the
  // sky's sun/moon position has enough steps to glide smoothly instead of jumping.
  const now = useNow(15000);
  // A "hint," not a forecast — null (loading, or the lookup failed) is treated exactly like
  // "clear" so the sky just falls back to how it's always looked, never a loading state of
  // its own. See lib/weather.ts for why this needs no location permission.
  const weatherCondition = useWeatherCondition();

  const [customAlarms, setCustomAlarms] = useState<CustomAlarm[]>([]);
  const [brunoSubscribed, setBrunoSubscribed] = useState(false);
  const [editModalAlarmId, setEditModalAlarmId] = useState<string | undefined>(undefined);
  const [editModalVisible, setEditModalVisible] = useState(false);
  // Starts true so the card doesn't flash in for a moment before the saved choice loads.
  const [dailyCardDismissed, setDailyCardDismissed] = useState(true);
  const [turningOnDaily, setTurningOnDaily] = useState(false);

  // Onboarding's "Set my first alarm" lands here — open the new-alarm sheet straight away.
  useEffect(() => {
    if (consumeNewAlarmRequest()) openNewAlarm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(DAILY_ALARM_CARD_DISMISSED_KEY)
      .then((value) => setDailyCardDismissed(value === "1"))
      .catch(() => setDailyCardDismissed(false));
  }, []);

  async function turnOnDailyAlarm() {
    if (turningOnDaily) return;
    tapLight();
    setTurningOnDaily(true);
    try {
      // Asks for whatever is still missing and explains it; false means it already said why.
      if (!(await ensureAlarmPermissions())) return;
      await scheduleUpcomingSessions();
      animateNextLayout();
      setBrunoSubscribed(true);
    } finally {
      setTurningOnDaily(false);
    }
  }

  function dismissDailyCard() {
    tapLight();
    animateNextLayout();
    setDailyCardDismissed(true);
    AsyncStorage.setItem(DAILY_ALARM_CARD_DISMISSED_KEY, "1").catch(() => {});
  }

  const refreshCustomAlarms = useCallback(() => {
    getCustomAlarms()
      .then((alarms) => {
        animateNextLayout();
        setCustomAlarms(alarms);
      })
      .catch(() => setCustomAlarms([]));
  }, []);

  // Refreshed on every focus, not just mount — reflects an alarm just added/edited/removed,
  // or the real-session subscription being turned on/off from onboarding or Settings,
  // without needing to leave and re-enter the Home tab.
  useFocusEffect(
    useCallback(() => {
      refreshCustomAlarms();
      isSubscribed()
        .then((subscribed) => {
          animateNextLayout();
          setBrunoSubscribed(subscribed);
        })
        .catch(() => setBrunoSubscribed(false));
    }, [refreshCustomAlarms])
  );

  const [brunoSessionA, brunoSessionB] = todaysSessions();
  const brunoTimeLabel = `${formatLocalTime(brunoSessionA)} & ${formatLocalTime(brunoSessionB)}`;

  // Same optimistic-update-then-persist pattern as CustomAlarmScreen's own toggle — lets
  // someone flip an alarm on/off right from Home without opening the full list.
  async function toggleCustomAlarm(alarm: CustomAlarm, value: boolean) {
    tapLight();
    if (value && !(await ensureAlarmPermissions())) return;
    setCustomAlarms((prev) => prev.map((a) => (a.id === alarm.id ? { ...a, enabled: value } : a)));
    await setCustomAlarmEnabled(alarm.id, value);
  }

  function openNewAlarm() {
    setEditModalAlarmId(undefined);
    setEditModalVisible(true);
  }

  function openEditAlarm(alarmId: string) {
    setEditModalAlarmId(alarmId);
    setEditModalVisible(true);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* A real sky behind the content — real vector glyphs (already in the icon set the
          app uses everywhere else) instead of hand-built shapes, so they actually look
          designed rather than pasted-on clip art. Purely decorative: renders behind the
          ScrollView (transparent background) and never intercepts touches. The sun/moon's
          position tracks the real clock, clouds/rain/snow/fog reflect the real weather hint,
          and leaves fall on their own independent loop — see components/Sky.tsx, which this
          same rendering is shared with screens/WeatherPreviewScreen.tsx's debug slider. */}
      <Sky now={now} weatherCondition={weatherCondition} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.main}>
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.title}>Bruno's Alarm</Text>
              <Text style={styles.subtitle}>A real dog. Live twice a day.</Text>
            </View>
            <Touchable
              style={styles.settingsButton}
              onPress={() => {
                tapLight();
                navigation.navigate("Settings");
              }}
              hitSlop={12}
            >
              <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
            </Touchable>
          </View>

          {brunoSubscribed && (
            <Touchable
              style={styles.brunoCard}
              onPress={() => {
                tapLight();
                navigation.navigate("Settings");
              }}
            >
              <View style={styles.alarmCardLeft}>
                <Text style={styles.brunoCardTime}>{brunoTimeLabel}</Text>
                <Text style={styles.brunoCardLabel}>Bruno's daily alarm · Every day</Text>
              </View>
              <View style={styles.brunoTag}>
                <Text style={styles.brunoTagText}>BRUNO</Text>
              </View>
            </Touchable>
          )}

          {!brunoSubscribed && !dailyCardDismissed && (
            <View style={styles.dailyCard}>
              <Text style={styles.dailyCardTitle}>Bruno's daily alarm</Text>
              <Text style={styles.dailyCardBody}>Rings when he howls, around {sessionTimesLabel()}.</Text>
              <View style={styles.dailyCardActions}>
                <Touchable style={styles.dailyCardButton} onPress={turnOnDailyAlarm} disabled={turningOnDaily}>
                  <Text style={styles.dailyCardButtonText}>{turningOnDaily ? "Turning on…" : "Turn on"}</Text>
                </Touchable>
                <Touchable onPress={dismissDailyCard} hitSlop={8} disabled={turningOnDaily}>
                  <Text style={styles.dailyCardDismiss}>Not now</Text>
                </Touchable>
              </View>
            </View>
          )}

          {!brunoSubscribed && customAlarms.length === 0 && (
            <View style={styles.emptyState}>
              <LottieView
                source={require("../assets/animations/sleepy-dog.json")}
                autoPlay
                loop
                style={styles.emptyLottie}
              />
              <Text style={styles.emptyText}>Nothing scheduled yet. Tap + to set an alarm.</Text>
            </View>
          )}

          {customAlarms.length > 0 && (
            <View style={styles.yourAlarmsSection}>
              <Text style={styles.yourAlarmsLabel}>Your alarms</Text>
              {customAlarms.map((alarm) => (
                <Touchable
                  key={alarm.id}
                  style={[styles.alarmCard, !alarm.enabled && styles.alarmCardDisabled]}
                  onPress={() => {
                    tapLight();
                    openEditAlarm(alarm.id);
                  }}
                >
                  <View style={styles.alarmCardLeft}>
                    <Text style={[styles.alarmTime, !alarm.enabled && styles.alarmTextDisabled]}>
                      {formatAlarmTime(alarm.hour, alarm.minute)}
                    </Text>
                    <Text style={[styles.alarmName, !alarm.enabled && styles.alarmTextDisabled]} numberOfLines={1}>
                      {repeatSummary(alarm)}
                      {alarm.name.trim() ? ` · ${alarm.name.trim()}` : ""}
                    </Text>
                  </View>
                  <Switch
                    value={alarm.enabled}
                    onValueChange={(value) => toggleCustomAlarm(alarm, value)}
                    trackColor={{ false: colors.surfaceAlt, true: colors.accent }}
                    thumbColor={colors.surface}
                  />
                </Touchable>
              ))}
              <Touchable
                style={styles.manageAlarmsRow}
                onPress={() => {
                  tapLight();
                  navigation.navigate("CustomAlarm");
                }}
              >
                <Text style={styles.manageAlarmsText}>Manage alarms</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </Touchable>
            </View>
          )}
        </View>

        {/* A quiet closing mark, not more content — gives the page a deliberate bottom
            edge instead of trailing off into empty space below the last real control. */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <Ionicons name="paw" size={14} color={colors.textSecondary} />
        </View>
      </ScrollView>

      <Touchable
        style={styles.fab}
        onPress={() => {
          tapLight();
          openNewAlarm();
        }}
        hitSlop={8}
      >
        <Ionicons name="add" size={28} color={colors.accentText} />
      </Touchable>

      <EditCustomAlarmModal
        visible={editModalVisible}
        alarmId={editModalAlarmId}
        onClose={() => setEditModalVisible(false)}
        onSaved={refreshCustomAlarms}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flexGrow: 1,
      justifyContent: "space-between",
      // More breathing room than the standard spacing.xl inset — the bold uppercase title
      // especially read as hugging the screen edge at the tighter margin.
      paddingHorizontal: spacing.xxl,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xxl,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.xxl - spacing.xs,
      gap: spacing.md,
    },
    headerTitleWrap: {
      flex: 1,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.display,
      fontSize: 26,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 3,
    },
    subtitle: {
      color: colors.textSecondary,
      fontFamily: fonts.hand,
      fontSize: 17,
    },
    settingsButton: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    // Bruno's real-session subscription reads as a distinct thing from a custom alarm you
    // set yourself — same card shape as alarmCard below for rhythm, but a live-colored left
    // edge and a small tag instead of a switch, since this isn't something you toggle here
    // (that lives in Settings' Notifications section — tapping this card goes there).
    brunoCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 3,
      borderLeftColor: colors.live,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      ...shadow,
    },
    brunoCardTime: {
      color: colors.textPrimary,
      fontFamily: fonts.monoBold,
      fontSize: 22,
    },
    brunoCardLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 13,
    },
    brunoTag: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.live,
    },
    brunoTagText: {
      color: "#fff",
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 0.5,
    },
    // Same card shape as brunoCard (it's what that card becomes once turned on), with a dashed
    // edge so it reads as an offer rather than something already set.
    dailyCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      gap: spacing.xs,
    },
    dailyCardTitle: {
      color: colors.textPrimary,
      fontFamily: fonts.bodyBold,
      fontSize: 16,
    },
    dailyCardBody: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 13,
    },
    dailyCardActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
      marginTop: spacing.sm,
    },
    dailyCardButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accent,
    },
    dailyCardButtonText: {
      color: colors.accentText,
      fontFamily: fonts.bodyBold,
      fontSize: 14,
    },
    dailyCardDismiss: {
      color: colors.textSecondary,
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
    },
    // Fills the space left under the header so the empty state can sit in its middle.
    main: {
      flex: 1,
    },
    // Takes all the room between the header and the footer and centres the illustration +
    // caption in it, like a system empty state, instead of stacking right under the header.
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
      paddingVertical: spacing.xl,
    },
    // sleepy-dog.json's canvas is 400x300; keep that ratio so the scene isn't letterboxed
    // off-centre inside a square box.
    emptyLottie: {
      width: "80%",
      maxWidth: 300,
      aspectRatio: 4 / 3,
    },
    emptyText: {
      color: colors.textSecondary,
      fontFamily: fonts.hand,
      fontSize: 17,
      textAlign: "center",
    },
    yourAlarmsSection: {
      marginBottom: spacing.lg,
      gap: spacing.md,
    },
    yourAlarmsLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    // Same card language as screens/CustomAlarmScreen.tsx's own list — big legible time,
    // label underneath, a real toggle you can flip right here — so an alarm looks and
    // behaves the same whether you're seeing it on Home or on the full list.
    alarmCard: {
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
    alarmCardDisabled: {
      opacity: 0.55,
    },
    alarmCardLeft: {
      gap: spacing.xs,
    },
    alarmTime: {
      color: colors.textPrimary,
      fontFamily: fonts.monoBold,
      fontSize: 28,
    },
    alarmName: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 13,
    },
    alarmTextDisabled: {
      color: colors.textSecondary,
    },
    manageAlarmsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.sm,
    },
    manageAlarmsText: {
      color: colors.textPrimary,
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
    },
    // Same FAB as screens/CustomAlarmScreen.tsx — a quick "add" reachable straight from
    // Home, not just from "Manage alarms".
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
    footer: {
      alignItems: "center",
      gap: spacing.sm,
      paddingTop: spacing.xl,
    },
    footerDivider: {
      width: 32,
      height: 1,
      backgroundColor: colors.border,
      marginBottom: spacing.xs,
    },
  });
}
