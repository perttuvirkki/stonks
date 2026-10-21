import { memo, useEffect, useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, type SharedValue, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

const COLORS = ["#1a9f7a", "#8fe3c7", "#f5a524", "#ffd166", "#ffffff", "#2f80ed"];
const GRAVITY = 760;
const DRAG = 1.2;

type Piece = {
  vx: number;
  vy: number;
  spin: number;
  wobble: number;
  width: number;
  height: number;
  color: string;
  round: boolean;
};

export type ConfettiBurstProps = {
  /** Change to fire a new burst; 0 renders nothing. */
  trigger: number;
  /** Number of pieces. Kept modest so it stays cheap on older phones. */
  count?: number;
  /** Burst origin as a fraction of the screen. */
  originX?: number;
  originY?: number;
  /** Seconds of simulated flight. */
  duration?: number;
  delay?: number;
};

const ConfettiPiece = memo(({ piece, progress, originX, originY, duration }: { piece: Piece; progress: SharedValue<number>; originX: number; originY: number; duration: number }) => {
  const style = useAnimatedStyle(() => {
    const t = progress.value * duration;
    // Ballistic flight with air drag so pieces flutter instead of dropping like stones.
    const travel = (1 - Math.exp(-DRAG * t)) / DRAG;
    const x = originX + piece.vx * travel + Math.sin(t * piece.wobble) * 10;
    const y = originY + piece.vy * travel + 0.5 * GRAVITY * t * t;
    const fade = progress.value > 0.75 ? 1 - (progress.value - 0.75) / 0.25 : 1;
    return {
      opacity: progress.value <= 0 ? 0 : fade,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${piece.spin * t}deg` }, { rotateX: `${t * piece.wobble * 60}deg` }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        { width: piece.width, height: piece.height, backgroundColor: piece.color, borderRadius: piece.round ? piece.width / 2 : 2 },
        style,
      ]}
    />
  );
});

ConfettiPiece.displayName = "ConfettiPiece";

/** Full-screen, touch-transparent confetti pop for wins. */
export const ConfettiBurst = memo(({ trigger, count = 36, originX = 0.5, originY = 0.3, duration = 2.2, delay = 0 }: ConfettiBurstProps) => {
  const { width, height } = useWindowDimensions();
  const progress = useSharedValue(0);

  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: count }, (_, index) => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95;
        const speed = 380 + Math.random() * 520;
        const size = 6 + Math.random() * 6;
        return {
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          spin: (Math.random() - 0.5) * 720,
          wobble: 3 + Math.random() * 5,
          width: size,
          height: index % 3 === 0 ? size : size * 1.8,
          color: COLORS[index % COLORS.length],
          round: index % 5 === 0,
        };
      }),
    // A fresh spray per trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, trigger]
  );

  useEffect(() => {
    if (!trigger) {
      return;
    }
    progress.value = 0;
    progress.value = withDelay(delay, withTiming(1, { duration: duration * 1000, easing: Easing.linear }));
  }, [delay, duration, progress, trigger]);

  if (!trigger) {
    return null;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, index) => (
        <ConfettiPiece key={`${trigger}-${index}`} piece={piece} progress={progress} originX={width * originX} originY={height * originY} duration={duration} />
      ))}
    </View>
  );
});

ConfettiBurst.displayName = "ConfettiBurst";

const styles = StyleSheet.create({
  piece: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
