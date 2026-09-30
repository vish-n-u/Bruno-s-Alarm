import { Fragment, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Touchable from "./Touchable";
import { tapLight } from "../lib/haptics";
import { registerPermissionPromptHost, type PendingPrompt } from "../lib/permissionPrompt";
import { fonts, radius, shadow, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

// Renders lib/permissionPrompt.ts's dialogs. Mounted once in App.tsx; being a Modal, it shows
// above everything, including other open sheets (e.g. the live alarm setup sheet).
export default function PermissionPromptHost() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [prompt, setPrompt] = useState<PendingPrompt | null>(null);

  useEffect(() => registerPermissionPromptHost(setPrompt), []);

  function close(confirmed: boolean) {
    tapLight();
    prompt?.resolve(confirmed);
    setPrompt(null);
  }

  return (
    <Modal
      visible={prompt !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => close(false)}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close(false)} />
        {prompt && (
          <View style={styles.card}>
            <View style={styles.topRow}>
              <View style={styles.iconChip}>
                <Ionicons name={prompt.icon} size={22} color={colors.accent} />
              </View>
              {prompt.progress && <Text style={styles.progress}>{prompt.progress}</Text>}
            </View>

            <Text style={styles.title}>{prompt.title}</Text>
            <Text style={styles.body}>{prompt.body}</Text>

            {prompt.steps && prompt.steps.length > 0 && (
              <View style={styles.stepsBox}>
                <Text style={styles.stepsLabel}>In settings, tap</Text>
                <View style={styles.stepsRow}>
                  {prompt.steps.map((step, i) => (
                    <Fragment key={step}>
                      {i > 0 && <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />}
                      <Text style={styles.step}>{step}</Text>
                    </Fragment>
                  ))}
                </View>
                {prompt.stepsNote && <Text style={styles.stepsNote}>{prompt.stepsNote}</Text>}
              </View>
            )}

            <Touchable style={styles.primaryButton} onPress={() => close(true)}>
              <Text style={styles.primaryButtonText}>{prompt.confirmLabel}</Text>
            </Touchable>
            <Touchable style={styles.secondaryButton} onPress={() => close(false)}>
              <Text style={styles.secondaryButtonText}>{prompt.cancelLabel}</Text>
            </Touchable>
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
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.lg,
    },
    iconChip: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.accentBg,
      alignItems: "center",
      justifyContent: "center",
    },
    progress: {
      color: colors.textSecondary,
      fontFamily: fonts.monoBold,
      fontSize: 13,
      letterSpacing: 1,
      textTransform: "uppercase",
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
      marginBottom: spacing.lg,
    },
    stepsBox: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.xs,
      marginBottom: spacing.xl,
    },
    stepsLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    stepsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: spacing.xs,
    },
    step: {
      color: colors.textPrimary,
      fontFamily: fonts.monoBold,
      fontSize: 14,
    },
    stepsNote: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 17,
      marginTop: spacing.xs,
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
    secondaryButton: {
      paddingTop: spacing.md,
      alignItems: "center",
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 14,
    },
  });
}
