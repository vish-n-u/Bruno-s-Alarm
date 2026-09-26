import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Touchable from "./Touchable";
import { openAlarmPermissionSettings, openAppSettings, openFullScreenIntentSettings, requestPermission } from "../lib/notifications";
import { tapLight } from "../lib/haptics";
import { fonts, radius, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

// Shown before the Live alarm can be switched on. It's an honest opt-in: this feature is less
// reliable than the scheduled 6AM/6PM alarm by nature (it depends on the phone letting the app
// wake up for a push), so the drawbacks come first and the needed permissions are one tap each.
const DRAWBACKS = [
  "It can ring at any hour. Whenever Bruno goes live, including an early, late or test stream.",
  "It's not guaranteed. It won't ring if the app was force-stopped, or swiped away from recent apps on many phones, or the phone's battery saver blocks it.",
  "Keep the app in your recent apps and allow it to run in the background (steps below).",
  "The 6AM & 6PM alarm is separate and is the reliable one. This is an extra.",
];

type Props = {
  visible: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
};

export default function LiveAlarmSetupSheet({ visible, onConfirm, onCancel }: Props) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  async function handleTurnOn() {
    if (busy) return;
    // Fires immediately — requestPermission() below can pop a system dialog, and the tap
    // should feel acknowledged before that even appears.
    tapLight();
    setBusy(true);
    setDenied(false);
    try {
      const granted = await requestPermission();
      if (!granted) {
        setDenied(true);
        return;
      }
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTapArea} onPress={onCancel} />
        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <View style={styles.grabber} />
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Ionicons name="flash-outline" size={22} color={colors.accent} />
              <Text style={styles.title}>Ring when Bruno goes live</Text>
            </View>

            <Text style={styles.sectionLabel}>Read this first</Text>
            <View style={styles.list}>
              {DRAWBACKS.map((line) => (
                <View key={line} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>{line}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Allow these on your phone</Text>
            <View style={styles.permissionCard}>
              <PermissionRow
                icon="alarm-outline"
                title="Exact alarms"
                hint="So it rings the moment he goes live"
                onPress={openAlarmPermissionSettings}
                colors={colors}
                styles={styles}
              />
              <View style={styles.divider} />
              <PermissionRow
                icon="phone-portrait-outline"
                title="Full-screen alerts"
                hint="So it shows over the lock screen"
                onPress={openFullScreenIntentSettings}
                colors={colors}
                styles={styles}
              />
              <View style={styles.divider} />
              <PermissionRow
                icon="battery-charging-outline"
                title="Battery & background"
                hint="Set battery to Unrestricted and allow auto-start, if your phone has it"
                onPress={openAppSettings}
                colors={colors}
                styles={styles}
              />
            </View>
            <Text style={styles.footnote}>Notifications will be requested when you turn it on.</Text>

            {denied && (
              <Text style={styles.deniedText}>
                Notifications are blocked. Allow them in your phone's settings, then try again.
              </Text>
            )}
          </ScrollView>

          <Touchable style={[styles.primaryButton, busy && styles.buttonBusy]} onPress={handleTurnOn} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={colors.accentText} />
              ) : (
                <Text style={styles.primaryButtonText}>Turn on live alarm</Text>
              )}
          </Touchable>
          <Touchable
            style={styles.cancelButton}
            onPress={() => {
              tapLight();
              onCancel();
            }}
          >
            <Text style={styles.cancelButtonText}>Not now</Text>
          </Touchable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function PermissionRow({
  icon,
  title,
  hint,
  onPress,
  colors,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Touchable
      style={styles.permissionRow}
      onPress={() => {
        tapLight();
        onPress();
      }}
    >
      <Ionicons name={icon} size={20} color={colors.accent} />
      <View style={styles.permissionText}>
        <Text style={styles.permissionTitle}>{title}</Text>
        <Text style={styles.permissionHint}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Touchable>
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
      maxHeight: "88%",
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.lg + 8,
      borderTopRightRadius: radius.lg + 8,
      padding: spacing.xl,
    },
    scroll: {
      flexShrink: 1,
      marginBottom: spacing.md,
    },
    grabber: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: spacing.lg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.displaySemiBold,
      fontSize: 18,
    },
    sectionLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    list: {
      gap: spacing.md,
      marginBottom: spacing.xl,
    },
    bulletRow: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "flex-start",
    },
    bulletDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.textSecondary,
      marginTop: 7,
    },
    bulletText: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: 14,
      lineHeight: 20,
    },
    permissionCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
    },
    permissionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    permissionText: {
      flex: 1,
      gap: 2,
    },
    permissionTitle: {
      color: colors.textPrimary,
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
    },
    permissionHint: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 12,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    footnote: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 12,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    deniedText: {
      color: colors.danger,
      fontFamily: fonts.body,
      fontSize: 13,
      marginBottom: spacing.md,
    },
    primaryButton: {
      paddingVertical: spacing.lg - 2,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accent,
      alignItems: "center",
    },
    primaryButtonText: {
      color: colors.accentText,
      fontFamily: fonts.bodyBold,
      fontSize: 15,
    },
    buttonBusy: {
      opacity: 0.6,
    },
    cancelButton: {
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 14,
    },
  });
}
