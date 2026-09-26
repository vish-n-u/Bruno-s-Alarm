import { useRef } from "react";
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

// Wrapping Pressable itself (rather than nesting a separate Animated.View inside it) is
// deliberate: an earlier version put the real `style` — including `position: "absolute"` for
// things like the FAB — on an inner wrapper and left the outer Pressable unstyled. The outer
// Pressable's own box is what actually gets hit-tested, so it rendered in the right place but
// tapping it did nothing once its style (and therefore its layout box) diverged from what was
// visible. Animating the Pressable directly means there's only ever one box, so this can't
// happen again.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** How far it shrinks on press, 1 = no shrink. The default reads as a subtle, tactile
   * "squish" on everything from a small header button to a full-width primary button — not
   * meant to be re-tuned per element. */
  scaleTo?: number;
};

/**
 * A drop-in replacement for Pressable that actually looks pressed. Every card/row/button in
 * the app used to be a plain Pressable with a static style — nothing visibly happened until
 * whatever onPress kicked off had finished, which reads as unfinished/unresponsive regardless
 * of how fast the action actually is. Dims and springs into a slight scale-down the instant a
 * touch lands, springing back on release or a cancelled touch — both driven by the same
 * Animated.Value so they stay in sync, and both run on the native thread.
 */
export default function Touchable({ style, scaleTo = 0.97, onPressIn, onPressOut, children, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(scale.interpolate({ inputRange: [scaleTo, 1], outputRange: [0.85, 1] })).current;

  function handlePressIn(e: GestureResponderEvent) {
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
    onPressIn?.(e);
  }

  function handlePressOut(e: GestureResponderEvent) {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
    onPressOut?.(e);
  }

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, { transform: [{ scale }], opacity }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
