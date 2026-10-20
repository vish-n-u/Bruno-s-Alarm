import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView, type VideoSource } from "expo-video";
import Touchable from "./Touchable";
import { track } from "../lib/analytics";
import { tapLight } from "../lib/haptics";
import { getMyHowlRating, rateHowl, subscribeHowlRating, type HowlRatingSummary } from "../lib/howlRatings";
import { fonts, radius, spacing } from "../lib/theme";

const PAW_COLOR = "#f5b942";

/**
 * The Live tab's "Watch his last howl": one clip of Bruno full-screen with sound, over the
 * NO SIGNAL card, labelled so it can't be mistaken for the live feed (grey badge, recording
 * date). Opens the moment the button is tapped: "Finding his last howl…" while the Live tab
 * asks the server (source still null), then "Loading the video…" until the first frame shows.
 * When the clip is a known session (videoUid), viewers can rate it 1–5 paws and see the
 * average. At the end it stays open (rate / watch again / X) rather than closing itself.
 */
export default function LastHowlPlayer({
  source,
  videoUid,
  label,
  paused,
  onClose,
}: {
  /** null while the Live tab is still finding which howl to play. */
  source: VideoSource | null;
  /** Cloudflare uid of the session (rating needs it); null for the saved/built-in fallback. */
  videoUid: string | null;
  /** e.g. "Sat 18:00" — when the clip was recorded, or null for the built-in clip. */
  label: string | null;
  /** The Live tab lost focus: stop the sound. */
  paused: boolean;
  onClose: () => void;
}) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      {source ? (
        <HowlVideo source={source} paused={paused} onError={onClose} />
      ) : (
        <Loader text="Finding his last howl…" />
      )}
      <SafeAreaView style={styles.top} edges={["top"]}>
        <View style={styles.badge}>
          <View style={styles.dot} />
          <Text style={styles.badgeText}>{label ? `LAST HOWL · ${label}` : source ? "HIS HOWL" : "LAST HOWL"}</Text>
        </View>
        <Touchable
          style={styles.close}
          onPress={() => {
            tapLight();
            onClose();
          }}
          hitSlop={12}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </Touchable>
      </SafeAreaView>
      {videoUid && <RatingBar videoUid={videoUid} />}
    </View>
  );
}

function Loader({ text }: { text: string }) {
  return (
    <View style={styles.loader} pointerEvents="none">
      <ActivityIndicator color="#fff" size="large" />
      <Text style={styles.loaderText}>{text}</Text>
    </View>
  );
}

function HowlVideo({ source, paused, onError }: { source: VideoSource; paused: boolean; onError: () => void }) {
  const player = useVideoPlayer(source, (p) => {
    p.muted = false;
    p.play();
  });
  const [shown, setShown] = useState(false);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    if (paused) player.pause();
  }, [paused, player]);

  const { status } = useEvent(player, "statusChange", { status: player.status });
  // A clip that won't play just closes.
  useEffect(() => {
    if (status === "error") onError();
  }, [status, onError]);
  useEffect(() => {
    const sub = player.addListener("playToEnd", () => setEnded(true));
    return () => sub.remove();
  }, [player]);

  return (
    <>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        onFirstFrameRender={() => setShown(true)}
      />
      {!shown && <Loader text="Loading the video…" />}
      {ended && (
        <View style={styles.endWrap} pointerEvents="box-none">
          <Touchable
            style={styles.again}
            onPress={() => {
              tapLight();
              setEnded(false);
              player.currentTime = 0;
              player.play();
            }}
          >
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.againText}>Watch again</Text>
          </Touchable>
        </View>
      )}
    </>
  );
}

function RatingBar({ videoUid }: { videoUid: string }) {
  const [summary, setSummary] = useState<HowlRatingSummary>({ count: 0, average: null });
  const [mine, setMine] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => subscribeHowlRating(videoUid, setSummary), [videoUid]);
  useEffect(() => {
    let alive = true;
    getMyHowlRating(videoUid).then((paws) => alive && setMine(paws));
    return () => {
      alive = false;
    };
  }, [videoUid]);

  async function rate(paws: number) {
    tapLight();
    const before = mine;
    setMine(paws);
    setFailed(false);
    track.howlRated(paws);
    if (!(await rateHowl(videoUid, paws))) {
      setMine(before);
      setFailed(true);
    }
  }

  const summaryText = failed
    ? "Couldn't save that. Try again."
    : summary.average === null
      ? "Be the first to rate it"
      : `${summary.average.toFixed(1)} · ${summary.count} ${summary.count === 1 ? "rating" : "ratings"}`;

  return (
    <SafeAreaView style={styles.bottom} edges={["bottom"]} pointerEvents="box-none">
      <View style={styles.rateCard}>
        <Text style={styles.rateTitle}>{mine ? "You rated this howl" : "Rate this howl"}</Text>
        <View style={styles.paws}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Touchable key={n} onPress={() => rate(n)} hitSlop={6} accessibilityLabel={`${n} paws`}>
              <Ionicons
                name={mine !== null && n <= mine ? "paw" : "paw-outline"}
                size={30}
                color={mine !== null && n <= mine ? PAW_COLOR : "#fff"}
              />
            </Touchable>
          ))}
        </View>
        <Text style={[styles.rateSummary, failed && styles.rateFailed]}>{summaryText}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: "#000",
  },
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: spacing.lg,
  },
  loader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    backgroundColor: "#000",
  },
  loaderText: {
    color: "#d8d8d8",
    fontFamily: fonts.body,
    fontSize: 15,
  },
  // Same pill as the Live tab's LIVE/REPLAY badge, with the grey (not live) dot.
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#9a9a9a",
  },
  badgeText: {
    color: "#fff",
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  endWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  again: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  againText: {
    color: "#fff",
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  rateCard: {
    margin: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    gap: spacing.sm,
  },
  rateTitle: {
    color: "#fff",
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  paws: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  rateSummary: {
    color: "#d8d8d8",
    fontFamily: fonts.body,
    fontSize: 13,
  },
  rateFailed: {
    color: "#f2a65a",
  },
});
