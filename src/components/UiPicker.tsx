import { memo, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { selectHaptic } from "../haptics";
import { TERMINAL_FONT, getTerminalPalette } from "../theme/terminal";
import { getReadableTextOn } from "./uiColors";

export type UiPickerProps = {
  options: string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  variant?: "segmented";
  color?: string;
  style?: StyleProp<ViewStyle>;
  darkMode?: boolean;
};

// A cursor moving between cells: quick and decisive, no overshoot.
const SLIDE_TIMING = { duration: 160, easing: Easing.out(Easing.cubic) };

// Terminal-style segmented control: square cells split by hairlines, with an accent block
// that slides to the selected cell.
export const UiPicker = memo(({ options, selectedIndex, onSelect, variant = "segmented", color, style, darkMode }: UiPickerProps) => {
  const [width, setWidth] = useState(0);
  const segmentWidth = options.length > 0 ? width / options.length : 0;
  const indicatorX = useSharedValue(0);
  const hasPlacedRef = useRef(false);

  useEffect(() => {
    if (selectedIndex == null || segmentWidth <= 0) {
      return;
    }
    const target = selectedIndex * segmentWidth;
    // Jump into place on first layout; slide on every change after that.
    indicatorX.value = hasPlacedRef.current ? withTiming(target, SLIDE_TIMING) : target;
    hasPlacedRef.current = true;
  }, [indicatorX, segmentWidth, selectedIndex]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  if (variant !== "segmented") {
    return null;
  }

  const palette = getTerminalPalette(darkMode);
  const accent = color ?? palette.amber;
  const indicatorReady = selectedIndex != null && segmentWidth > 0;

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 2)}
      style={[styles.row, { borderColor: palette.borderStrong, backgroundColor: palette.panel }, style]}
    >
      {indicatorReady && (
        <Animated.View pointerEvents="none" style={[styles.indicator, { width: segmentWidth, backgroundColor: accent }, indicatorStyle]} />
      )}
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <Pressable
            key={`${option}-${index}`}
            onPress={() => {
              if (!selected) {
                selectHaptic();
              }
              onSelect(index);
            }}
            style={({ pressed }) => [
              styles.cell,
              index > 0 && { borderLeftWidth: 1, borderLeftColor: palette.border },
              {
                // Until the first layout pass, fall back to a static fill so the selection is never invisible.
                backgroundColor: selected && !indicatorReady ? accent : pressed && !selected ? palette.panelAlt : "transparent",
              },
            ]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={[styles.label, { color: selected ? getReadableTextOn(accent) : palette.text }]}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

UiPicker.displayName = "UiPicker";

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 2,
    overflow: "hidden",
  },
  indicator: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  label: {
    fontFamily: TERMINAL_FONT,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
