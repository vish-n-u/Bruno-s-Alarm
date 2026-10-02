import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AlarmClipVideo from "./AlarmClipVideo";
import Touchable from "./Touchable";
import { getRingStartedAt, snoozeRingingAlarm, stopRingingAlarm } from "../lib/notifications";
import { disableOnceAlarmIfFired } from "../lib/customAlarm";
import { success, tapMedium } from "../lib/haptics";
import { getCloudflareLiveStatus } from "../lib/liveStatus";
import { fonts, radius, spacing, useThemeColors, type ThemeColors } from "../lib/theme";
import { track } from "../lib/analytics";

const LIVE_POLL_MS = 15_000;

export default function AlarmRingingScreen({
  alarmId,
  onWatchLive,
}: {
  alarmId: string;
  /** Called after the alarm is stopped via "Bruno's live — watch", so the app opens the Live tab. */
  onWatchLive: () => void;
}) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [busy, setBusy] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  // The video always shows the alarm's own clip (so it matches the sound); if Bruno happens to be
  // live, a button offers the real stream instead of mixing live video with recorded sound.
  const [brunoLive, setBrunoLive] = useState(false);

  useEffect(() => {
    getRingStartedAt(alarmId)
      .then(setStartedAt)
      .catch(() => setStartedAt(Date.now()));
  }, [alarmId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      const status = await getCloudflareLiveStatus();
      if (cancelled) return;
      setBrunoLive(status.live);
      timer = setTimeout(check, LIVE_POLL_MS);
    };
    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Only bruno-live- alarms are triggered by the camera actually going live, so only they say
  // he's live. bruno-session- alarms fire on the clock at his usual time (he's sometimes late),
  // and bruno-custom- alarms are a time the user picked — neither claims a live howl.
  const isLive = alarmId.startsWith("bruno-live-");
  const isRealSession = isLive || alarmId.startsWith("bruno-session-");
  const title = isLive ? "Bruno is live!" : isRealSession ? "It's Bruno time" : "Your Bruno alarm";
  // Android alarm ids end in the scheduled timestamp (bruno-session-<ms> / bruno-custom-
  // <ms>) — pull it out to show the exact scheduled time in the same mono "departure
  // board" language used on Home, rather than just a generic title.
  const scheduledAt = Number(alarmId.slice(alarmId.lastIndexOf("-") + 1));
  const timeLabel = Number.isFinite(scheduledAt) && scheduledAt > 0
    ? new Date(scheduledAt).toLocaleString(undefined, { hour: "numeric", minute: "2-digit" })
    : null;

  // When this ringing screen appeared — for how long the alarm rang before it was dealt with.
  const shownAtRef = useRef(Date.now());
  useEffect(() => {
    shownAtRef.current = Date.now();
    track.alarmRang(alarmId);
  }, [alarmId]);

  async function handleStop() {
    if (busy) return;
    track.alarmStopped(alarmId, (Date.now() - shownAtRef.current) / 1000);
    // Fires the instant the tap lands, not after stopRingingAlarm() resolves — the whole point
    // is confirming to a half-asleep thumb that it actually hit the target, which needs to be
    // immediate to mean anything.
    success();
    setBusy(true);
    try {
      await stopRingingAlarm(alarmId);
      await disableOnceAlarmIfFired(alarmId);
    } finally {
      setBusy(false);
    }
  }

  async function handleWatchLive() {
    if (busy) return;
    track.alarmWatchLive(alarmId);
    success();
    setBusy(true);
    try {
      onWatchLive();
      await stopRingingAlarm(alarmId);
      await disableOnceAlarmIfFired(alarmId);
    } finally {
      setBusy(false);
    }
  }

  async function handleSnooze() {
    if (busy) return;
    track.alarmSnoozed(alarmId);
    tapMedium();
    setBusy(true);
    try {
      await snoozeRingingAlarm(alarmId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      {/* Video fills the entire screen — the ringing take-over IS the video, not a card
          floating inside a UI. Text/buttons sit on solid scrim bands over it, since video
          content isn't theme-aware and can't guarantee contrast against arbitrary footage. */}
      {startedAt !== null && <AlarmClipVideo startedAt={startedAt} />}

      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <View style={styles.topScrim}>
          <View style={styles.titleRow}>
            <Ionicons name={isRealSession ? "paw" : "alarm"} size={22} color="#fff" />
            <Text style={styles.title}>{title}</Text>
          </View>
          {timeLabel && <Text style={styles.timeLabel}>{timeLabel}</Text>}
        </View>

        <View style={styles.bottomScrim}>
          {brunoLive && (
            <Touchable style={[styles.liveButton, busy && styles.buttonBusy]} onPress={handleWatchLive} disabled={busy}>
              <View style={[styles.liveDot, { backgroundColor: colors.live }]} />
              <Text style={styles.liveButtonText}>Bruno's live — watch</Text>
            </Touchable>
          )}

          <Touchable style={[styles.stopButton, busy && styles.buttonBusy]} onPress={handleStop} disabled={busy}>
            {busy
              ? <ActivityIndicator color={colors.accentText} />
              : <Text style={styles.stopButtonText}>Stop</Text>}
          </Touchable>

          <Touchable style={[styles.snoozeButton, busy && styles.buttonBusy]} onPress={handleSnooze} disabled={busy}>
            <Ionicons name="moon-outline" size={16} color="#fff" />
            <Text style={styles.snoozeButtonText}>Snooze 10 min</Text>
          </Touchable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: "#000",
    },
    overlay: {
      flex: 1,
      justifyContent: "space-between",
    },
    topScrim: {
      backgroundColor: "rgba(0,0,0,0.45)",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      gap: spacing.xs,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    title: {
      color: "#fff",
      fontFamily: fonts.display,
      fontSize: 22,
      textAlign: "center",
    },
    timeLabel: {
      color: colors.live,
      fontFamily: fonts.monoBold,
      fontSize: 15,
      textAlign: "center",
    },
    bottomScrim: {
      backgroundColor: "rgba(0,0,0,0.45)",
      padding: spacing.xl,
      gap: spacing.lg,
    },
    stopButton: {
      width: "100%",
      paddingVertical: 16,
      borderRadius: radius.md + 2,
      backgroundColor: colors.accent,
      alignItems: "center",
    },
    stopButtonText: {
      color: colors.accentText,
      fontFamily: fonts.bodyBold,
      fontSize: 18,
    },
    liveButton: {
      width: "100%",
      flexDirection: "row",
      paddingVertical: spacing.lg,
      borderRadius: radius.md + 2,
      backgroundColor: "rgba(255,255,255,0.92)",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    liveDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
    },
    liveButtonText: {
      color: "#111",
      fontFamily: fonts.bodyBold,
      fontSize: 16,
    },
    snoozeButton: {
      width: "100%",
      flexDirection: "row",
      paddingVertical: spacing.lg,
      borderRadius: radius.md + 2,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.4)",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    snoozeButtonText: {
      color: "#fff",
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
    },
    buttonBusy: {
      opacity: 0.5,
    },
  });
}
