import React, { memo, useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { UiButton } from "./UiButton";

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
  const windowHeight = Dimensions.get("window").height;
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

  const background = darkMode ? "#0d0f12" : "#ffffff";
  const textPrimary = darkMode ? "#f5f5f5" : "#111111";
  const textSecondary = darkMode ? "#b8bec6" : "#666666";
  const borderColor = darkMode ? "#1f2329" : "#eeeeee";
  const activeColor = "#1a9f7a";
  const rowBg = darkMode ? "#15181d" : "#f8f8f8";

  return (
    <Animated.View style={[styles.overlay, animatedStyle, { backgroundColor: background }]}>
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: borderColor }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: textPrimary }]}>Patterns</Text>
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
          <Text style={[styles.trainingWheelsLabel, { color: textPrimary }]}>Training Wheels 🛞</Text>
          <Text style={[styles.trainingWheelsDesc, { color: textSecondary }]}>Show pattern lines on chart</Text>
        </View>
        <View style={[styles.toggle, showPatternLines && { backgroundColor: activeColor, borderColor: activeColor }]}>
          {showPatternLines && <Text style={styles.checkmark}>✓</Text>}
        </View>
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
              <View style={[styles.toggle, isEnabled && { backgroundColor: activeColor, borderColor: activeColor }]}>
                {isEnabled && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomPad, borderTopColor: borderColor }]}>
        <UiButton title="Done" onPress={onClose} variant="borderedProminent" color={activeColor} controlSize="large" />
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
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  patternRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  patternLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  toggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#aaa",
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  trainingWheelsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  trainingWheelsLeft: {
    flex: 1,
  },
  trainingWheelsLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  trainingWheelsDesc: {
    fontSize: 13,
    marginTop: 2,
  },
});
