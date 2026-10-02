import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts, radius, useThemeColors } from "../lib/theme";

// The "DEV" pill shown next to the developer's name in chat (live chat and Bruno's Pack). Who
// gets it is the developerIds list in Firestore config/app (lib/appConfig.ts). Accent fill so it
// reads on both the dark video overlay and the themed Pack screen.
export default function DevBadge() {
  const colors = useThemeColors();
  return (
    <View style={[styles.pill, { backgroundColor: colors.accent }]} accessibilityLabel="Developer">
      <Ionicons name="paw" size={10} color={colors.accentText} />
      <Text style={[styles.text, { color: colors.accentText }]}>DEV</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  text: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
});
