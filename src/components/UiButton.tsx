import { memo } from "react";
import { Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import { getContrastingTextColor } from "./uiColors";

export type ButtonVariant = "bordered" | "borderedProminent" | "plain";
export type ButtonControlSize = "small" | "regular" | "large";

export type UiButtonProps = {
  title?: string;
  systemImage?: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  color?: string;
  controlSize?: ButtonControlSize;
  style?: StyleProp<ViewStyle>;
  darkMode?: boolean;
};

export const UiButton = memo(({ title, systemImage, onPress, disabled, variant, color, controlSize, style, darkMode }: UiButtonProps) => {
  const size = controlSize ?? "regular";
  const paddingVertical = size === "large" ? 14 : size === "small" ? 6 : 10;
  const paddingHorizontal = size === "large" ? 14 : size === "small" ? 10 : 12;
  const fontSize = size === "large" ? 16 : size === "small" ? 12 : 14;

  const isProminent = (variant ?? "bordered") === "borderedProminent";
  const isPlain = (variant ?? "bordered") === "plain";
  const backgroundColor = isProminent ? color ?? "#1a9f7a" : "transparent";
  const borderColor = !isPlain && !isProminent ? color ?? (darkMode ? "#2b2f35" : "#dddddd") : "transparent";
  const borderWidth = !isPlain && !isProminent ? 1 : 0;
  const textColor = isProminent ? getContrastingTextColor(backgroundColor, "#ffffff") : color ?? (darkMode ? "#e6e6e6" : "#222222");

  const displayTitle = title ?? (systemImage === "gearshape" ? "⚙︎" : "");

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor,
          borderColor,
          borderWidth,
          borderRadius: 12,
          paddingVertical,
          paddingHorizontal,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text style={{ color: textColor, fontSize, fontWeight: "700" }}>{displayTitle}</Text>
    </Pressable>
  );
});

UiButton.displayName = "UiButton";
