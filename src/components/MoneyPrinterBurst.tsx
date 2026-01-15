import { memo, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import TwemojiPrinter from "../../assets/twemoji/1f5a8.svg";
import TwemojiBanknote from "../../assets/twemoji/1f4b5.svg";

type CashSpec = {
  id: string;
  startY: number;
  size: number;
  delayMs: number;
  durationMs: number;
  rotateDeg: number;
  jitterY: number;
};

type MoneyPrinterBurstProps = {
  trigger: number;
  darkMode: boolean;
  width: number;
  height: number;
};

const CashParticle = memo(function CashParticle({
  trigger,
  spec,
  width,
  height,
}: {
  trigger: number;
  spec: CashSpec;
  width: number;
  height: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!trigger) return;
    progress.value = 0;
    progress.value = withDelay(
      spec.delayMs,
      withTiming(1, {
        duration: spec.durationMs,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [trigger, progress, spec.delayMs, spec.durationMs]);

  const style = useAnimatedStyle(() => {
    // Start from left edge (printer output) and fly to the right
    const startX = 60;
    const endX = width + spec.size;
    const x = startX + (endX - startX) * progress.value;

    // Add vertical sway
    const y = spec.jitterY * interpolate(progress.value, [0, 0.5, 1], [0, 1, 0.5], "clamp");

    const opacityIn = interpolate(progress.value, [0, 0.08], [0, 1], "clamp");
    const opacityOut = interpolate(progress.value, [0.7, 1], [1, 0], "clamp");

    return {
      opacity: Math.min(opacityIn, opacityOut),
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${spec.rotateDeg + progress.value * 15}deg` },
        { scale: interpolate(progress.value, [0, 0.2], [0.6, 1], "clamp") },
      ],
    };
  }, [height, spec.jitterY, spec.rotateDeg, spec.size, width]);

  return (
    <Animated.View style={[styles.cash, { top: spec.startY }, style]} pointerEvents="none">
      <TwemojiBanknote width={spec.size} height={spec.size} />
    </Animated.View>
  );
});

export const MoneyPrinterBurst = memo(function MoneyPrinterBurst({ trigger, darkMode, width, height }: MoneyPrinterBurstProps) {
  const [visible, setVisible] = useState(false);
  const printerScale = useSharedValue(0);

  useEffect(() => {
    if (!trigger) return;
    printerScale.value = 0;
    printerScale.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.back(2)),
    });
  }, [trigger, printerScale]);

  const printerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: printerScale.value }],
    opacity: printerScale.value,
  }));

  const cashNotes = useMemo<CashSpec[]>(() => {
    if (!trigger || width <= 0 || height <= 0) return [];
    const count = 10;
    const cadenceMs = 80;

    return Array.from({ length: count }, (_, noteIndex) => {
      const size = 42 + Math.round(Math.random() * 30);
      
      // Spread spawn points vertically around the printer output (centered)
      const centerY = height / 2;
      const spreadY = height * 0.5;
      const startY = centerY - size / 2 + (Math.random() - 0.5) * spreadY;

      const delayMs = noteIndex * cadenceMs + Math.round((Math.random() - 0.5) * 30);
      const durationMs = 600 + Math.round(Math.random() * 300);
      const rotateDeg = (Math.random() - 0.5) * 30;
      const jitterY = (Math.random() - 0.5) * 40;
      
      return {
        id: `${trigger}-${noteIndex}`,
        startY,
        size,
        delayMs,
        durationMs,
        rotateDeg,
        jitterY,
      };
    });
  }, [height, trigger, width]);

  useEffect(() => {
    if (!trigger) return;
    setVisible(true);
    const maxDelay = cashNotes.reduce((max, note) => Math.max(max, note.delayMs + note.durationMs), 0);
    const timeout = setTimeout(() => setVisible(false), Math.max(1200, maxDelay + 200));
    return () => clearTimeout(timeout);
  }, [trigger, cashNotes]);

  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.container}>
      {/* Printer on the left */}
      <Animated.View style={[styles.printer, printerStyle]}>
        <TwemojiPrinter width={64} height={64} />
      </Animated.View>
      
      {/* Cash flying to the right */}
      {cashNotes.map((note) => (
        <CashParticle key={note.id} trigger={trigger} spec={note} width={width} height={height} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  printer: {
    position: "absolute",
    left: 8,
    top: "50%",
    marginTop: -32,
  },
  cash: {
    position: "absolute",
    left: 0,
  },
});
