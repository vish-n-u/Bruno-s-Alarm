import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import SchedulePattern from "./SchedulePattern";
import NotifyToggle from "./NotifyToggle";
import type { RootStackParamList } from "../App";
import { fonts, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* A real sky behind the content — real vector glyphs (already in the icon set the
          app uses everywhere else) instead of hand-built shapes, so they actually look
          designed rather than pasted-on clip art. Purely decorative: renders behind the
          ScrollView (transparent background) and never intercepts touches. */}
      <View style={styles.sun} pointerEvents="none">
        <Ionicons name="sunny" size={120} color="#ffc233" />
      </View>
      <View style={styles.cloud1} pointerEvents="none">
        <Ionicons name="cloud" size={92} color="#ffffff" />
      </View>
      <View style={styles.cloud2} pointerEvents="none">
        <Ionicons name="cloud" size={68} color="#ffffff" />
      </View>
      <View style={styles.cloud3} pointerEvents="none">
        <Ionicons name="cloud" size={56} color="#ffffff" />
      </View>
      <View style={styles.leaf1} pointerEvents="none">
        <Ionicons name="leaf" size={30} color="#4f8f4a" />
      </View>
      <View style={[styles.leaf2, { transform: [{ rotate: "140deg" }] }]} pointerEvents="none">
        <Ionicons name="leaf" size={24} color="#4f8f4a" />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Bruno's Alarm</Text>
                <Text style={styles.titleEmoji}>🐕🌙</Text>
              </View>
              <Text style={styles.subtitle}>A real dog. Two alarms a day. Never once late.</Text>
            </View>
            <Pressable
              style={styles.settingsButton}
              onPress={() => navigation.navigate("Settings")}
              hitSlop={12}
            >
              <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.section}>
            <SchedulePattern />
          </View>

          <View style={styles.section}>
            <NotifyToggle />
          </View>

          <Pressable style={styles.customAlarmRow} onPress={() => navigation.navigate("CustomAlarm")}>
            <View style={styles.customAlarmLeft}>
              <Ionicons name="alarm-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.customAlarmText}>Set your own alarm time</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* A quiet closing mark, not more content — gives the page a deliberate bottom
            edge instead of trailing off into empty space below the last real control. */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <Ionicons name="paw" size={14} color={colors.textSecondary} />
          <Text style={styles.footerText}>No filters. No edits. Just Bruno.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    // Pushed up and off the right edge so the visible sliver clears the settings gear
    // below it instead of colliding with it.
    sun: {
      position: "absolute",
      top: -34,
      right: -34,
    },
    // All three clouds and both leaves sit well below the custom-alarm row so nothing
    // pokes out from behind a real button or control.
    cloud1: {
      position: "absolute",
      top: "60%",
      left: "8%",
    },
    cloud2: {
      position: "absolute",
      top: "69%",
      right: "10%",
    },
    cloud3: {
      position: "absolute",
      top: "77%",
      left: "32%",
    },
    leaf1: {
      position: "absolute",
      top: "64%",
      right: "26%",
    },
    leaf2: {
      position: "absolute",
      top: "81%",
      left: "10%",
    },
    content: {
      flexGrow: 1,
      justifyContent: "space-between",
      padding: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.xxl - spacing.xs,
      gap: spacing.md,
    },
    headerTitleWrap: {
      flex: 1,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.display,
      fontSize: 26,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 3,
    },
    titleEmoji: {
      fontSize: 22,
      marginBottom: 3,
    },
    subtitle: {
      color: colors.textSecondary,
      fontFamily: fonts.hand,
      fontSize: 17,
    },
    settingsButton: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    section: {
      marginBottom: spacing.lg,
    },
    customAlarmRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
    },
    customAlarmLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    customAlarmText: {
      color: colors.textPrimary,
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
    },
    footer: {
      alignItems: "center",
      gap: spacing.sm,
      paddingTop: spacing.xl,
    },
    footerDivider: {
      width: 32,
      height: 1,
      backgroundColor: colors.border,
      marginBottom: spacing.xs,
    },
    footerText: {
      color: colors.textSecondary,
      fontFamily: fonts.hand,
      fontSize: 16,
    },
  });
}
