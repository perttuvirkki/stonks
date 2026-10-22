import { memo, type ReactNode } from "react";
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { tapHaptic } from "../haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Close to critically damped: a firm squish and a clean settle, no wobble.
const PRESS_SPRING = { damping: 35, stiffness: 500, mass: 0.6 };
const RELEASE_SPRING = { damping: 28, stiffness: 320, mass: 0.6 };

export type PressableScaleProps = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Scale while held down. */
  pressedScale?: number;
  /** Light tap haptic on press. */
  haptic?: boolean;
};

/** Pressable that squishes slightly on touch and settles back. */
export const PressableScale = memo(({ style, children, pressedScale = 0.97, haptic = true, onPressIn, onPressOut, onPress, disabled, ...rest }: PressableScaleProps) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (event: GestureResponderEvent) => {
    scale.value = withSpring(pressedScale, PRESS_SPRING);
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    scale.value = withSpring(1, RELEASE_SPRING);
    onPressOut?.(event);
  };

  const handlePress = (event: GestureResponderEvent) => {
    if (haptic) {
      tapHaptic();
    }
    onPress?.(event);
  };

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
});

PressableScale.displayName = "PressableScale";
