import { useEffect, useRef, useState } from "react";
import { useEvent } from "expo";
import { useVideoPlayer } from "expo-video";
import {
  Animated,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LockScreenPreview from "./LockScreenPreview";
import Sky from "./Sky";
import Touchable from "./Touchable";
import { track } from "../lib/analytics";
import { tapLight } from "../lib/haptics";
import { raisePreviewVolume, restorePreviewVolume } from "../lib/previewVolume";
import { sessionTimesLabel } from "../lib/schedule";
import { fonts, radius, spacing, useNow, useThemeColors, type ThemeColors } from "../lib/theme";

// One simple story, main thing first: it's an alarm clock with a real dog → pick any time →
// and you can catch him live too. (An earlier version led with the live stream and never said
// it was an alarm, which confused people.) The chat name isn't asked for here — it's asked the
// first time someone actually sends a chat message (components/ChatTermsGate.tsx). Permissions
// are asked later too, when someone actually sets an alarm.
//
// Laid out like a scrapbook rather than a template: real footage of Bruno on every slide
// (photo, his ringing alarm, a frame from a real stream), each a little tilted with a
// handwritten note, text left-aligned, and Home's live sky behind it all.

const SLIDES = [
  {
    title: "An alarm clock with a real dog",
    body: "Wake up to Bruno howling. He's a real dog, and his howl is recorded fresh every day.",
    next: "Hear him",
  },
  {
    title: "Pick any time",
    body: "Your alarm plays his newest howl, and it rings even on silent.",
    next: "See him live",
  },
  {
    title: "Catch him live, too",
    // Filled in at render: sessionTimesLabel() turns his 6AM/6PM India times into the
    // viewer's own clock, so this never claims "6AM" for someone who isn't in India.
    body: "",
    next: "Let's go",
  },
];

export default function Onboarding({ onDone }: { onDone: (openNewAlarm: boolean) => void }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { width, height: windowHeight } = useWindowDimensions();
  // Rendered full-screen outside any SafeAreaView/navigator, so the status bar and the system
  // nav bar have to be padded for by hand — otherwise Skip sits under the status bar (and its
  // taps get swallowed) and the footer buttons touch the nav bar.
  const insets = useSafeAreaInsets();
  const now = useNow(15000);
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  // Drives the page dots' width/colour continuously as you swipe.
  const scrollX = useRef(new Animated.Value(0)).current;
  const isLast = index === SLIDES.length - 1;
  const liveBody = `Twice a day, his morning and evening, he howls at a church bell. That's around ${sessionTimesLabel()} for you. Watch live and chat.`;

  // Bruno's ringing alarm on slide 2: the bundled howl video (the clip alarms fall back to)
  // with its own sound, so picture and sound match. A sample on the media stream, not an
  // alarm; while it plays, lib/previewVolume.ts raises a low media volume and puts it back
  // afterwards. The hook releases the player when onboarding closes.
  const howl = useVideoPlayer(require("../assets/videos/Bruno Howl Alarm.mp4"), (p) => {
    p.muted = false;
  });
  const { isPlaying: howlPlaying } = useEvent(howl, "playingChange", { isPlaying: howl.playing });

  function toggleHowl() {
    tapLight();
    if (howlPlaying) {
      howl.pause();
    } else {
      howl.currentTime = 0;
      track.howlPreview("onboarding");
      raisePreviewVolume();
      howl.play();
    }
  }

  // Covers every way it stops: tapping it again, the clip ending, or leaving the slide.
  useEffect(() => {
    if (!howlPlaying) restorePreviewVolume();
  }, [howlPlaying]);
  useEffect(() => {
    if (index !== 1) howl.pause();
  }, [index, howl]);
  // Which slides people reach, for the onboarding drop-off funnel.
  useEffect(() => {
    track.onboardingSlide(index + 1);
  }, [index]);
  useEffect(() => () => void restorePreviewVolume(), []);

  // Sized so each slide's text still fits under its picture on short phones.
  const visualHeight = Math.min(340, Math.round(windowHeight * 0.38));

  function goTo(next: number) {
    tapLight();
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  }

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  function finish(openNewAlarm: boolean) {
    tapLight();
    onDone(openNewAlarm);
  }

  function renderVisual(i: number) {
    if (i === 0) {
      return (
        <View style={styles.visualRow}>
          <Image
            source={require("../assets/bruno-cutout.png")}
            style={[styles.photo, { width: visualHeight * 0.8, height: visualHeight * 0.8 }]}
            resizeMode="contain"
          />
          <Text style={[styles.note, styles.notePhoto]}>this is Bruno</Text>
        </View>
      );
    }
    if (i === 1) {
      return (
        <View style={styles.visualRow}>
          <Text style={[styles.note, styles.notePhone]}>{howlPlaying ? "tap to stop" : "tap to\nhear him"}</Text>
          <View style={styles.phoneTilt}>
            <LockScreenPreview player={howl} playing={howlPlaying} height={visualHeight} onPress={toggleHowl} />
          </View>
        </View>
      );
    }
    const cardWidth = Math.round(visualHeight * 0.68);
    return (
      <View style={styles.visualRow}>
        <View style={[styles.liveCard, { width: cardWidth }]}>
          <Image source={require("../assets/bruno-live-frame.jpg")} style={styles.liveImage} />
          <View style={[styles.liveBadge, { backgroundColor: colors.live }]}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </View>
        {/* A couple of chat messages spilling off the frame, the way the Live tab's chat sits
            over the video. Illustration only. */}
        <View style={styles.bubbles}>
          <View style={[styles.bubble, styles.bubbleOne]}>
            <Text style={styles.bubbleName}>Meera</Text>
            <Text style={styles.bubbleText}>here he goes!!</Text>
          </View>
          <View style={[styles.bubble, styles.bubbleTwo]}>
            <Text style={styles.bubbleName}>Viewer 4821</Text>
            <Text style={styles.bubbleText}>right on time 🔔</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Home's sky (sun/moon on the real clock, drifting clouds) so the first screen already
          looks like the app. No weather here. */}
      <Sky now={now} weatherCondition={null} />

      <Touchable style={[styles.skip, { top: insets.top + spacing.sm }]} onPress={() => finish(false)} hitSlop={12}>
        <Text style={styles.skipText}>Skip</Text>
      </Touchable>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.scroll}
      >
        {SLIDES.map((slide, i) => (
          <View key={slide.title} style={[styles.slide, { width, paddingTop: insets.top + spacing.xxl * 2 }]}>
            <View style={styles.visual}>{renderVisual(i)}</View>
            <View style={styles.text}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.body}>{i === 2 ? liveBody : slide.body}</Text>
            </View>
          </View>
        ))}
      </Animated.ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({ inputRange, outputRange: [7, 20, 7], extrapolate: "clamp" });
            // Clamped like dotWidth — unclamped, a dot two or more pages away extrapolated
            // its colour past the palette entirely.
            const dotColor = scrollX.interpolate({
              inputRange,
              outputRange: [colors.border, colors.accent, colors.border],
              extrapolate: "clamp",
            });
            return (
              <Animated.View key={slide.title} style={[styles.dot, { width: dotWidth, backgroundColor: dotColor }]} />
            );
          })}
        </View>
        <Touchable style={styles.primaryButton} onPress={() => (isLast ? finish(false) : goTo(index + 1))}>
          <Text style={styles.primaryButtonText}>{SLIDES[index].next}</Text>
        </Touchable>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    skip: {
      position: "absolute",
      right: spacing.xl,
      zIndex: 1,
      padding: spacing.sm,
    },
    skipText: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 14,
    },
    scroll: {
      flex: 1,
    },
    slide: {
      paddingHorizontal: spacing.xxl,
    },
    visual: {
      flex: 1,
      justifyContent: "center",
    },
    visualRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    // Handwritten notes, in the same Caveat as Home's tagline, each at its own slant.
    note: {
      color: colors.textPrimary,
      fontFamily: fonts.hand,
      fontSize: 24,
      lineHeight: 26,
    },
    photo: {
      transform: [{ rotate: "-4deg" }],
    },
    notePhoto: {
      position: "absolute",
      bottom: -spacing.sm,
      left: 0,
      transform: [{ rotate: "-8deg" }],
    },
    notePhone: {
      marginRight: spacing.lg,
      textAlign: "right",
      transform: [{ rotate: "-6deg" }],
    },
    phoneTilt: {
      transform: [{ rotate: "3deg" }],
    },
    // A print of a stream frame: white border, slight tilt.
    liveCard: {
      aspectRatio: 4 / 5,
      padding: 6,
      backgroundColor: "#fff",
      borderRadius: radius.sm,
      transform: [{ rotate: "-3deg" }],
    },
    liveImage: {
      flex: 1,
      width: "100%",
      borderRadius: 3,
    },
    liveBadge: {
      position: "absolute",
      top: 14,
      left: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: radius.sm,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#fff",
    },
    liveBadgeText: {
      color: "#fff",
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 0.5,
    },
    // Pinned to the slide's right edge so they overlap the card's right side on any width.
    bubbles: {
      position: "absolute",
      right: -spacing.md,
      bottom: spacing.xl,
      gap: spacing.sm,
    },
    bubble: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
    },
    bubbleOne: {
      transform: [{ rotate: "2deg" }],
    },
    bubbleTwo: {
      marginLeft: spacing.lg,
      transform: [{ rotate: "-2deg" }],
    },
    bubbleName: {
      color: colors.textSecondary,
      fontFamily: fonts.bodyBold,
      fontSize: 10,
    },
    bubbleText: {
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: 13,
    },
    // Fixed height, top-aligned, so every slide's headline sits at the same spot and doesn't
    // jump while swiping (bodies run 2–4 lines).
    text: {
      paddingTop: spacing.xl,
      height: 200,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.display,
      fontSize: 30,
      lineHeight: 36,
      marginBottom: spacing.sm,
    },
    body: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 16,
      lineHeight: 23,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xxl,
      paddingTop: spacing.md,
    },
    dots: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    // Width/colour are driven per-frame by scrollX — only the static shape lives here.
    dot: {
      height: 7,
      borderRadius: 4,
    },
    primaryButton: {
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.xxl,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accent,
    },
    primaryButtonText: {
      color: colors.accentText,
      fontFamily: fonts.bodyBold,
      fontSize: 15,
    },
  });
}
