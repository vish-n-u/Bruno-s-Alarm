import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { isSubscribed, requestPermission, scheduleUpcomingSessions, unsubscribe } from "../lib/notifications";
import { fonts, radius, shadow, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

type Status = "checking" | "idle" | "subscribed" | "denied" | "unsupported";

export default function NotifyToggle() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [status, setStatus] = useState<Status>("checking");

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

  async function handleSubscribe() {
    const granted = await requestPermission();
    if (!granted) {
      setStatus("denied");
      return;
    }
    await scheduleUpcomingSessions();
    setStatus("subscribed");
  }

  async function handleUnsubscribe() {
    await unsubscribe();
    setStatus("idle");
  }

  if (status === "checking") {
    return (
      <View style={[styles.button, styles.disabled]}>
        <ActivityIndicator color={colors.accentText} />
      </View>
    );
  }

  if (status === "unsupported") {
    return (
      <View>
        <View style={[styles.button, styles.disabled]}>
          <Text style={styles.buttonText}>Notifications unavailable</Text>
        </View>
        <Text style={styles.statusLine}>
          Local notifications aren't supported on this device/simulator.
        </Text>
      </View>
    );
  }

  if (status === "subscribed") {
    return (
      <Pressable style={[styles.button, styles.subscribed]} onPress={handleUnsubscribe}>
        <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
        <Text style={[styles.buttonText, styles.subscribedText]}>
          You'll be notified — tap to turn off
        </Text>
      </Pressable>
    );
  }

  return (
    <View>
      <Pressable style={styles.button} onPress={handleSubscribe}>
        <Ionicons name="notifications-outline" size={18} color={colors.accentText} />
        <Text style={styles.buttonText}>Notify me for the next session</Text>
      </Pressable>
      {status === "denied" && (
        <Text style={styles.statusLine}>
          Notifications are blocked — enable them in your device settings.
        </Text>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  button: {
    width: "100%",
    flexDirection: "row",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    ...shadow,
  },
  disabled: {
    opacity: 0.6,
  },
  // Already-done state reads as quiet/flat on purpose — cancel the elevation, a transparent
  // outline button doesn't want to look like it's lifting off the page.
  subscribed: {
    backgroundColor: "transparent",
    borderColor: colors.accent,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: colors.accentText,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  subscribedText: {
    color: colors.accent,
  },
  statusLine: {
    textAlign: "center",
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  });
}
