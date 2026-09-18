import { useMemo, useRef, useState } from "react";
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { requestPermission, scheduleUpcomingSessions } from "../lib/notifications";
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
// optional display name for a chat feature that doesn't exist yet (deferred) — stored
// locally now so there's nothing left to retrofit once it ships.
export default function Onboarding({ onDone }: { onDone: () => void }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [nameInput, setNameInput] = useState("");

  // Bruno's real sessions are fixed to 6AM/6PM India time (see lib/schedule.ts) — converted
  // here to whatever the viewer's own device clock calls that same moment, so this doesn't
  // literally claim "6AM" for someone who isn't in India.
  const slides = useMemo<Slide[]>(() => {
    const [first, second] = todaysSessions();
    return [
      {
        kind: "image",
        image: require("../assets/icon.png"),
        title: "This app is one dog.",
        body: "Bruno hears a real church bell and loses it, twice a day: once at dawn, once at dusk. This app watches for it live and wakes you up with the actual howl. Bruno's Alarm is currently in beta, so expect a rough edge or two.",
      },
      {
        kind: "icon",
        icon: "time-outline",
        title: `${formatLocalTime(first)}. ${formatLocalTime(second)}. Give or take.`,
        body: "He's a good boy, not a Swiss watch. Most days he's dead on the bell. Some days a squirrel happens. That's the deal. Want a specific time instead? You can set your own custom alarm anytime from the Home screen.",
      },
      {
        kind: "name-input",
        title: "What should we call you?",
        body: "Just for when Bruno's Pack (group chat) launches. Totally optional, skip if you'd rather stay anonymous.",
      },
      {
        kind: "icon",
        icon: "notifications-outline",
        title: "Let a dog wake you up.",
        body: "Turn on notifications and we'll ping you when he goes off. Best effort, same as him.",
      },
    ];
  }, []);

  const isLast = index === slides.length - 1;

  function goTo(next: number) {
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
    await persistDisplayName();
    onDone();
  }

  async function finishWithNotifications() {
    await persistDisplayName();
    const granted = await requestPermission();
    if (granted) await scheduleUpcomingSessions();
    onDone();
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.skip} onPress={handleDone} hitSlop={12}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
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
      </ScrollView>

      <View style={styles.dots}>
        {slides.map((slide, i) => (
          <View key={slide.title} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        {isLast ? (
          <>
            <Pressable style={styles.primaryButton} onPress={finishWithNotifications}>
              <Text style={styles.primaryButtonText}>Wake me up with Bruno</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={handleDone}>
              <Text style={styles.secondaryButtonText}>Nah, I'll risk it</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.primaryButton} onPress={() => goTo(index + 1)}>
            <Text style={styles.primaryButtonText}>Next</Text>
          </Pressable>
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
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      backgroundColor: colors.accent,
      width: 20,
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
