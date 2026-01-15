import { memo, useEffect, useMemo, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import TwemojiCoin from "../../assets/twemoji/1fa99.svg";
import TwemojiBanknote from "../../assets/twemoji/1f4b5.svg";
import TwemojiRocket from "../../assets/twemoji/1f680.svg";

type AnimationType = "coins" | "cash" | "rockets";

type AnimatedSplashProps = {
  onComplete: () => void;
  darkMode: boolean;
};

type Particle = {
  id: number;
  x: number;
  delay: number;
  size: number;
  rotation: number;
  speed: number;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PARTICLE_COUNT = 18;
const ANIMATION_DURATION = 2000;
const FADE_OUT_DURATION = 400;

const CoinParticle = memo(({ particle }: { particle: Particle }) => {
  const translateY = useSharedValue(-particle.size);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(
      particle.delay,
      withTiming(SCREEN_HEIGHT + particle.size, {
        duration: particle.speed,
        easing: Easing.in(Easing.quad),
      })
    );
    rotate.value = withDelay(
      particle.delay,
      withTiming(particle.rotation * 360, {
        duration: particle.speed,
        easing: Easing.linear,
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: particle.x }, { translateY: translateY.value }, { rotate: `${rotate.value}deg` }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.particle, animatedStyle]}>
      <TwemojiCoin width={particle.size} height={particle.size} />
    </Animated.View>
  );
});

const CashParticle = memo(({ particle }: { particle: Particle }) => {
  const translateY = useSharedValue(-particle.size);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(particle.rotation * 30 - 15);

  useEffect(() => {
    translateY.value = withDelay(
      particle.delay,
      withTiming(SCREEN_HEIGHT + particle.size, {
        duration: particle.speed,
        easing: Easing.in(Easing.quad),
      })
    );
    // Gentle sway side to side
    translateX.value = withDelay(
      particle.delay,
      withSequence(
        withTiming(20, { duration: particle.speed / 4, easing: Easing.inOut(Easing.sin) }),
        withTiming(-20, { duration: particle.speed / 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: particle.speed / 4, easing: Easing.inOut(Easing.sin) })
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: particle.x + translateX.value }, { translateY: translateY.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.particle, animatedStyle]}>
      <TwemojiBanknote width={particle.size} height={particle.size} />
    </Animated.View>
  );
});

const RocketParticle = memo(({ particle }: { particle: Particle }) => {
  const translateY = useSharedValue(SCREEN_HEIGHT + particle.size);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    translateY.value = withDelay(
      particle.delay,
      withTiming(-particle.size * 2, {
        duration: particle.speed,
        easing: Easing.out(Easing.cubic),
      })
    );
    scale.value = withDelay(
      particle.delay,
      withTiming(1, {
        duration: particle.speed / 2,
        easing: Easing.out(Easing.back(2)),
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: particle.x }, { translateY: translateY.value }, { scale: scale.value }, { rotate: "-45deg" }],
  }));

  return (
    <Animated.View style={[styles.particle, animatedStyle]}>
      <TwemojiRocket width={particle.size} height={particle.size} />
    </Animated.View>
  );
});

export const AnimatedSplash = memo(({ onComplete, darkMode }: AnimatedSplashProps) => {
  const [visible, setVisible] = useState(true);
  const containerOpacity = useSharedValue(1);

  const animationType = useMemo<AnimationType>(() => {
    const types: AnimationType[] = ["coins", "cash", "rockets"];
    return types[Math.floor(Math.random() * types.length)];
  }, []);

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * (SCREEN_WIDTH - 60),
      delay: Math.random() * 600,
      size: 40 + Math.random() * 30,
      rotation: Math.random() * 3 + 1,
      speed: ANIMATION_DURATION + Math.random() * 800,
    }));
  }, []);

  useEffect(() => {
    const fadeOutStart = ANIMATION_DURATION + 200;

    // Haptic pulses to build excitement
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const hapticIntervals = [200, 400, 600, 900, 1200, 1600];
    const hapticTimeouts = hapticIntervals.map((delay) =>
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, delay)
    );
    // Medium pulse as finale
    const finaleTimeout = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, fadeOutStart - 100);

    const timeout = setTimeout(() => {
      containerOpacity.value = withTiming(0, { duration: FADE_OUT_DURATION }, (finished) => {
        if (finished) {
          runOnJS(setVisible)(false);
          runOnJS(onComplete)();
        }
      });
    }, fadeOutStart);

    return () => {
      clearTimeout(timeout);
      clearTimeout(finaleTimeout);
      hapticTimeouts.forEach(clearTimeout);
    };
  }, [containerOpacity, onComplete]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  if (!visible) {
    return null;
  }

  return (
    <Animated.View pointerEvents="none" style={[styles.container, containerStyle, { backgroundColor: darkMode ? "#0d0f12" : "#ffffff" }]}>
      {animationType === "coins" && particles.map((p) => <CoinParticle key={p.id} particle={p} />)}
      {animationType === "cash" && particles.map((p) => <CashParticle key={p.id} particle={p} />)}
      {animationType === "rockets" && particles.map((p) => <RocketParticle key={p.id} particle={p} />)}
    </Animated.View>
  );
});

AnimatedSplash.displayName = "AnimatedSplash";

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ffffff",
    zIndex: 100,
  },
  particle: {
    position: "absolute",
  },
});
