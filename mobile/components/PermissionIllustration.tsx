import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts, radius, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

// The looping picture at the top of a permission dialog: a little settings switch flips on, then
// you see what that gets you (Bruno filling a locked phone, the alarm ringing, …). Shows the
// "flip a switch" step and the payoff without any words. Pure Animated, native driver.

export type PermissionIllustrationKind = "notifications" | "exactAlarms" | "lockScreen" | "background";

const LOOP_MS = 3600;
const PHONE_SCREEN = "#15232c"; // a phone's own lock screen, the same in every app theme

const SWITCH_LABELS: Record<PermissionIllustrationKind, string> = {
  notifications: "Notifications",
  exactAlarms: "Alarms",
  lockScreen: "Full screen",
  background: "Background",
};

export default function PermissionIllustration({ kind }: { kind: PermissionIllustrationKind }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const t = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      t.setValue(0.6); // switch on, payoff showing
      return;
    }
    t.setValue(0);
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: LOOP_MS, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, t]);

  // 0–0.2 off · 0.2–0.3 switch flips · 0.4–0.85 payoff · 0.9–1 back to the start
  const switchOn = t.interpolate({ inputRange: [0, 0.2, 0.3, 0.9, 1], outputRange: [0, 0, 1, 1, 0] });
  const payoff = t.interpolate({ inputRange: [0, 0.35, 0.45, 0.85, 0.93, 1], outputRange: [0, 0, 1, 1, 0, 0] });
  const shake = t.interpolate({
    inputRange: [0, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 1],
    outputRange: ["0deg", "0deg", "-14deg", "14deg", "-14deg", "14deg", "-8deg", "0deg", "0deg"],
  });
  const knobX = switchOn.interpolate({ inputRange: [0, 1], outputRange: [0, 16] });
  const pop = payoff.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <View style={styles.panel}>
      <View style={styles.visual}>
        {kind === "lockScreen" || kind === "background" ? (
          <View style={styles.phone}>
            {/* Before: a locked phone, or one asleep. */}
            <View style={styles.phoneIdle}>
              {kind === "lockScreen" ? (
                <>
                  <Ionicons name="lock-closed" size={10} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.phoneTime}>6:00</Text>
                </>
              ) : (
                <Ionicons name="moon" size={22} color="rgba(255,255,255,0.55)" />
              )}
            </View>
            {/* After: Bruno takes over the screen. */}
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: payoff, transform: [{ scale: pop }] }]}>
              <Image source={require("../assets/bruno-photo.jpg")} style={styles.phonePhoto} resizeMode="cover" />
              {kind === "lockScreen" ? (
                <View style={styles.stopPill}>
                  <Text style={styles.stopText}>STOP</Text>
                </View>
              ) : (
                <View style={styles.livePill}>
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </Animated.View>
          </View>
        ) : (
          <View style={styles.iconStage}>
            <Animated.View style={{ transform: [{ rotate: shake }] }}>
              <Ionicons name={kind === "notifications" ? "notifications" : "alarm"} size={58} color={colors.accent} />
            </Animated.View>
            {kind === "exactAlarms" && <Text style={styles.clock}>06:00</Text>}
          </View>
        )}
      </View>

      <View style={styles.switchCard}>
        <Text style={styles.switchLabel}>{SWITCH_LABELS[kind]}</Text>
        <View style={styles.track}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.trackOn, { opacity: switchOn }]} />
          <Animated.View style={[styles.knob, { transform: [{ translateX: knobX }] }]} />
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    panel: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.lg,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.lg,
    },
    visual: {
      width: 84,
      height: 140,
      alignItems: "center",
      justifyContent: "center",
    },
    phone: {
      width: 78,
      height: 140,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: PHONE_SCREEN,
      overflow: "hidden",
    },
    phoneIdle: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    phoneTime: {
      color: "#fff",
      fontFamily: fonts.monoBold,
      fontSize: 18,
    },
    phonePhoto: {
      width: "100%",
      height: "100%",
    },
    stopPill: {
      position: "absolute",
      bottom: 10,
      alignSelf: "center",
      backgroundColor: colors.accent,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    stopText: {
      color: colors.accentText,
      fontFamily: fonts.bodyBold,
      fontSize: 9,
      letterSpacing: 1,
    },
    livePill: {
      position: "absolute",
      top: 8,
      left: 8,
      backgroundColor: colors.live,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    liveText: {
      color: "#fff",
      fontFamily: fonts.bodyBold,
      fontSize: 8,
      letterSpacing: 1,
    },
    iconStage: {
      alignItems: "center",
      gap: spacing.xs,
    },
    clock: {
      color: colors.textPrimary,
      fontFamily: fonts.monoBold,
      fontSize: 16,
    },
    switchCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
      alignItems: "flex-start",
    },
    switchLabel: {
      color: colors.textPrimary,
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
    },
    track: {
      width: 38,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.border,
      padding: 2,
      overflow: "hidden",
    },
    trackOn: {
      backgroundColor: colors.accent,
      borderRadius: 11,
    },
    knob: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: "#fff",
    },
  });
}
