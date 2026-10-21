import { memo, useEffect, useState } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { selectHaptic } from "../haptics";
import { getContrastingTextColor } from "./uiColors";

export type UiPickerProps = {
  options: string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  variant?: "segmented";
  color?: string;
  style?: StyleProp<ViewStyle>;
  darkMode?: boolean;
};

const SLIDE_SPRING = { damping: 30, stiffness: 300, mass: 0.8 };

export const UiPicker = memo(({ options, selectedIndex, onSelect, variant = "segmented", color, style, darkMode }: UiPickerProps) => {
  const [width, setWidth] = useState(0);
  const segmentWidth = options.length > 0 ? width / options.length : 0;
  const indicatorX = useSharedValue(0);

  useEffect(() => {
    if (selectedIndex == null || segmentWidth <= 0) {
      return;
    }
    indicatorX.value = withSpring(selectedIndex * segmentWidth, SLIDE_SPRING);
  }, [indicatorX, segmentWidth, selectedIndex]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  if (variant !== "segmented") {
    return null;
  }

  const activeColor = color ?? "#1a9f7a";
  const containerBorder = darkMode ? "#2b2f35" : "#dddddd";
  const containerBg = darkMode ? "#12151a" : "#f4f5f6";
  const inactiveText = darkMode ? "#cfd3d8" : "#444444";

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 2)}
      style={[
        {
          flexDirection: "row",
          borderRadius: 12,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: containerBorder,
          backgroundColor: containerBg,
        },
        style,
      ]}
    >
      {selectedIndex != null && segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: segmentWidth,
              borderRadius: 11,
              backgroundColor: activeColor,
            },
            indicatorStyle,
          ]}
        />
      )}
      {options.map((option, index) => {
        const isActive = selectedIndex === index;
        return (
          <Pressable
            key={index}
            onPress={() => {
              if (!isActive) {
                selectHaptic();
              }
              onSelect(index);
            }}
            style={({ pressed }) => [
              {
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 10,
                alignItems: "center",
                justifyContent: "center",
                // Until the first layout pass, fall back to a static fill so the selection is never invisible.
                backgroundColor: isActive && segmentWidth <= 0 ? activeColor : "transparent",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: isActive ? getContrastingTextColor(activeColor, "#ffffff") : inactiveText,
              }}
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
