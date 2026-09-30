import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Touchable from "./Touchable";
import {
  ALARM_SETTING_LABELS,
  ensureLiveAlarmPermissions,
  missingLiveAlarmSettings,
  type AlarmSetting,
} from "../lib/alarmPermissions";
import { tapLight } from "../lib/haptics";
import { fonts, radius, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

// Shown before the Live alarm can be switched on: what it does, the one honest catch, and which
// phone settings it'll ask for next. "Turn it on" then walks through only those
// (lib/alarmPermissions.ts, one app-styled dialog each).
type Props = {
  visible: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
};

export default function LiveAlarmSetupSheet({ visible, onConfirm, onCancel }: Props) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [needs, setNeeds] = useState<AlarmSetting[]>([]);

  useEffect(() => {
    if (!visible) return;
    setBlocked(false);
    missingLiveAlarmSettings().then(setNeeds);
  }, [visible]);

  async function handleTurnOn() {
    if (busy) return;
    tapLight();
    setBusy(true);
    setBlocked(false);
    try {
      if (!(await ensureLiveAlarmPermissions())) {
        setBlocked(true);
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

          <View style={styles.iconChip}>
            <Ionicons name="flash" size={22} color={colors.accent} />
          </View>
          <Text style={styles.title}>Ring when Bruno goes live</Text>
          <Text style={styles.body}>
            Bruno doesn't always keep to his schedule. Turn this on and your phone rings the moment
            he's on camera, day or night.
          </Text>
          <Text style={styles.note}>
            It depends on your phone waking the app, so now and then it may ring a little late. Your
            daily alarm doesn't rely on this.
          </Text>

          {needs.length > 0 && (
            <View style={styles.needsBox}>
              <Text style={styles.needsLabel}>You'll be asked to allow</Text>
              {needs.map((need) => (
                <View key={need} style={styles.needRow}>
                  <Ionicons name={ALARM_SETTING_LABELS[need].icon} size={18} color={colors.accent} />
                  <Text style={styles.needText}>{ALARM_SETTING_LABELS[need].label}</Text>
                </View>
              ))}
            </View>
          )}

          {blocked && (
            <Text style={styles.blockedText}>
              It can't ring without notifications and exact alarms. Allow both, then try again.
            </Text>
          )}

          <Touchable style={[styles.primaryButton, busy && styles.buttonBusy]} onPress={handleTurnOn} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={colors.accentText} />
            ) : (
              <Text style={styles.primaryButtonText}>Turn it on</Text>
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
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.lg + 8,
      borderTopRightRadius: radius.lg + 8,
      padding: spacing.xl,
      paddingTop: spacing.md,
    },
    grabber: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: spacing.xl,
    },
    iconChip: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.accentBg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.display,
      fontSize: 26,
      lineHeight: 32,
      marginBottom: spacing.sm,
    },
    body: {
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 21,
      marginBottom: spacing.sm,
    },
    note: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: spacing.lg,
    },
    needsBox: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    needsLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    needRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    needText: {
      color: colors.textPrimary,
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
    },
    blockedText: {
      color: colors.danger,
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: spacing.lg,
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
