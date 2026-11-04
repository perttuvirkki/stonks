import React, { memo, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { UiButton } from "./UiButton";
import { EmojiText } from "./Twemoji";
import { TERMINAL_FONT, getTerminalPalette, type TerminalPalette } from "../theme/terminal";

// Square ON/OFF readout in place of a native switch; the whole row is the tap target.
const TerminalToggle = ({ value, palette }: { value: boolean; palette: TerminalPalette }) => (
  <View
    style={[
      styles.toggle,
      { borderColor: value ? palette.green : palette.borderStrong, backgroundColor: value ? palette.green : "transparent" },
    ]}
  >
    <Text style={[styles.toggleText, { color: value ? "#000000" : palette.textDim }]}>{value ? "ON" : "OFF"}</Text>
  </View>
);

export type PatternLike = { id: string; label: string };

export type PatternSettingsModalProps = {
  visible: boolean;
  darkMode: boolean;
  patterns: PatternLike[];
  enabledPatternIds: string[];
  togglePattern: (patternId: string) => void;
  showPatternLines: boolean;
  onTogglePatternLines: () => void;
  onClose: () => void;
};

export const PatternSettingsModal = memo(({ visible, darkMode, patterns, enabledPatternIds, togglePattern, showPatternLines, onTogglePatternLines, onClose }: PatternSettingsModalProps) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const translateY = useSharedValue(windowHeight);
  const [rendered, setRendered] = useState(visible);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (visible) {
      setRendered(true);
      translateY.value = windowHeight;
      translateY.value = withTiming(0, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    translateY.value = withTiming(windowHeight, {
      duration: 260,
      easing: Easing.in(Easing.cubic),
    });

    hideTimeoutRef.current = setTimeout(() => {
      setRendered(false);
    }, 270);

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [translateY, visible, windowHeight]);

  if (!rendered) {
    return null;
  }

  const enabledCount = enabledPatternIds.length;
  const totalCount = patterns.length;

  const enableAll = () => {
    patterns.forEach((pattern) => {
      if (!enabledPatternIds.includes(pattern.id)) {
        togglePattern(pattern.id);
      }
    });
  };

  const disableAll = () => {
    patterns.forEach((pattern) => {
      if (enabledPatternIds.includes(pattern.id)) {
        togglePattern(pattern.id);
      }
    });
  };

  const bottomPad = Math.max(16, insets.bottom + 12);
  const topPad = Math.max(16, insets.top + 8);

  const palette = getTerminalPalette(darkMode);
  const background = palette.bg;
  const textPrimary = palette.text;
  const textSecondary = palette.textDim;
  const borderColor = palette.border;
  const activeColor = palette.amber;
  const rowBg = palette.panel;

  return (
    <Animated.View style={[styles.overlay, animatedStyle, { backgroundColor: background }]}>
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: borderColor }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: palette.amber }]}>Patterns</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>
            {enabledCount} of {totalCount} enabled
          </Text>
        </View>
        <View style={styles.headerRight}>
          <UiButton
            title="All"
            onPress={enableAll}
            variant="bordered"
            color={activeColor}
            controlSize="small"
            style={styles.headerButton}
            darkMode={darkMode}
          />
          <UiButton
            title="None"
            onPress={disableAll}
            variant="bordered"
            color={textSecondary}
            controlSize="small"
            style={styles.headerButton}
            darkMode={darkMode}
          />
        </View>
      </View>

      {/* Training Wheels Toggle */}
      <Pressable
        style={[styles.trainingWheelsRow, { backgroundColor: rowBg, borderColor }]}
        onPress={onTogglePatternLines}
      >
        <View style={styles.trainingWheelsLeft}>
          <EmojiText style={[styles.trainingWheelsLabel, { color: textPrimary }]}>Training Wheels 🛞</EmojiText>
          <Text style={[styles.trainingWheelsDesc, { color: textSecondary }]}>Show pattern lines on chart</Text>
        </View>
        <TerminalToggle value={showPatternLines} palette={palette} />
      </Pressable>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {patterns.map((pattern) => {
          const isEnabled = enabledPatternIds.includes(pattern.id);
          return (
            <Pressable
              key={pattern.id}
              style={[styles.patternRow, { backgroundColor: rowBg, borderColor }]}
              onPress={() => togglePattern(pattern.id)}
            >
              <Text style={[styles.patternLabel, { color: textPrimary }]}>{pattern.label}</Text>
              <TerminalToggle value={isEnabled} palette={palette} />
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomPad, borderTopColor: borderColor }]}>
        <UiButton title="Done" onPress={onClose} variant="borderedProminent" color={activeColor} controlSize="large" darkMode={darkMode} />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    gap: 8,
  },
  headerButton: {
    marginLeft: 4,
  },
  title: {
    fontFamily: TERMINAL_FONT,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  subtitle: {
    fontFamily: TERMINAL_FONT,
    fontSize: 12,
    marginTop: 4,
  },
  toggle: {
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: "center",
  },
  toggleText: {
    fontFamily: TERMINAL_FONT,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 0,
    alignItems: "center",
  },
  patternRow: {
    width: "100%",
    maxWidth: 720,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  patternLabel: {
    fontFamily: TERMINAL_FONT,
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  trainingWheelsRow: {
    width: "90%",
    maxWidth: 720,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 0,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 2,
    borderWidth: 1,
  },
  trainingWheelsLeft: {
    flex: 1,
  },
  trainingWheelsLabel: {
    fontFamily: TERMINAL_FONT,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  trainingWheelsDesc: {
    fontFamily: TERMINAL_FONT,
    fontSize: 12,
    marginTop: 2,
  },
});
