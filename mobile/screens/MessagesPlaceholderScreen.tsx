import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fonts, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

// A real global chat needs a backend/identity system this app doesn't have yet — deferred
// deliberately. This placeholder just holds the tab's spot in the nav.
export default function MessagesPlaceholderScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Ionicons name="chatbubbles-outline" size={56} color={colors.accent} />
        <Text style={styles.title}>Bruno's Pack</Text>
        <Text style={styles.body}>Coming soon: a place to chat with everyone who's in this with Bruno.</Text>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xxl,
      gap: spacing.md,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.display,
      fontSize: 22,
      textTransform: "uppercase",
    },
    body: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 15,
      textAlign: "center",
      lineHeight: 22,
    },
  });
}
