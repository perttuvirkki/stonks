import { memo, useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { heavyHaptic, selectHaptic } from "../haptics";

const HURRY_SECONDS = 10;
const TICK_HAPTIC_SECONDS = 5;

export type RoundTimerProps = {
  seconds: number;
  darkMode: boolean;
};

/** Round clock pill. Calm until the last ten seconds, then it turns red and thumps every second. */
export const RoundTimer = memo(({ seconds, darkMode }: RoundTimerProps) => {
  const scale = useSharedValue(1);
  const lastSecondRef = useRef(seconds);
  const clamped = Math.max(0, seconds);
  const hurry = clamped <= HURRY_SECONDS;

  useEffect(() => {
    const previous = lastSecondRef.current;
    lastSecondRef.current = clamped;
    if (clamped >= previous || clamped > HURRY_SECONDS) {
      return;
    }
    scale.value = withSequence(withTiming(clamped === 0 ? 1.3 : 1.16, { duration: 90 }), withSpring(1, { damping: 7, stiffness: 240 }));
    if (clamped === 0) {
      heavyHaptic();
    } else if (clamped <= TICK_HAPTIC_SECONDS) {
      selectHaptic();
    }
  }, [clamped, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={animatedStyle}>
        <Text
          style={[
            styles.text,
            darkMode && styles.textDark,
            hurry && styles.textHurry,
            hurry && darkMode && styles.textHurryDark,
          ]}
        >
          {clamped}s
        </Text>
      </Animated.View>
    </View>
  );
});

RoundTimer.displayName = "RoundTimer";

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 54,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  text: {
    fontSize: 18,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    color: "#1a9f7a",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: "hidden",
  },
  textDark: {
    backgroundColor: "rgba(13, 15, 18, 0.85)",
  },
  textHurry: {
    color: "#ffffff",
    backgroundColor: "#d94b4b",
  },
  textHurryDark: {
    backgroundColor: "#c43d3d",
  },
});
