import { memo } from "react";
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Button as ExpoButton, Host as ExpoHost, Text as ExpoText } from "@expo/ui";
import {
  allowsTightening,
  controlSize as nativeControlSize,
  frame,
  lineLimit,
  minimumScaleFactor,
} from "@expo/ui/swift-ui/modifiers";
import { fillMaxSize } from "@expo/ui/jetpack-compose/modifiers";
import * as Haptics from "expo-haptics";
import { getContrastingTextColor, getReadableTextOn } from "./uiColors";
import { TERMINAL_FONT, getTerminalPalette } from "../theme/terminal";
import { EmojiText, hasTwemoji } from "./Twemoji";

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
  /** Keep the original native button look (used by the meme and newspaper screens). */
  classic?: boolean;
  children?: React.ReactNode;
};

export const UiButton = memo(
  ({ title, systemImage, onPress, disabled, variant, color, controlSize, style, darkMode, classic, children }: UiButtonProps) => {
  const size = controlSize ?? "regular";
  const paddingVertical = size === "large" ? 14 : size === "small" ? 6 : 10;
  const paddingHorizontal = size === "large" ? 14 : size === "small" ? 10 : 12;
  const fontSize = size === "large" ? 16 : size === "small" ? 12 : 14;
  const controlHeight = size === "large" ? 50 : size === "small" ? 32 : 40;

  const isProminent = (variant ?? "bordered") === "borderedProminent";
  const isPlain = (variant ?? "bordered") === "plain";
  const backgroundColor = isProminent ? color ?? "#1a9f7a" : "transparent";
  const borderColor = !isPlain && !isProminent ? color ?? (darkMode ? "#2b2f35" : "#dddddd") : "transparent";
  const borderWidth = !isPlain && !isProminent ? 1 : 0;
  const textColor = isProminent ? getContrastingTextColor(backgroundColor, "#ffffff") : color ?? (darkMode ? "#e6e6e6" : "#222222");

  const displayTitle = title ?? (systemImage === "gearshape" ? "⚙︎" : "");

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  if (!classic) {
    const palette = getTerminalPalette(darkMode);
    const terminalBackground = isProminent ? color ?? palette.amber : "transparent";
    const terminalBorder = isPlain ? "transparent" : isProminent ? terminalBackground : color ?? palette.borderStrong;
    const terminalText = isProminent ? getReadableTextOn(terminalBackground) : color ?? (isPlain ? palette.textDim : palette.text);

    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        style={({ pressed }) => [
          {
            minHeight: controlHeight,
            backgroundColor: pressed && !isProminent ? palette.panelAlt : terminalBackground,
            borderColor: terminalBorder,
            borderWidth: isPlain ? 0 : 1,
            borderRadius: 2,
            paddingHorizontal,
            alignItems: "center",
            justifyContent: "center",
            opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
          },
          style,
        ]}
      >
        {children ? (
          children
        ) : (
          <EmojiText
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{
              color: terminalText,
              fontFamily: TERMINAL_FONT,
              fontSize: fontSize - 1,
              fontWeight: "700",
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            {displayTitle}
          </EmojiText>
        )}
      </Pressable>
    );
  }

  // Expo UI hosts cannot embed arbitrary React Native children. Simple labels
  // use native SwiftUI/Compose buttons; custom icon layouts and Twemoji labels retain the RN path.
  const canUseNativeButton = Platform.OS !== "web" && !children && !hasTwemoji(displayTitle);

  if (canUseNativeButton) {
    const nativeVariant = isProminent ? "filled" : isPlain ? "text" : "outlined";
    const nativeTint = color ?? (isProminent ? "#1a9f7a" : darkMode ? "#e6e6e6" : "#222222");
    const flattenedStyle = StyleSheet.flatten(style);
    const estimatedLabelWidth = Math.min(
      320,
      Math.max(controlHeight, Math.ceil(displayTitle.length * fontSize * 0.82 + paddingHorizontal * 3)),
    );

    return (
      <View
        style={[
          {
            height: controlHeight,
            opacity: disabled ? 0.5 : 1,
          },
          style,
          flattenedStyle?.width == null && {
            minWidth: Math.max(
              estimatedLabelWidth,
              typeof flattenedStyle?.minWidth === "number" ? flattenedStyle.minWidth : 0,
            ),
          },
        ]}
      >
        <ExpoHost
          colorScheme={darkMode ? "dark" : "light"}
          seedColor={nativeTint}
          ignoreSafeArea="all"
          style={StyleSheet.absoluteFill}
        >
          <ExpoButton
            label={Platform.OS === "ios" ? undefined : displayTitle}
            onPress={handlePress}
            disabled={disabled}
            variant={nativeVariant}
            modifiers={[
              frame({ maxWidth: Infinity, maxHeight: Infinity, minHeight: controlHeight }),
              nativeControlSize(size),
              fillMaxSize(),
            ]}
          >
            {Platform.OS === "ios" ? (
              <ExpoText
                textStyle={{ fontSize, fontWeight: "700", textAlign: "center" }}
                modifiers={[
                  frame({ maxWidth: Infinity, alignment: "center" }),
                  lineLimit(1),
                  allowsTightening(true),
                  minimumScaleFactor(0.72),
                ]}
              >
                {displayTitle}
              </ExpoText>
            ) : undefined}
          </ExpoButton>
        </ExpoHost>
      </View>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
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
      {children ? children : <EmojiText style={{ color: textColor, fontSize, fontWeight: "700" }}>{displayTitle}</EmojiText>}
    </Pressable>
  );
  },
);

UiButton.displayName = "UiButton";
