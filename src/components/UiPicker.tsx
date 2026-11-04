import { memo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
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

// Terminal-style segmented control: square cells split by hairlines, the
// selected cell filled with the accent colour.
export const UiPicker = memo(({ options, selectedIndex, onSelect, variant = "segmented", color, style, darkMode }: UiPickerProps) => {
  if (variant !== "segmented") {
    return null;
  }

  const palette = getTerminalPalette(darkMode);
  const accent = color ?? palette.amber;

  return (
    <View style={[styles.row, { borderColor: palette.borderStrong, backgroundColor: palette.panel }, style]}>
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <Pressable
            key={`${option}-${index}`}
            onPress={() => {
              void Haptics.selectionAsync();
              onSelect(index);
            }}
            style={({ pressed }) => [
              styles.cell,
              index > 0 && { borderLeftWidth: 1, borderLeftColor: palette.border },
              { backgroundColor: selected ? accent : pressed ? palette.panelAlt : "transparent" },
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
