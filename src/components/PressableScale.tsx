import { memo, useState, type ReactNode } from "react";
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { tapHaptic } from "../haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Terminal keys don't wobble: a quick, firm press-down and a clean return, no spring overshoot.
const PRESS_TIMING = { duration: 70, easing: Easing.out(Easing.quad) };
const RELEASE_TIMING = { duration: 140, easing: Easing.out(Easing.cubic) };

export type PressableScaleProps = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  /** Extra style while the finger is down (e.g. a panel highlight). */
  pressedStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Scale while held down. */
  pressedScale?: number;
  /** Light tap haptic on press. */
  haptic?: boolean;
};

/** Pressable that presses in slightly like a hardware key and snaps back. */
export const PressableScale = memo(
  ({ style, pressedStyle, children, pressedScale = 0.97, haptic = true, onPressIn, onPressOut, onPress, disabled, ...rest }: PressableScaleProps) => {
    const scale = useSharedValue(1);
    const [pressed, setPressed] = useState(false);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = (event: GestureResponderEvent) => {
      scale.value = withTiming(pressedScale, PRESS_TIMING);
      if (pressedStyle) setPressed(true);
      onPressIn?.(event);
    };

    const handlePressOut = (event: GestureResponderEvent) => {
      scale.value = withTiming(1, RELEASE_TIMING);
      if (pressedStyle) setPressed(false);
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
        style={[style, pressed && pressedStyle, animatedStyle]}
      >
        {children}
      </AnimatedPressable>
    );
  },
);

PressableScale.displayName = "PressableScale";
