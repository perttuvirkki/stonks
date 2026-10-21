import { memo, useEffect, useRef, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

export type AnimatedNumberProps = {
  value: number;
  format: (value: number) => string;
  style?: StyleProp<TextStyle>;
  /** Count-up length in ms. */
  duration?: number;
  /** Start counting from this value on mount instead of showing `value` straight away. */
  initialValue?: number;
  /** Delay before counting starts (mount and changes). */
  delay?: number;
  /** Pop and tint the text green/red when the value moves. */
  flash?: boolean;
  /** Colour the text returns to after a flash. */
  baseColor?: string;
  upColor?: string;
  downColor?: string;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Text that ticks from its previous value to the new one. The count runs on the JS thread at
 * frame rate, which is cheap for the handful of numbers on screen and keeps formatting in JS.
 */
export const AnimatedNumber = memo(
  ({ value, format, style, duration = 650, initialValue, delay = 0, flash = false, baseColor = "#111111", upColor = "#1a9f7a", downColor = "#d94b4b" }: AnimatedNumberProps) => {
    const [display, setDisplay] = useState(initialValue ?? value);
    const displayRef = useRef(initialValue ?? value);
    const frameRef = useRef<number | null>(null);
    const scale = useSharedValue(1);
    const tint = useSharedValue(0);
    const direction = useSharedValue(1);

    useEffect(() => {
      const from = displayRef.current;
      if (from === value) {
        return;
      }
      let startedAt: number | null = null;
      const step = (now: number) => {
        if (startedAt === null) {
          startedAt = now;
        }
        const elapsed = now - startedAt - delay;
        const t = Math.min(1, Math.max(0, elapsed / duration));
        const next = t >= 1 ? value : from + (value - from) * easeOutCubic(t);
        displayRef.current = next;
        setDisplay(next);
        if (t < 1) {
          frameRef.current = requestAnimationFrame(step);
        } else {
          frameRef.current = null;
        }
      };
      frameRef.current = requestAnimationFrame(step);

      if (flash) {
        direction.value = value > from ? 1 : -1;
        scale.value = withSequence(withTiming(1.12, { duration: 110 }), withSpring(1, { damping: 8, stiffness: 220 }));
        tint.value = withSequence(withTiming(1, { duration: 120 }), withTiming(1, { duration: duration }), withTiming(0, { duration: 500 }));
      }

      return () => {
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
      };
    }, [delay, direction, duration, flash, scale, tint, value]);

    const animatedStyle = useAnimatedStyle(() => {
      if (!flash) {
        return {};
      }
      return {
        transform: [{ scale: scale.value }],
        color: interpolateColor(tint.value, [0, 1], [baseColor, direction.value > 0 ? upColor : downColor]),
      };
    });

    if (!flash) {
      return <Text style={style}>{format(display)}</Text>;
    }
    return <Animated.Text style={[style, animatedStyle]}>{format(display)}</Animated.Text>;
  }
);

AnimatedNumber.displayName = "AnimatedNumber";
