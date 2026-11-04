import { memo, useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { heavyHaptic, selectHaptic } from "../haptics";
import { TERMINAL_FONT, getTerminalPalette } from "../theme/terminal";

const HURRY_SECONDS = 10;
const TICK_HAPTIC_SECONDS = 5;

export type RoundTimerProps = {
  seconds: number;
  darkMode: boolean;
};

/**
 * Round clock in a terminal box. Amber while there's time; in the last ten seconds it inverts
 * to a red alert block and thumps every second (with haptics for the final five).
 */
export const RoundTimer = memo(({ seconds, darkMode }: RoundTimerProps) => {
  const palette = getTerminalPalette(darkMode);
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
    scale.value = withSequence(withTiming(clamped === 0 ? 1.1 : 1.06, { duration: 70 }), withTiming(1, { duration: 180 }));
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
            hurry
              ? { color: darkMode ? palette.bg : "#ffffff", backgroundColor: palette.red, borderColor: palette.red }
              : { color: palette.amber, backgroundColor: darkMode ? palette.bg : palette.panel, borderColor: palette.amber },
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
    fontFamily: TERMINAL_FONT,
    fontSize: 18,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    overflow: "hidden",
  },
});
