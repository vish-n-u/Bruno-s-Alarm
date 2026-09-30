import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getDisplayName, setDisplayName } from "../lib/profile";
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
// navigator route. It's also where the chat name is asked for — the moment it's actually
// useful, rather than during onboarding. Skipping it leaves the server's generated
// "Viewer NNNN" name.
export default function ChatTermsGate({ visible, onAccept, onCancel }: Props) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [name, setName] = useState("");

  // Prefill with a name saved earlier (older versions asked for it during onboarding).
  useEffect(() => {
    if (!visible) return;
    getDisplayName()
      .then((saved) => setName(saved ?? ""))
      .catch(() => {});
  }, [visible]);

  async function handleAccept() {
    const trimmed = name.trim();
    if (trimmed) await setDisplayName(trimmed).catch(() => {});
    onAccept();
  }

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
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name in chat (optional)"
            placeholderTextColor={colors.textSecondary}
            style={styles.nameInput}
            maxLength={24}
            autoCapitalize="words"
            returnKeyType="done"
          />
          <View style={styles.rules}>
            {RULES.map((rule) => (
              <View key={rule} style={styles.ruleRow}>
                <View style={styles.ruleDot} />
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>
          <Pressable style={styles.acceptButton} onPress={handleAccept}>
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
    nameInput: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: 15,
      marginBottom: spacing.lg,
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
