import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PermissionIllustration from "./PermissionIllustration";
import Touchable from "./Touchable";
import { tapLight } from "../lib/haptics";
import { registerDialogHost, type DialogButton, type PendingDialog } from "../lib/dialog";
import { fonts, radius, shadow, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

// Renders lib/dialog.ts's pop-ups. Mounted once in App.tsx; being a Modal, it shows above
// everything, including other open sheets (e.g. the live alarm setup sheet).
export default function AppDialogHost() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [dialog, setDialog] = useState<PendingDialog | null>(null);

  useEffect(() => registerDialogHost(setDialog), []);

  function close(index: number | null) {
    tapLight();
    const current = dialog;
    setDialog(null);
    current?.resolve(index);
  }

  // Cancel-style buttons go last, as a plain text link under the real choices.
  const buttons = (dialog?.buttons ?? []).map((button, index) => ({ button, index }));
  const actions = buttons.filter(({ button }) => button.style !== "cancel");
  const cancels = buttons.filter(({ button }) => button.style === "cancel");

  function buttonStyles(button: DialogButton) {
    switch (button.style) {
      case "primary":
        return [styles.button, styles.primaryButton, styles.primaryButtonText] as const;
      case "destructive":
        return [styles.button, styles.destructiveButton, styles.destructiveButtonText] as const;
      default:
        return [styles.button, styles.defaultButton, styles.defaultButtonText] as const;
    }
  }

  return (
    <Modal
      visible={dialog !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => close(null)}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close(null)} />
        {dialog && (
          <View style={styles.card}>
            {dialog.progress && <Text style={styles.progress}>{dialog.progress}</Text>}
            {dialog.illustration ? (
              <PermissionIllustration kind={dialog.illustration} />
            ) : dialog.icon ? (
              <View style={styles.iconChip}>
                <Ionicons name={dialog.icon} size={22} color={colors.accent} />
              </View>
            ) : null}

            <Text style={styles.title}>{dialog.title}</Text>
            {dialog.body ? <Text style={styles.body}>{dialog.body}</Text> : <View style={styles.noBody} />}

            <View style={styles.actions}>
              {actions.map(({ button, index }) => {
                const [base, variant, text] = buttonStyles(button);
                return (
                  <Touchable key={index} style={[base, variant]} onPress={() => close(index)}>
                    <Text style={text}>{button.label}</Text>
                  </Touchable>
                );
              })}
            </View>
            {cancels.map(({ button, index }) => (
              <Touchable key={index} style={styles.cancelButton} onPress={() => close(index)}>
                <Text style={styles.cancelButtonText}>{button.label}</Text>
              </Touchable>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "center",
      padding: spacing.xl,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg + 4,
      padding: spacing.xl,
      ...shadow,
    },
    progress: {
      color: colors.textSecondary,
      fontFamily: fonts.monoBold,
      fontSize: 13,
      letterSpacing: 1,
      textTransform: "uppercase",
      textAlign: "right",
      marginBottom: spacing.sm,
    },
    iconChip: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.accentBg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.display,
      fontSize: 24,
      lineHeight: 30,
      marginBottom: spacing.sm,
    },
    body: {
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 21,
      marginBottom: spacing.xl,
    },
    noBody: {
      height: spacing.md,
    },
    actions: {
      gap: spacing.sm,
    },
    button: {
      paddingVertical: spacing.lg - 2,
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: "center",
    },
    primaryButton: {
      borderColor: colors.accentBorder,
      backgroundColor: colors.accent,
    },
    primaryButtonText: {
      color: colors.accentText,
      fontFamily: fonts.bodyBold,
      fontSize: 15,
    },
    destructiveButton: {
      borderColor: colors.danger,
      backgroundColor: colors.danger,
    },
    destructiveButtonText: {
      color: "#fff",
      fontFamily: fonts.bodyBold,
      fontSize: 15,
    },
    defaultButton: {
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    defaultButtonText: {
      color: colors.textPrimary,
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
    },
    cancelButton: {
      paddingTop: spacing.md,
      alignItems: "center",
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 14,
    },
  });
}
