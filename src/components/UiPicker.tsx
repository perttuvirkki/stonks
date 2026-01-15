import { memo } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
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

export const UiPicker = memo(({ options, selectedIndex, onSelect, variant = "segmented", color, style, darkMode }: UiPickerProps) => {
  if (variant !== "segmented") {
    return null;
  }

  const activeColor = color ?? "#1a9f7a";
  const containerBorder = darkMode ? "#2b2f35" : "#dddddd";
  const containerBg = darkMode ? "#12151a" : "#f4f5f6";
  const inactiveText = darkMode ? "#cfd3d8" : "#444444";

  return (
    <View
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
      {options.map((option, index) => {
        const isActive = selectedIndex === index;
        return (
          <Pressable
            key={index}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(index);
            }}
            style={({ pressed }) => [
              {
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isActive ? activeColor : "transparent",
                opacity: pressed ? 0.85 : 1,
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
