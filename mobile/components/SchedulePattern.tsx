import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { isLiveWindow, lastSessionAt, nextSessionAt, todaysSessions } from "../lib/schedule";
import { fonts, radius, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function formatLocalTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function SchedulePattern() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const nowMs = now.getTime();
  const live = isLiveWindow(now);
  const lastSession = lastSessionAt(now);
  const nextTarget = nextSessionAt(now);
  const sessions = todaysSessions(now);

  return (
    <View style={styles.container}>
      <Text style={styles.boardLabel}>Today's schedule</Text>
      <View style={styles.board}>
        {sessions.map((session, index) => {
          const isLiveNow = live && session === lastSession;
          const isPast = session <= nowMs && !isLiveNow;
          return (
            <View key={session}>
              {index > 0 && <View style={styles.boardDivider} />}
              <View style={[styles.boardRow, isLiveNow && styles.boardRowLive]}>
                <Text style={[styles.boardTime, isLiveNow && styles.boardTimeLive]}>
                  {formatLocalTime(session)}
                </Text>
                <Text style={[styles.boardStatus, isLiveNow && styles.boardStatusLive]}>
                  {isLiveNow ? "● LIVE NOW" : isPast ? "Departed" : "On schedule"}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.countdown}>
        <Text style={styles.label}>{live ? "Session in progress" : "Next session in"}</Text>
        <Text style={styles.clock}>{live ? "— : — : —" : formatDuration(nextTarget - nowMs)}</Text>
        <Text style={styles.localTime}>
          {live ? "Bruno is howling right now" : `That's ${formatLocalTime(nextTarget)} your time`}
        </Text>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    boardLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginBottom: spacing.xs,
    },
    board: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.md,
      overflow: "hidden",
    },
    boardDivider: {
      height: 1,
      backgroundColor: colors.border,
    },
    boardRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderLeftWidth: 3,
      borderLeftColor: "transparent",
    },
    boardRowLive: {
      backgroundColor: colors.liveBg,
      borderLeftColor: colors.live,
    },
    boardTime: {
      color: colors.textPrimary,
      fontFamily: fonts.mono,
      fontSize: 17,
    },
    boardTimeLive: {
      fontFamily: fonts.monoBold,
      color: colors.live,
    },
    boardStatus: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 12,
    },
    boardStatusLive: {
      color: colors.live,
      fontFamily: fonts.bodyBold,
    },
    countdown: {
      alignItems: "center",
      paddingTop: spacing.lg,
      paddingBottom: spacing.xs,
    },
    label: {
      color: colors.textSecondary,
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginBottom: spacing.xs,
    },
    clock: {
      fontFamily: fonts.monoBold,
      fontSize: 40,
      color: colors.accent,
    },
    localTime: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 13,
      marginTop: spacing.xs,
    },
  });
}
