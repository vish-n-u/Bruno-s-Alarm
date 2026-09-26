import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ensureAlarmPermissions } from "../lib/alarmPermissions";
import { tapLight } from "../lib/haptics";
import { isSubscribed, scheduleUpcomingSessions, unsubscribe } from "../lib/notifications";
import { fonts, radius, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

type Status = "checking" | "idle" | "subscribed" | "denied" | "unsupported";

export default function NotifyToggle() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isSubscribed()
      .then(async (subscribed) => {
        if (subscribed) {
          // Top up the schedule in case the initial batch is running low.
          await scheduleUpcomingSessions();
        }
        setStatus(subscribed ? "subscribed" : "idle");
      })
      .catch(() => setStatus("unsupported"));
  }, []);

  async function handleToggle(value: boolean) {
    if (busy) return;
    tapLight();
    setBusy(true);
    try {
      if (value) {
        const granted = await ensureAlarmPermissions();
        if (!granted) {
          setStatus("denied");
          return;
        }
        await scheduleUpcomingSessions();
        setStatus("subscribed");
      } else {
        await unsubscribe();
        setStatus("idle");
      }
    } finally {
      setBusy(false);
    }
  }

  const subtitle =
    status === "checking"
      ? "Checking…"
      : status === "unsupported"
        ? "Not supported on this device"
        : status === "denied"
          ? "Blocked, enable in device settings"
          : status === "subscribed"
            ? "On for Bruno's 6AM & 6PM sessions"
            : "Get woken up for Bruno's real sessions";

  return (
    <View style={styles.row}>
      <View style={styles.iconChip}>
        <Ionicons name="notifications" size={18} color={colors.accent} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Wake me up with Bruno</Text>
        <Text style={[styles.subtitle, status === "denied" && { color: colors.danger }]}>{subtitle}</Text>
      </View>
      {status === "checking" || busy ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <Switch
          value={status === "subscribed"}
          onValueChange={handleToggle}
          disabled={status === "unsupported"}
          trackColor={{ false: colors.surfaceAlt, true: colors.accent }}
          thumbColor={colors.surface}
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    iconChip: {
      width: 38,
      height: 38,
      borderRadius: radius.md,
      backgroundColor: colors.accentBg,
      alignItems: "center",
      justifyContent: "center",
    },
    textWrap: {
      flex: 1,
      gap: 2,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
    },
    subtitle: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 12,
    },
  });
}
