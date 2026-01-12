import React from "react";
import { Animated, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type ProfitToastProps = {
  visible: boolean;
  darkMode: boolean;
  translateY: Animated.Value;
  title: string;
  subtitle: string;
  backgroundAccessory?: React.ReactNode;
  subtitleStyle?: unknown;
  styles: Record<string, any>;
};

export function ProfitToast({ visible, darkMode, translateY, title, subtitle, backgroundAccessory, subtitleStyle, styles }: ProfitToastProps) {
  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.topSafeArea}>
      <Animated.View style={[styles.profitToast, darkMode && styles.profitToastDark, { transform: [{ translateY }] }]}>
        {backgroundAccessory}
        <SafeAreaView edges={["top"]} style={styles.profitToastContent}>
          <Text style={[styles.profitToastKicker, darkMode && styles.profitToastKickerDark]}>{title}</Text>
          <Text style={[styles.profitToastBigValue, subtitleStyle]}>{subtitle}</Text>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}
