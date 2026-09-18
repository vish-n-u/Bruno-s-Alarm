import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ChatTermsGate from "./ChatTermsGate";
import ReportMessageModal from "./ReportMessageModal";
import { ensureAnonymousAuth } from "../lib/firebase";
import {
  acceptChatTerms,
  blockDevice,
  getBlockedDeviceIds,
  hasAcceptedChatTerms,
  reportChatMessage,
  sendChatMessage,
  subscribeToChatMessages,
  type ChatMessage,
  type SendMessageResult,
} from "../lib/chat";
import { fonts, radius, spacing, useThemeColors, type ThemeColors } from "../lib/theme";

const QUICK_EMOJIS = ["🐕", "😂", "❤️", "👏"];
// The list only grows to fit its content (up to this cap) rather than always reserving a
// fixed chunk of the video — so on a quiet chat, most of the video stays visible/tappable,
// and the "pass taps through to the video" requirement is satisfied by there simply being
// less overlay, not by fighting FlatList's own touch handling pixel-by-pixel.
const MAX_LIST_HEIGHT = 170;

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
      return "Chat is full for this session.";
    case "not-signed-in":
      return "Couldn't connect to chat — check your connection and try again.";
    case "unknown":
      return "Message didn't send — try again.";
  }
}

type Props = {
  sessionId: string;
  /** Only subscribes to Firestore (and renders the real chat UI) when true — otherwise shows
   * a quiet placeholder and holds no listener at all, so idle time outside a live session
   * costs nothing. */
  live: boolean;
};

// An overlay anchored to the bottom of the video, not a separate panel or drawer — mounted
// unconditionally by LiveScreen.tsx (so the placeholder always has a home), but only actually
// subscribes to messages while `live` is true. The root container is pointerEvents="box-none"
// so empty space around the (content-sized, not fixed-height) message list and controls still
// passes taps through to VideoPanel's own tap-to-mute underneath.
export default function LiveChat({ sessionId, live }: Props) {
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

  useEffect(() => {
    if (!live) {
      setMessages([]);
      return;
    }
    ensureAnonymousAuth().catch(() => {});
    const unsubscribe = subscribeToChatMessages(sessionId, setMessages);
    return unsubscribe;
  }, [live, sessionId]);

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  const visibleMessages = messages.filter((m) => !blockedIds.includes(m.deviceId));

  async function performSend(text: string) {
    setSending(true);
    setError(null);
    const result = await sendChatMessage(sessionId, text);
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
    await reportChatMessage(sessionId, target.id, reason).catch(() => {});
  }

  if (!live) {
    return (
      <View style={styles.root} pointerEvents="box-none">
        <View style={styles.placeholder} pointerEvents="none">
          <Ionicons name="chatbubble-ellipses-outline" size={16} color="rgba(255,255,255,0.55)" />
          <Text style={styles.placeholderText}>Chat opens when Bruno goes live</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} pointerEvents="box-none">
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
            placeholderTextColor="rgba(255,255,255,0.5)"
            returnKeyType="send"
            onSubmitEditing={handleSendPress}
          />
          <Pressable
            style={[styles.sendButton, (sending || !input.trim()) && styles.sendButtonDisabled]}
            onPress={handleSendPress}
            disabled={sending || !input.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={16} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>

      <ChatTermsGate visible={termsGateVisible} onAccept={handleAcceptTerms} onCancel={handleCancelTerms} />
      <ReportMessageModal
        visible={reportTarget !== null}
        onConfirm={handleConfirmReport}
        onCancel={() => setReportTarget(null)}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    placeholder: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "center",
      gap: spacing.xs,
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    placeholderText: {
      color: "rgba(255,255,255,0.7)",
      fontFamily: fonts.body,
      fontSize: 12,
    },
    list: {
      maxHeight: MAX_LIST_HEIGHT,
    },
    listContent: {
      gap: 2,
      paddingBottom: spacing.xs,
    },
    messageRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "baseline",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.sm,
    },
    messageName: {
      color: colors.live,
      fontFamily: fonts.bodyBold,
      fontSize: 12,
    },
    messageText: {
      color: "#fff",
      fontFamily: fonts.body,
      fontSize: 13,
      flexShrink: 1,
    },
    errorText: {
      color: "#ffb4a8",
      fontFamily: fonts.body,
      fontSize: 12,
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.xs,
    },
    controls: {
      backgroundColor: "rgba(0,0,0,0.5)",
      borderRadius: radius.lg,
      padding: spacing.sm,
      gap: spacing.sm,
    },
    quickRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    quickEmojiButton: {
      width: 34,
      height: 34,
      borderRadius: radius.pill,
      backgroundColor: "rgba(255,255,255,0.12)",
      alignItems: "center",
      justifyContent: "center",
    },
    quickEmojiText: {
      fontSize: 16,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      color: "#fff",
      fontFamily: fonts.body,
      fontSize: 14,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    sendButton: {
      width: 34,
      height: 34,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
  });
}
