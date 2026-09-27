import { StyleSheet, Text, View } from "react-native";
import Touchable from "./Touchable";
import { fonts, radius, shadow, spacing } from "../lib/theme";

type Props = {
  visible: boolean;
  message: string;
  onUndo: () => void;
};

/** A floating bar for "you just did something reversible" — an alarm disappears from its list
 * the instant you tap delete (see Home/CustomAlarmScreen's own `requestDelete`), and this is
 * the few-second window to change your mind before that becomes permanent. Deliberately a
 * solid dark bar regardless of theme, matching the one other floating control surface in the
 * app (LiveChat's overlay) — high-contrast and unmistakably a toast, not part of the page. */
export default function UndoSnackbar({ visible, message, onUndo }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.bar}>
        <Text style={styles.message}>{message}</Text>
        <Touchable onPress={onUndo} hitSlop={10} style={styles.undoButton}>
          <Text style={styles.undoText}>Undo</Text>
        </Touchable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xxl,
    alignItems: "center",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: "#14171c",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadow,
  },
  message: {
    flex: 1,
    color: "#fff",
    fontFamily: fonts.body,
    fontSize: 14,
  },
  undoButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  undoText: {
    color: "#ffcf7a",
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
});
