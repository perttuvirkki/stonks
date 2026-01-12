import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { RocketBurst } from "./RocketBurst";

export type ProfitToastProps = {
  visible: boolean;
  darkMode: boolean;
  translateY: SharedValue<number>;
  title: string;
  subtitle: string;
  backgroundAccessory?: React.ReactNode;
  subtitleStyle?: unknown;
  styles: Record<string, any>;
  rocketBurstTrigger?: number;
};

export function ProfitToast({
  visible,
  darkMode,
  translateY,
  title,
  subtitle,
  backgroundAccessory,
  subtitleStyle,
  styles,
  rocketBurstTrigger,
}: ProfitToastProps) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.topSafeArea}>
      <Animated.View
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width !== layout.width || height !== layout.height) {
            setLayout({ width, height });
          }
        }}
        style={[styles.profitToast, darkMode && styles.profitToastDark, localStyles.toastClip, animatedStyle]}
      >
        {backgroundAccessory}

        {!!rocketBurstTrigger && layout.width > 0 && layout.height > 0 ? (
          <View pointerEvents="none" style={localStyles.rocketLayer}>
            <RocketBurst trigger={rocketBurstTrigger} darkMode={darkMode} width={layout.width} height={layout.height} />
          </View>
        ) : null}

        <SafeAreaView edges={["top"]} style={styles.profitToastContent}>
          <Text style={[styles.profitToastKicker, darkMode && styles.profitToastKickerDark]}>{title}</Text>
          <Text style={[styles.profitToastBigValue, subtitleStyle]}>{subtitle}</Text>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  toastClip: {
    overflow: "hidden",
    position: "relative",
  },
  rocketLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
});
