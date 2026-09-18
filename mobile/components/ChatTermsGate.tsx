import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fonts, radius, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

const RULES = [
  "Be kind — no harassment, hate, or threats toward Bruno's Pack or anyone else.",
  "No spam or flooding the chat.",
  "Messages are public to everyone watching, and moderated automatically.",
];

type Props = {
  visible: boolean;
  onAccept: () => void;
  onCancel: () => void;
};

// A true one-time gate: shown only right before a device's very first-ever chat send (see
// hasAcceptedChatTerms()/acceptChatTerms() in lib/chat.ts), never before viewing chat and
// never again once accepted. Same in-place popup pattern as EditCustomAlarmModal.tsx, not a
// navigator route.
export default function ChatTermsGate({ visible, onAccept, onCancel }: Props) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTapArea} onPress={onCancel} />
        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.accent} />
            <Text style={styles.title}>Before you chat</Text>
          </View>
          <View style={styles.rules}>
            {RULES.map((rule) => (
              <View key={rule} style={styles.ruleRow}>
                <View style={styles.ruleDot} />
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>
          <Pressable style={styles.acceptButton} onPress={onAccept}>
            <Text style={styles.acceptButtonText}>I agree, let me chat</Text>
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Not now</Text>
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
    rules: {
      gap: spacing.md,
      marginBottom: spacing.xl,
    },
    ruleRow: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "flex-start",
    },
    ruleDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.textSecondary,
      marginTop: 7,
    },
    ruleText: {
      flex: 1,
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 14,
      lineHeight: 20,
    },
    acceptButton: {
      paddingVertical: spacing.lg - 2,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accent,
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    acceptButtonText: {
      color: colors.accentText,
      fontFamily: fonts.bodyBold,
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
