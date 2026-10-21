import { memo, type ReactNode } from "react";
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { tapHaptic } from "../haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.6 };
const RELEASE_SPRING = { damping: 11, stiffness: 260, mass: 0.7 };

export type PressableScaleProps = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Scale while held down. */
  pressedScale?: number;
  /** Light tap haptic on press. */
  haptic?: boolean;
};

/** Pressable that squishes on touch and springs back with a little overshoot. */
export const PressableScale = memo(({ style, children, pressedScale = 0.96, haptic = true, onPressIn, onPressOut, onPress, disabled, ...rest }: PressableScaleProps) => {
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
