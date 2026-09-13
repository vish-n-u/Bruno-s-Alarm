import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import SchedulePattern from "./SchedulePattern";
import VideoPanel from "./VideoPanel";
import NotifyToggle from "./NotifyToggle";
import type { RootStackParamList } from "../App";
import { fonts, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Image source={require("../assets/icon.png")} style={styles.logo} />
          <View style={styles.headerTitleWrap}>
            <Text style={styles.title}>Bruno's Alarm</Text>
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
          <VideoPanel />
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

        <Text style={styles.footer}>
          Sessions air twice daily at 6:00 and 18:00 India Standard Time.
        </Text>
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
    content: {
      padding: spacing.xl,
      paddingBottom: spacing.xxl + spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.xxl - spacing.xs,
      gap: spacing.md,
    },
    logo: {
      width: 40,
      height: 40,
      borderRadius: 10,
    },
    headerTitleWrap: {
      flex: 1,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.display,
      fontSize: 22,
      marginBottom: 2,
    },
    subtitle: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 13,
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
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 12,
      textAlign: "center",
      marginTop: spacing.xs,
    },
  });
}
