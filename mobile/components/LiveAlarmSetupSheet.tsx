import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Touchable from "./Touchable";
import { ensureLiveAlarmPermissions } from "../lib/alarmPermissions";
import { tapLight } from "../lib/haptics";
import { fonts, radius, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

// Shown before the Live alarm can be switched on — one line on what it does. "Turn it on" then
// asks for whatever settings are still missing (lib/alarmPermissions.ts, one dialog each).
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

  useEffect(() => {
    if (visible) setBlocked(false);
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
          <Text style={styles.body}>Your phone rings the moment he's on camera, day or night.</Text>

          {blocked && (
            <Text style={styles.blockedText}>
              Allow notifications and alarms, then try again.
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
      marginBottom: spacing.xl,
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
