import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fonts, radius, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

const REASONS = ["Spam", "Harassment", "Inappropriate content", "Other"];

type Props = {
  visible: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

// A single tap on a reason both picks it and submits — this is meant to be a quick,
// low-friction report, not a form. Writes to Firestore's `reports` collection (see
// lib/chat.ts's reportChatMessage) rather than acting on the message itself; nothing here
// removes or hides the message for other viewers.
export default function ReportMessageModal({ visible, onConfirm, onCancel }: Props) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTapArea} onPress={onCancel} />
        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Report this message</Text>
          <Text style={styles.subtitle}>Why are you reporting it?</Text>
          <View style={styles.reasons}>
            {REASONS.map((reason, index) => (
              <Pressable
                key={reason}
                style={[styles.reasonRow, index === REASONS.length - 1 && styles.reasonRowLast]}
                onPress={() => onConfirm(reason)}
              >
                <Text style={styles.reasonText}>{reason}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
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
    },
    grabber: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: spacing.lg,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.displaySemiBold,
      fontSize: 18,
      marginBottom: spacing.xs,
    },
    subtitle: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 13,
      marginBottom: spacing.lg,
    },
    reasons: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      marginBottom: spacing.lg,
    },
    reasonRow: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    reasonRowLast: {
      borderBottomWidth: 0,
    },
    reasonText: {
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: 15,
    },
    cancelButton: {
      paddingVertical: spacing.sm + 2,
      alignItems: "center",
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 14,
    },
  });
}
