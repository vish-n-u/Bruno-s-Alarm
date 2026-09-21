import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import LiveAlarmSetupSheet from "./LiveAlarmSetupSheet";
import { disableLiveAlarm, enableLiveAlarm, isLiveAlarmEnabled } from "../lib/liveAlerts";
import { fonts, radius, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

// Separate from NotifyToggle ("Wake me up with Bruno" = the reliable scheduled alarms). Turning
// this ON never happens directly — it opens the setup sheet, which states the drawbacks and asks
// for the permissions first. Turning it OFF is immediate.
export default function LiveAlarmToggle() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [enabled, setEnabled] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  useEffect(() => {
    isLiveAlarmEnabled().then(setEnabled);
  }, []);

  async function handleToggle(value: boolean) {
    if (value) {
      setSheetVisible(true);
      return;
    }
    setEnabled(false);
    await disableLiveAlarm();
  }

  async function handleConfirm() {
    await enableLiveAlarm();
    setEnabled(true);
    setSheetVisible(false);
  }

  return (
    <>
      <View style={styles.row}>
        <View style={styles.iconChip}>
          <Ionicons name="flash" size={18} color={colors.accent} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Ring when Bruno goes live</Text>
          <Text style={styles.subtitle}>
            {enabled ? "On. Rings whenever he goes live, best effort" : "Extra, best effort. Read the notes first"}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.surfaceAlt, true: colors.accent }}
          thumbColor={colors.surface}
        />
      </View>
      <LiveAlarmSetupSheet visible={sheetVisible} onConfirm={handleConfirm} onCancel={() => setSheetVisible(false)} />
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    iconChip: {
      width: 38,
      height: 38,
      borderRadius: radius.md,
      backgroundColor: colors.accentBg,
      alignItems: "center",
      justifyContent: "center",
    },
    textWrap: {
      flex: 1,
      gap: 2,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
    },
    subtitle: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 12,
    },
  });
}
