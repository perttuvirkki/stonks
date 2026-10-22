import { memo, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import TwemojiRocket from "../../assets/twemoji/1f680.svg";

type RocketSpec = {
  id: string;
  startX: number;
  size: number;
  delayMs: number;
  durationMs: number;
  rotateDeg: number;
  jitterX: number;
};

type RocketBurstProps = {
  trigger: number;
  darkMode: boolean;
  width: number;
  height: number;
};

const RocketParticle = memo(function RocketParticle({
  trigger,
  spec,
  width,
  height,
}: {
  trigger: number;
  spec: RocketSpec;
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
    // Animate within the parent container (toast). Start below the bottom edge and fly out above.
    const startY = height + 60;
    const endY = -spec.size - 40;
    const y = startY + (endY - startY) * progress.value;

    // Straight-up flight with a tiny horizontal sway.
    const x = spec.jitterX * interpolate(progress.value, [0, 0.5, 1], [0, 1, 0], "clamp");

    const opacityIn = interpolate(progress.value, [0, 0.08], [0, 1], "clamp");
    const opacityOut = interpolate(progress.value, [0.75, 1], [1, 0], "clamp");

    return {
      opacity: Math.min(opacityIn, opacityOut),
      transform: [
        { translateY: y },
        { translateX: x },
        { rotate: `${spec.rotateDeg}deg` },
        { scale: interpolate(progress.value, [0, 0.25], [0.9, 1], "clamp") },
      ],
    };
  }, [height, spec.jitterX, spec.rotateDeg, spec.size, spec.startX, width]);

  return (
    <Animated.View style={[styles.rocket, { left: spec.startX, top: 0 }, style]} pointerEvents="none">
      <TwemojiRocket width={spec.size} height={spec.size} />
    </Animated.View>
  );
});

export const RocketBurst = memo(function RocketBurst({ trigger, darkMode, width, height }: RocketBurstProps) {
  const [visible, setVisible] = useState(false);

  const rockets = useMemo<RocketSpec[]>(() => {
    if (!trigger || width <= 0 || height <= 0) return [];
    const count = 8;
    const cadenceMs = 100;

    // Spread spawn points over the whole width, but pick them in random order.
    const cells = Array.from({ length: count }, (_, index) => index);
    for (let index = cells.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const tmp = cells[index];
      cells[index] = cells[swapIndex];
      cells[swapIndex] = tmp;
    }

    const cellWidth = width / count;

    return Array.from({ length: count }, (_, rocketIndex) => {
      const size = 54 + Math.round(Math.random() * 34);
      const cellIndex = cells[rocketIndex] ?? rocketIndex;

      // Random-ish X within a cell to avoid clumping, while still covering full width.
      const baseX = (cellIndex + Math.random()) * cellWidth - size * 0.5;
      const startX = Math.round(Math.max(-size * 0.6, Math.min(width - size * 0.4, baseX)));

      // One launch roughly every 100ms.
      const delayMs = rocketIndex * cadenceMs + Math.round((Math.random() - 0.5) * 28);
      const durationMs = 780 + Math.round(Math.random() * 420);
      // Vertical launch: point mostly up.
      const rotateDeg = -45;
      const jitterX = (Math.random() - 0.5) * 22;
      return {
        id: `${trigger}-${rocketIndex}`,
        startX,
        size,
        delayMs,
        durationMs,
        rotateDeg,
        jitterX,
      };
    });
  }, [height, trigger, width]);

  useEffect(() => {
    if (!trigger) return;
    setVisible(true);
    const maxDelay = rockets.reduce((max, rocket) => Math.max(max, rocket.delayMs + rocket.durationMs), 0);
    const timeout = setTimeout(() => setVisible(false), Math.max(900, maxDelay + 120));
    return () => clearTimeout(timeout);
  }, [trigger, rockets]);

  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.container}>
      {rockets.map((rocket) => (
        <RocketParticle key={rocket.id} trigger={trigger} spec={rocket} width={width} height={height} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  rocket: {
    position: "absolute",
  },
});
