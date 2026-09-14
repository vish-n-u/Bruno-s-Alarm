import { useRef, useState } from "react";
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { requestPermission, scheduleUpcomingSessions } from "../lib/notifications";
import { fonts, radius, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

// Slide 1 uses the real studio photo of Bruno instead of a generic icon — it's the very
// first thing a new user sees, and a real dog beats a stock paw glyph for making the point
// that this app is about one specific, real animal. Slides 2-3 stay icon-led since they're
// about concepts (schedule, notifications), not "this is a real dog."
const SLIDES = [
  {
    image: require("../assets/icon.png"),
    title: "This app is one dog.",
    body: "Bruno hears the church bell and loses it. Every morning. Every evening. That's the whole app.",
  },
  {
    icon: "time-outline" as const,
    title: "6AM. 6PM. Give or take.",
    body: "He's a good boy, not a Swiss watch. Most days he's dead on the bell. Some days a squirrel happens. That's the deal.",
  },
  {
    icon: "notifications-outline" as const,
    title: "Let a dog wake you up.",
    body: "Turn on notifications and we'll ping you when he goes off. Best effort, same as him.",
  },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  function goTo(next: number) {
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  }

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  async function finishWithNotifications() {
    const granted = await requestPermission();
    if (granted) await scheduleUpcomingSessions();
    onDone();
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.skip} onPress={onDone} hitSlop={12}>
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
        {SLIDES.map((slide) => (
          <View key={slide.title} style={[styles.slide, { width }]}>
            {"image" in slide ? (
              <Image source={slide.image} style={styles.slideImage} resizeMode="cover" />
            ) : (
              <Ionicons name={slide.icon} size={56} color={colors.accent} style={styles.icon} />
            )}
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((slide, i) => (
          <View key={slide.title} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        {isLast ? (
          <>
            <Pressable style={styles.primaryButton} onPress={finishWithNotifications}>
              <Text style={styles.primaryButtonText}>Wake me up with Bruno</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={onDone}>
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
