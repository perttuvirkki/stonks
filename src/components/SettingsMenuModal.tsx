import { memo, useEffect, useRef, useState } from "react";
import { BackHandler, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { UiButton } from "./UiButton";

export type SettingsMenuOption = {
  id: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export type SettingsMenuModalProps = {
  visible: boolean;
  darkMode: boolean;
  title?: string;
  options: SettingsMenuOption[];
  onClose: () => void;
};

export const SettingsMenuModal = memo(({ visible, darkMode, title, options, onClose }: SettingsMenuModalProps) => {
  const insets = useSafeAreaInsets();
  const windowHeight = Dimensions.get("window").height;
  const translateY = useSharedValue(windowHeight);
  const [rendered, setRendered] = useState(visible);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (!visible) return;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose, visible]);

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

  const bottomPad = Math.max(16, insets.bottom + 12);
  const topPad = Math.max(16, insets.top + 8);

  const background = darkMode ? "#0d0f12" : "#ffffff";
  const textPrimary = darkMode ? "#f5f5f5" : "#111111";
  const textSecondary = darkMode ? "#b8bec6" : "#666666";
  const borderColor = darkMode ? "#1f2329" : "#eeeeee";
  const rowBg = darkMode ? "#15181d" : "#f8f8f8";

  return (
    <Animated.View style={[styles.overlay, animatedStyle, { backgroundColor: background }]}>
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: borderColor }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: textPrimary }]}>{title ?? "Settings"}</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>Choose an option</Text>
        </View>
        <UiButton title="Done" onPress={onClose} variant="plain" color={textSecondary} controlSize="large" />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {options.map((opt) => (
          <Pressable
            key={opt.id}
            onPress={() => opt.onPress()}
            disabled={opt.disabled}
            style={({ pressed }) => [
              styles.optionRow,
              { backgroundColor: rowBg, borderColor, opacity: opt.disabled ? 0.5 : pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.optionLabel, { color: textPrimary }]}>{opt.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomPad, borderTopColor: borderColor }]}>
        <UiButton title="Cancel" onPress={onClose} variant="bordered" color={textSecondary} controlSize="large" />
      </View>
    </Animated.View>
  );
});

SettingsMenuModal.displayName = "SettingsMenuModal";

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 70,
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
    paddingRight: 10,
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
    gap: 10,
  },
  optionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
});

