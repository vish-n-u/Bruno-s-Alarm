import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import ChatTermsGate from "../components/ChatTermsGate";
import ReportMessageModal from "../components/ReportMessageModal";
import { ensureAnonymousAuth } from "../lib/firebase";
import {
  acceptChatTerms,
  blockDevice,
  BRUNOS_PACK_SESSION_ID,
  getBlockedDeviceIds,
  hasAcceptedChatTerms,
  reportChatMessage,
  sendChatMessage,
  subscribeToChatMessages,
  type ChatMessage,
  type SendMessageResult,
} from "../lib/chat";
import { fonts, radius, shadow, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

// A real, working, backend-wired chat — hidden behind App.tsx's CHAT_ENABLED flag while it's
// tested (see docs/hidden-features.md), not a UI mockup. Deliberately its own screen rather
// than a variant of components/LiveChat.tsx: that component is built to be a video overlay
// (dark, semi-transparent, absolutely positioned, box-none pointer events so taps pass
// through to the video underneath) with a live/not-live distinction baked in. This is a
// plain full-screen tab with no video and no "is it live" concept at all — always open,
// using the app's normal light/dark theme rather than a fixed dark palette. It shares
// everything from lib/chat.ts (and the same Cloud Function, security rules, moderation, rate
// limiting) with the live chat — the only thing that makes this a persistent room rather than
// a per-session one is passing a fixed sessionId instead of a real session's derived one; see
// BRUNOS_PACK_SESSION_ID's own doc for the one backend exception that requires (the message
// cap, which assumes a session eventually resets).

const QUICK_EMOJIS = ["🐕", "😂", "❤️", "👏"];

function errorMessageFor(reason: Exclude<SendMessageResult, { ok: true }>["reason"]): string {
  switch (reason) {
    case "empty":
      return "";
    case "too-long":
      return "Message is too long (200 characters max).";
    case "profanity":
      return "That message isn't allowed here.";
    case "rate-limited":
      return "Slow down a little — you're sending messages too fast.";
    case "session-full":
      return "Chat is full right now — try again later.";
    case "not-signed-in":
      return "Couldn't connect to chat — check your connection and try again.";
    case "unknown":
      return "Message didn't send — try again.";
  }
}

export default function BrunosPackScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const pendingSendRef = useRef<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsGateVisible, setTermsGateVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<ChatMessage | null>(null);

  useEffect(() => {
    getBlockedDeviceIds().then(setBlockedIds);
  }, []);

  // Always subscribed — unlike LiveChat, there's no live/not-live gate here, the room is
  // always open. Still cleaned up on unmount (switching away from this tab) like any
  // subscription.
  useEffect(() => {
    ensureAnonymousAuth().catch(() => {});
    const unsubscribe = subscribeToChatMessages(BRUNOS_PACK_SESSION_ID, setMessages);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  const visibleMessages = messages.filter((m) => !blockedIds.includes(m.deviceId));

  async function performSend(text: string) {
    setSending(true);
    setError(null);
    const result = await sendChatMessage(BRUNOS_PACK_SESSION_ID, text);
    setSending(false);
    if (result.ok) {
      setInput("");
      return;
    }
    const message = errorMessageFor(result.reason);
    if (message) setError(message);
  }

  async function sendWithTermsCheck(text: string) {
    if (!text || sending) return;
    const accepted = await hasAcceptedChatTerms();
    if (!accepted) {
      pendingSendRef.current = text;
      setTermsGateVisible(true);
      return;
    }
    performSend(text);
  }

  function handleSendPress() {
    sendWithTermsCheck(input.trim());
  }

  function handleQuickEmoji(emoji: string) {
    sendWithTermsCheck(emoji);
  }

  async function handleAcceptTerms() {
    await acceptChatTerms();
    setTermsGateVisible(false);
    const pending = pendingSendRef.current;
    pendingSendRef.current = null;
    if (pending) performSend(pending);
  }

  function handleCancelTerms() {
    setTermsGateVisible(false);
    pendingSendRef.current = null;
  }

  function handleMessageLongPress(message: ChatMessage) {
    Alert.alert(message.displayName, undefined, [
      { text: "Report message", onPress: () => setReportTarget(message) },
      {
        text: "Block this viewer",
        style: "destructive",
        onPress: () => {
          blockDevice(message.deviceId).catch(() => {});
          setBlockedIds((prev) => [...prev, message.deviceId]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function handleConfirmReport(reason: string) {
    const target = reportTarget;
    setReportTarget(null);
    if (!target) return;
    await reportChatMessage(BRUNOS_PACK_SESSION_ID, target.id, reason).catch(() => {});
  }

  return (
    // Only the top edge — this screen sits above the tab bar, which already accounts for
    // the device's bottom safe-area inset; requesting "bottom" here double-padded it,
    // leaving a visible empty strip between the controls and the tab bar.
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Bruno's Pack</Text>
        <Text style={styles.subtitle}>One room, always open — say hi.</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <FlatList
          ref={listRef}
          data={visibleMessages}
          keyExtractor={(m) => m.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable onLongPress={() => handleMessageLongPress(item)} style={styles.messageRow}>
              <Text style={styles.messageName}>{item.displayName}</Text>
              <Text style={styles.messageText}>{item.text}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <LottieView
                source={require("../assets/animations/dog-saxophone.json")}
                autoPlay
                loop
                style={styles.emptyLottie}
              />
              <Text style={styles.emptyStateText}>No messages yet — be the first to say something.</Text>
            </View>
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.controls}>
          <View style={styles.quickRow}>
            {QUICK_EMOJIS.map((emoji) => (
              <Pressable key={emoji} style={styles.quickEmojiButton} onPress={() => handleQuickEmoji(emoji)}>
                <Text style={styles.quickEmojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Say something..."
              placeholderTextColor={colors.textSecondary}
              returnKeyType="send"
              onSubmitEditing={handleSendPress}
            />
            <Pressable
              style={[styles.sendButton, (sending || !input.trim()) && styles.sendButtonDisabled]}
              onPress={handleSendPress}
              disabled={sending || !input.trim()}
              hitSlop={8}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.accentText} />
              ) : (
                <Ionicons name="send" size={20} color={colors.accentText} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ChatTermsGate visible={termsGateVisible} onAccept={handleAcceptTerms} onCancel={handleCancelTerms} />
      <ReportMessageModal
        visible={reportTarget !== null}
        onConfirm={handleConfirmReport}
        onCancel={() => setReportTarget(null)}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flexFill: {
      flex: 1,
    },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.display,
      fontSize: 22,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    subtitle: {
      color: colors.textSecondary,
      fontFamily: fonts.hand,
      fontSize: 15,
      marginTop: 2,
    },
    list: {
      flex: 1,
    },
    listContent: {
      flexGrow: 1,
      padding: spacing.lg,
      gap: spacing.xs,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingTop: spacing.xxl * 2,
    },
    emptyLottie: {
      width: 160,
      height: 160,
    },
    emptyStateText: {
      color: colors.textSecondary,
      fontFamily: fonts.body,
      fontSize: 14,
      textAlign: "center",
      maxWidth: 240,
    },
    messageRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "baseline",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    messageName: {
      color: colors.live,
      fontFamily: fonts.bodyBold,
      fontSize: 12,
    },
    messageText: {
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: 14,
      flexShrink: 1,
    },
    errorText: {
      color: colors.danger,
      fontFamily: fonts.body,
      fontSize: 12,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xs,
    },
    controls: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: spacing.md,
      gap: spacing.md,
    },
    quickRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    quickEmojiButton: {
      width: 42,
      height: 42,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    quickEmojiText: {
      fontSize: 19,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: 15,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
    },
    sendButton: {
      width: 46,
      height: 46,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      alignItems: "center",
      justifyContent: "center",
      ...shadow,
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
  });
}
