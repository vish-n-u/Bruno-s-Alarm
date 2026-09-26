import { useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Touchable from "./Touchable";
import { ensureAlarmPermissions } from "../lib/alarmPermissions";
import { tapLight } from "../lib/haptics";
import { scheduleUpcomingSessions } from "../lib/notifications";
import { generateGuestName, setDisplayName } from "../lib/profile";
import { todaysSessions } from "../lib/schedule";
import { fonts, radius, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

function formatLocalTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

type ImageSlide = { kind: "image"; image: number; title: string; body: string };
type IconSlide = { kind: "icon"; icon: keyof typeof Ionicons.glyphMap; title: string; body: string };
type NameInputSlide = { kind: "name-input"; title: string; body: string };
type Slide = ImageSlide | IconSlide | NameInputSlide;

// Slide 1 uses the real studio photo of Bruno instead of a generic icon — it's the very
// first thing a new user sees, and a real dog beats a stock paw glyph for making the point
// that this app is about one specific, real animal. Slides 2, 4 stay icon-led since they're
// about concepts (schedule, notifications), not "this is a real dog." Slide 3 collects an
// optional display name for the chat (hidden for now, see docs/hidden-features.md) — stored
// locally now so there's nothing left to retrofit once it ships. Copy is deliberately short
// and a little self-deprecating; keep it that way when editing.
export default function Onboarding({ onDone }: { onDone: () => void }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  // Rendered full-screen outside any SafeAreaView/navigator, so the status bar and the system
  // nav bar have to be padded for by hand — otherwise Skip sits under the status bar (and its
  // taps get swallowed) and the footer buttons touch the nav bar.
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [nameInput, setNameInput] = useState("");
  // Drives the page dots' width/opacity continuously as you swipe, instead of them snapping
  // between two fixed states only once a page settles — the same "growing pill" feel iOS/
  // Android's own page indicators have.
  const scrollX = useRef(new Animated.Value(0)).current;

  // Bruno's real sessions are fixed to 6AM/6PM India time (see lib/schedule.ts) — converted
  // here to whatever the viewer's own device clock calls that same moment, so this doesn't
  // literally claim "6AM" for someone who isn't in India.
  const slides = useMemo<Slide[]>(() => {
    const [first, second] = todaysSessions();
    return [
      {
        kind: "image",
        image: require("../assets/icon.png"),
        title: "It's an alarm. Sort of.",
        body: "A dog howls at a church bell twice a day. This wakes you up with it. It's a beta, so sorry in advance.",
      },
      {
        kind: "icon",
        icon: "time-outline",
        title: `Around ${formatLocalTime(first)} and ${formatLocalTime(second)}.`,
        body: "He isn't punctual, sorry. You can set your own alarm time from Home instead.",
      },
      {
        kind: "name-input",
        title: "Got a name?",
        body: "It's for the chat, whenever that exists. Skip if you like.",
      },
      {
        kind: "icon",
        icon: "notifications-outline",
        title: "Want a heads up?",
        body: "We'll notify you when he starts. Probably.",
      },
    ];
  }, []);

  const isLast = index === slides.length - 1;

  function goTo(next: number) {
    tapLight();
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  }

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  // Saved exactly once, at actual completion, rather than per-slide — slides page via a
  // swipeable ScrollView, so someone could swipe straight past the name slide without ever
  // tapping its "Next," and this still needs to record a guest name for them either way.
  async function persistDisplayName() {
    await setDisplayName(nameInput.trim() || generateGuestName());
  }

  async function handleDone() {
    tapLight();
    await persistDisplayName();
    onDone();
  }

  async function finishWithNotifications() {
    // Fires immediately — ensureAlarmPermissions() below can pop a system permission dialog,
    // which shouldn't be the first feedback the tap gets.
    tapLight();
    await persistDisplayName();
    const granted = await ensureAlarmPermissions();
    if (granted) await scheduleUpcomingSessions();
    onDone();
  }

  return (
    <View style={styles.container}>
      <Touchable style={[styles.skip, { top: insets.top + spacing.sm }]} onPress={handleDone} hitSlop={12}>
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
        {slides.map((slide) => (
          <View key={slide.title} style={[styles.slide, { width }]}>
            {slide.kind === "image" ? (
              <Image source={slide.image} style={styles.slideImage} resizeMode="cover" />
            ) : slide.kind === "icon" ? (
              <Ionicons name={slide.icon} size={56} color={colors.accent} style={styles.icon} />
            ) : (
              <Ionicons name="person-circle-outline" size={56} color={colors.accent} style={styles.icon} />
            )}
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
            {slide.kind === "name-input" && (
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="e.g. Jamie"
                placeholderTextColor={colors.textSecondary}
                style={styles.nameInput}
                maxLength={24}
                autoCapitalize="words"
                returnKeyType="done"
              />
            )}
          </View>
        ))}
      </Animated.ScrollView>

      <View style={styles.dots}>
        {slides.map((slide, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({ inputRange, outputRange: [7, 20, 7], extrapolate: "clamp" });
          const dotColor = scrollX.interpolate({ inputRange, outputRange: [colors.border, colors.accent, colors.border] });
          return (
            <Animated.View key={slide.title} style={[styles.dot, { width: dotWidth, backgroundColor: dotColor }]} />
          );
        })}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        {isLast ? (
          <>
            <Touchable style={styles.primaryButton} onPress={finishWithNotifications}>
              <Text style={styles.primaryButtonText}>Okay, notify me</Text>
            </Touchable>
            <Touchable style={styles.secondaryButton} onPress={handleDone}>
              <Text style={styles.secondaryButtonText}>No thanks</Text>
            </Touchable>
          </>
        ) : (
          <Touchable style={styles.primaryButton} onPress={() => goTo(index + 1)}>
            <Text style={styles.primaryButtonText}>Next</Text>
          </Touchable>
        )}
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
      top: spacing.lg,
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
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xxl + spacing.sm,
    },
    icon: {
      marginBottom: spacing.xxl - spacing.xs,
    },
    slideImage: {
      width: 220,
      height: 220,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.surface,
      marginBottom: spacing.xxl - spacing.xs,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.display,
      fontSize: 22,
      marginBottom: spacing.md,
      textAlign: "center",
    },
    body: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 15,
      textAlign: "center",
      lineHeight: 22,
    },
    nameInput: {
      marginTop: spacing.xl,
      width: "100%",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: 16,
      textAlign: "center",
    },
    dots: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    // Width/color are driven per-frame by scrollX (see the animated dots above) — only the
    // static shape lives here.
    dot: {
      height: 7,
      borderRadius: 4,
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl + spacing.md,
      gap: spacing.md - spacing.xs,
    },
    primaryButton: {
      paddingVertical: spacing.lg - 2,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accent,
      alignItems: "center",
    },
    primaryButtonText: {
      color: colors.accentText,
      fontFamily: fonts.bodyBold,
      fontSize: 15,
    },
    secondaryButton: {
      paddingVertical: spacing.sm + 2,
      alignItems: "center",
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 14,
    },
  });
}
