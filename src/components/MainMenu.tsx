import { memo, useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import TwemojiRocket from "../../assets/twemoji/1f680.svg";
import TwemojiChartUp from "../../assets/twemoji/1f4c8.svg";
import TwemojiWheel from "../../assets/twemoji/1f6de.svg";
import TwemojiNewspaper from "../../assets/twemoji/1f4f0.svg";
import TwemojiGem from "../../assets/twemoji/1f48e.svg";
import TwemojiGear from "../../assets/twemoji/2699.svg";
import { AnimatedNumber } from "./AnimatedNumber";
import { PressableScale } from "./PressableScale";

export type MenuGameMode = "sprint60" | "fiveTrades" | "training";

export type MainMenuProps = {
  darkMode: boolean;
  stackBalance: number;
  bestScore: number | null;
  roundsPlayed: number;
  isPro: boolean;
  proPrice: string | null;
  canClaimDailyQuote: boolean;
  dailyBonus: number;
  formatMoney: (value: number) => string;
  onPlay: (mode: MenuGameMode) => void;
  onOpenDailyQuote: () => void;
  onOpenPro: () => void;
  onOpenSettings: () => void;
};

export const MENU_BACKGROUND = { light: "#f2f4f7", dark: "#0d0f12" } as const;

const SPARK_WIDTH = 132;
const SPARK_HEIGHT = 40;
// Hand-tuned "number go up" line: a dip, a pump, a shakeout, then moon.
const SPARK_PATH = "M2 30 L16 26 L26 32 L40 20 L52 24 L66 14 L78 19 L92 10 L104 13 L118 4 L130 2";
const SPARK_LENGTH = 150;

const AnimatedPath = Animated.createAnimatedComponent(Path);

const enter = (index: number) =>
  FadeInDown.delay(60 + index * 55)
    .springify()
    .damping(17)
    .stiffness(170);

/** Draws the header sparkline in, then keeps a soft glow pulse on the last point. */
const Sparkline = memo(({ color }: { color: string }) => {
  const draw = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    draw.value = withDelay(250, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    pulse.value = withDelay(1100, withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false));
  }, [draw, pulse]);

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: SPARK_LENGTH * (1 - draw.value),
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: draw.value >= 1 ? 1 : 0,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: draw.value >= 1 ? 0.5 * (1 - pulse.value) : 0,
    transform: [{ scale: 1 + pulse.value * 1.6 }],
  }));

  return (
    <View style={styles.sparkWrap}>
      <Svg width={SPARK_WIDTH} height={SPARK_HEIGHT}>
        <Defs>
          <LinearGradient id="sparkStroke" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity="0.35" />
            <Stop offset="1" stopColor={color} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <AnimatedPath
          d={SPARK_PATH}
          stroke="url(#sparkStroke)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={SPARK_LENGTH}
          animatedProps={lineProps}
        />
      </Svg>
      <Animated.View style={[styles.sparkRing, { backgroundColor: color }, ringStyle]} />
      <Animated.View style={[styles.sparkDot, { backgroundColor: color }, dotStyle]} />
    </View>
  );
});

Sparkline.displayName = "Sparkline";

/** Slow idle bob for the emoji on the cards, so the menu feels alive without being busy. */
const Floating = memo(({ children, delay = 0, distance = 6 }: { children: React.ReactNode; delay?: number; distance?: number }) => {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [delay, t]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -distance * t.value }, { rotate: `${-4 + t.value * 8}deg` }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
});

Floating.displayName = "Floating";

/** Pulsing "claim" badge for the daily bonus. */
const ClaimBadge = memo(({ label }: { label: string }) => {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), -1, false);
  }, [pulse]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  return (
    <Animated.View style={[styles.claimBadge, style]}>
      <Text style={styles.claimBadgeText}>{label}</Text>
    </Animated.View>
  );
});

ClaimBadge.displayName = "ClaimBadge";

export const MainMenu = memo(
  ({
    darkMode,
    stackBalance,
    bestScore,
    roundsPlayed,
    isPro,
    proPrice,
    canClaimDailyQuote,
    dailyBonus,
    formatMoney,
    onPlay,
    onOpenDailyQuote,
    onOpenPro,
    onOpenSettings,
  }: MainMenuProps) => {
    const textPrimary = darkMode ? "#f5f5f5" : "#0f1720";
    const textSecondary = darkMode ? "#9aa0a6" : "#5b6573";
    const surface = darkMode ? "#161a20" : "#ffffff";
    const border = darkMode ? "#232830" : "#e3e7ec";

    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(0)} style={styles.header}>
          <View>
            <View style={styles.wordmarkRow}>
              <Text style={[styles.wordmark, { color: textPrimary }]}>stonks</Text>
              {isPro && (
                <View style={styles.proTag}>
                  <Text style={styles.proTagText}>PRO</Text>
                </View>
              )}
            </View>
            <Sparkline color="#1a9f7a" />
          </View>
          <PressableScale
            onPress={onOpenSettings}
            pressedScale={0.88}
            hitSlop={8}
            accessibilityLabel="Settings"
            style={[styles.gearButton, { backgroundColor: surface, borderColor: border }]}
          >
            <TwemojiGear width={22} height={22} />
          </PressableScale>
        </Animated.View>

        <Animated.View entering={enter(1)} style={[styles.statsCard, { backgroundColor: surface, borderColor: border }]}>
          <View style={styles.statCell}>
            <Text style={[styles.statLabel, { color: textSecondary }]}>Stack</Text>
            <AnimatedNumber
              value={stackBalance}
              initialValue={0}
              delay={350}
              duration={900}
              format={(value) => `$${formatMoney(value)}`}
              style={[styles.statValue, { color: "#1a9f7a" }]}
            />
          </View>
          <View style={[styles.statDivider, { backgroundColor: border }]} />
          <View style={styles.statCell}>
            <Text style={[styles.statLabel, { color: textSecondary }]}>Best</Text>
            {bestScore != null ? (
              <AnimatedNumber
                value={bestScore}
                initialValue={0}
                delay={450}
                duration={900}
                format={(value) => `$${formatMoney(value)}`}
                style={[styles.statValue, { color: textPrimary }]}
              />
            ) : (
              <Text style={[styles.statValue, { color: textSecondary }]}>—</Text>
            )}
          </View>
          <View style={[styles.statDivider, { backgroundColor: border }]} />
          <View style={styles.statCell}>
            <Text style={[styles.statLabel, { color: textSecondary }]}>Rounds</Text>
            <AnimatedNumber
              value={roundsPlayed}
              initialValue={0}
              delay={550}
              duration={700}
              format={(value) => Math.round(value).toLocaleString("en-US")}
              style={[styles.statValue, { color: textPrimary }]}
            />
          </View>
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <PressableScale onPress={() => onPlay("sprint60")} pressedScale={0.97} style={[styles.heroShell, styles.shadow]}>
            <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={styles.heroText}>
              <Text style={styles.heroKicker}>QUICK PLAY</Text>
              <Text style={styles.heroTitle}>60 Second{"\n"}Sprint</Text>
              <Text style={styles.heroSubtitle}>Trade fast. Beat the clock.</Text>
              <View style={styles.playPill}>
                <Text style={styles.playPillText}>PLAY  ▶</Text>
              </View>
            </View>
            <View style={styles.heroEmoji}>
              <Floating distance={8}>
                <TwemojiRocket width={96} height={96} />
              </Floating>
            </View>
            </View>
          </PressableScale>
        </Animated.View>

        <Animated.View entering={enter(3)} style={styles.modeRow}>
          <PressableScale onPress={() => onPlay("fiveTrades")} style={[styles.modeCard, styles.shadow, { backgroundColor: "#f5a623" }]}>
            <Floating delay={300}>
              <TwemojiChartUp width={44} height={44} />
            </Floating>
            <Text style={styles.modeTitle}>5 Trades</Text>
            <Text style={styles.modeSubtitle}>Your pace. Five closes and done.</Text>
          </PressableScale>
          <PressableScale onPress={() => onPlay("training")} style={[styles.modeCard, styles.shadow, { backgroundColor: "#2e4057" }]}>
            <Floating delay={700}>
              <TwemojiWheel width={44} height={44} />
            </Floating>
            <Text style={styles.modeTitle}>Training</Text>
            <Text style={styles.modeSubtitle}>Learn the patterns, no risk.</Text>
          </PressableScale>
        </Animated.View>

        <Animated.View entering={enter(4)}>
          <PressableScale
            onPress={onOpenDailyQuote}
            style={[styles.rowCard, { backgroundColor: darkMode ? "#1c1915" : "#f5f0e1", borderColor: darkMode ? "#2d2820" : "#e6dcc3" }]}
          >
            <TwemojiNewspaper width={34} height={34} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: darkMode ? "#efe6d2" : "#2b2418" }]}>Daily Money</Text>
              <Text style={[styles.rowSubtitle, { color: darkMode ? "#a89e8a" : "#6f6550" }]}>
                {canClaimDailyQuote ? "Today's quote is in. Lock in your bonus." : "Locked in. Come back tomorrow."}
              </Text>
            </View>
            {canClaimDailyQuote ? (
              <ClaimBadge label={`+$${dailyBonus}`} />
            ) : (
              <Text style={[styles.rowChevron, { color: darkMode ? "#a89e8a" : "#6f6550" }]}>✓</Text>
            )}
          </PressableScale>
        </Animated.View>

        {!isPro && (
          <Animated.View entering={enter(5)}>
            <PressableScale onPress={onOpenPro} style={[styles.rowCard, styles.proCard]}>
              <Floating delay={500} distance={4}>
                <TwemojiGem width={30} height={30} />
              </Floating>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: "#ffffff" }]}>Go Pro</Text>
                <Text style={[styles.rowSubtitle, { color: "rgba(255,255,255,0.8)" }]}>
                  {proPrice ? `Bigger stack, all patterns · ${proPrice}` : "Bigger stack, all patterns"}
                </Text>
              </View>
              <Text style={[styles.rowChevron, { color: "#ffffff" }]}>›</Text>
            </PressableScale>
          </Animated.View>
        )}
      </ScrollView>
    );
  }
);

MainMenu.displayName = "MainMenu";

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  wordmarkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  wordmark: {
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -2,
  },
  proTag: {
    backgroundColor: "#7a2038",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 6,
  },
  proTagText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  sparkWrap: {
    width: SPARK_WIDTH,
    height: SPARK_HEIGHT,
    marginTop: -2,
  },
  sparkDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    left: 130 - 4,
    top: 2 - 4,
  },
  sparkRing: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    left: 130 - 4,
    top: 2 - 4,
  },
  gearButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    alignSelf: "stretch",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statValue: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  shadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
  },
  heroShell: {
    borderRadius: 24,
    backgroundColor: "#1a9f7a",
  },
  heroCard: {
    minHeight: 190,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    padding: 22,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    right: -60,
    top: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroText: {
    flex: 1,
  },
  heroKicker: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  heroTitle: {
    marginTop: 6,
    color: "#ffffff",
    fontSize: 32,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    marginTop: 6,
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "600",
  },
  playPill: {
    marginTop: 14,
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  playPillText: {
    color: "#14835f",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  heroEmoji: {
    marginLeft: 8,
  },
  modeRow: {
    flexDirection: "row",
    gap: 14,
  },
  modeCard: {
    flex: 1,
    minHeight: 150,
    borderRadius: 22,
    padding: 16,
    justifyContent: "space-between",
  },
  modeTitle: {
    marginTop: 12,
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  modeSubtitle: {
    marginTop: 4,
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    fontWeight: "600",
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  proCard: {
    backgroundColor: "#7a2038",
    borderColor: "#7a2038",
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "600",
  },
  rowChevron: {
    fontSize: 22,
    fontWeight: "700",
  },
  claimBadge: {
    backgroundColor: "#1a9f7a",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  claimBadgeText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
});
