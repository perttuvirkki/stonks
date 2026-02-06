import { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Dimensions, Image, Platform, Share, StyleSheet, Text, TextInput, View, Alert, Modal, TouchableOpacity, TouchableWithoutFeedback, Keyboard } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import ViewShot from "react-native-view-shot";
import TwemojiRocket from "../../assets/twemoji/1f680.svg";
import TwemojiCoin from "../../assets/twemoji/1fa99.svg";
import TwemojiBanknote from "../../assets/twemoji/1f4b5.svg";
import TwemojiFreezingFace from "../../assets/twemoji/1f976.svg";
import TwemojiHotFace from "../../assets/twemoji/1f975.svg";
import TwemojiSkull from "../../assets/twemoji/1f480.svg";
import { UiButton } from "./UiButton";

export type RoundStats = {
  tradesMade: number;
  tradesWon: number;
  tradesLost: number;
  biggestWinPercent: number;
  biggestLossPercent: number;
  longestTrade: number;
  closestToLiquidation: number; // percentage distance to liquidation (0 = liquidated, 100+ = safe)
};

export type RoundResult = {
  startNetWorth: number;
  endNetWorth: number;
  profit: number;
  percent: number;
  durationMs: number;
  stats: RoundStats;
};

export type RoundResultsSheetProps = {
  visible: boolean;
  darkMode: boolean;
  result: RoundResult | null;
  onNextRound: () => void;
  onShowLeaderboard?: () => void;
};

export const RoundResultsSheet = memo(({ visible, darkMode, result, onNextRound, onShowLeaderboard }: RoundResultsSheetProps) => {
  const insets = useSafeAreaInsets();
  const windowHeight = Dimensions.get("window").height;

  const translateY = useSharedValue(windowHeight);

  const [rendered, setRendered] = useState(visible);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewShotRef = useRef<ViewShot>(null);

  const handleShare = useCallback(async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri) {
        await Share.share({
          url: uri,
          title: "Bank Sprint Results",
        });
      }
    } catch (error) {
      console.warn("Share failed:", error);
    }
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const palette = useMemo(
    () => ({
      background: darkMode ? "#0d0f12" : "#ffffff",
      textPrimary: darkMode ? "#f5f5f5" : "#111111",
      textSecondary: darkMode ? "#b8bec6" : "#666666",
      divider: darkMode ? "#1f2329" : "#eeeeee",
      kicker: "#1a9f7a",
      danger: "#d94b4b",
      button: "#1a9f7a",
      profit: "#1a9f7a",
    }),
    [darkMode]
  );

  useEffect(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (visible) {
      setRendered(true);
      translateY.value = windowHeight;
      translateY.value = withTiming(0, { duration: 1400, easing: Easing.out(Easing.cubic) });
      return;
    }

    translateY.value = withTiming(windowHeight, { duration: 260, easing: Easing.in(Easing.cubic) });

    hideTimeoutRef.current = setTimeout(() => {
      setRendered(false);
    }, 240);

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [translateY, visible, windowHeight]);

  const safeResult: RoundResult =
    result ??
    ({
      startNetWorth: 0,
      endNetWorth: 0,
      profit: 0,
      percent: 0,
      durationMs: 0,
      stats: {
        tradesMade: 0,
        tradesWon: 0,
        tradesLost: 0,
        biggestWinPercent: 0,
        biggestLossPercent: 0,
        longestTrade: 0,
        closestToLiquidation: 100,
      },
    } satisfies RoundResult);

  // Use actual result for visuals
  const testPercent = safeResult.percent;
  const [screenshotTag, setScreenshotTag] = useState<string | null>(null);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [tagInputValue, setTagInputValue] = useState("");

  const handleAddTag = () => {
    setTagInputValue(screenshotTag ?? "");
    setTagModalVisible(true);
  };

  const handleTagSubmit = () => {
    setScreenshotTag(tagInputValue.trim() || null);
    setTagModalVisible(false);
  };

  const handleTagCancel = () => {
    setTagModalVisible(false);
  };

  const isMassiveWin = testPercent >= 5000;
  const isBigWin = testPercent >= 2500;
  const isWin = safeResult.profit > 0; // Keep profit check on real result for now, or maybe should rely on percent?
  const isLoss = safeResult.profit < 0;
  const isWipe = testPercent <= -50;

  // Title/subtitle combos based on performance with emoji flair
  const bigWinTitles = [
    { title: "To the moon! 🚀", subtitle: "Tendies acquired. 🍗 Legendary run." },
    { title: "Diamond hands 💎🙌", subtitle: "You held the line. Absolute legend." },
    { title: "Printer goes BRRR 🖨️", subtitle: "Money machine activated." },
    { title: "Apes together strong 🦍", subtitle: "The hive mind wins again." },
    { title: "YOLO paid off 🎰", subtitle: "Risk it for the biscuit. Worth it." },
    { title: "Whale alert 🐋", subtitle: "Big money moves. Massive gains." },
  ];

  const winTitles = [
    { title: "Nice. You printed. 💵", subtitle: "Tendies secured. Clean exit." },
    { title: "Diamond hands 💎", subtitle: "Paper hands could never." },
    { title: "Bought low, sold high 📈", subtitle: "Wait, you're actually good at this?" },
    { title: "Green candles only 🟢", subtitle: "Bulls run free today." },
    { title: "That was clean ✨", subtitle: "No hesitation. Respect." },
    { title: "We like the stock 🚀", subtitle: "And it liked you back." },
    { title: "DD paid off 📚", subtitle: "Due diligence for the win." },
  ];

  const wipeTitles = [
    { title: "GUH. 💀", subtitle: "That one's gonna leave a mark." },
    { title: "Buy high, sell low 📉", subtitle: "A classic strategy. Bold." },
    { title: "Portfolio evaporated 💨", subtitle: "At least you still have your health." },
    { title: "Margin called 📞", subtitle: "Your broker sends their regards." },
    { title: "Rekt 💥", subtitle: "Leverage hits different when it's against you." },
  ];

  const lossTitles = [
    { title: "Paper hands 🧻", subtitle: "Shake it off. Next one's yours." },
    { title: "Red day 🔴", subtitle: "Markets humbled you. It happens." },
    { title: "Not your candle 🕯️", subtitle: "The chart had other plans." },
    { title: "Bought the dip... 📉", subtitle: "It dipped more. Classic." },
    { title: "Bag holder 🛍️", subtitle: "Hold the line next time." },
  ];

  const flatTitles = [
    { title: "Flat. Respect. 😐", subtitle: "Theta wins again." },
    { title: "Sideways 🦘", subtitle: "Kangaroo market energy." },
    { title: "Dead flat ➖", subtitle: "Neither bull nor bear. Just vibes." },
  ];

  // Select title based on actual result - must be before early return
  const { title: titleText, subtitle: subtitleText } = useMemo(() => {
    if (isBigWin) {
      return bigWinTitles[Math.floor(Math.random() * bigWinTitles.length)];
    }
    if (isWin) {
      return winTitles[Math.floor(Math.random() * winTitles.length)];
    }
    if (isWipe) {
      return wipeTitles[Math.floor(Math.random() * wipeTitles.length)];
    }
    if (isLoss) {
      return lossTitles[Math.floor(Math.random() * lossTitles.length)];
    }
    return flatTitles[Math.floor(Math.random() * flatTitles.length)];
  }, [isBigWin, isWin, isWipe, isLoss]);

  if (!rendered) {
    return null;
  }

  const Emoji = () => {
    if (isBigWin) {
      return <TwemojiRocket width={150} height={150} />;
    }
    if (isWin) {
      if (testPercent < 100) {
        return <TwemojiCoin width={150} height={150} />;
      }
      return <TwemojiBanknote width={150} height={150} />;
    }
    if (isWipe) {
      return <TwemojiSkull width={150} height={150} />;
    }
    if (isLoss) {
      return <TwemojiHotFace width={150} height={150} />;
    }
    return <TwemojiCoin width={150} height={150} />;
  };

  const formatMoney = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const formatSignedMoney = (value: number) => {
    const absValue = Math.abs(value);
    const prefix = value > 0 ? "$" : value < 0 ? "$" : "$";
    return `${prefix}${formatMoney(absValue)}`;
  };

  const bottomPad = Math.max(16, insets.bottom + 12);

  // Display colors based on actual result
  const profitPrefix = isWin ? "+" : isLoss ? "-" : "";
  const profitColor = isWin ? palette.profit : isLoss ? palette.danger : palette.textPrimary;
  const percentPrefix = isWin ? "+" : isLoss ? "" : "";

  const BackgroundAccessory = () => {
    const RichIcon = TwemojiBanknote;
    
    if (isMassiveWin) {
      return (
        <View pointerEvents="none" style={styles.backgroundAccessories}>
          <TwemojiRocket width={140} height={140} style={[styles.bgItem, styles.bgA]} />
          <TwemojiRocket width={130} height={130} style={[styles.bgItem, styles.bgB]} />
          <TwemojiBanknote width={120} height={120} style={[styles.bgItem, styles.bgC]} />
          <TwemojiBanknote width={110} height={110} style={[styles.bgItem, styles.bgD]} />
          <TwemojiCoin width={100} height={100} style={[styles.bgItem, styles.bgE]} />
          <TwemojiCoin width={90} height={90} style={[styles.bgItem, { top: "15%", left: "10%" }]} />
          <TwemojiCoin width={80} height={80} style={[styles.bgItem, { top: "15%", right: "10%" }]} />
        </View>
      );
    }

    if (isBigWin) {
      return (
        <View pointerEvents="none" style={styles.backgroundAccessories}>
          <TwemojiRocket width={120} height={120} style={[styles.bgItem, styles.bgA]} />
          <TwemojiRocket width={110} height={110} style={[styles.bgItem, styles.bgB]} />
          <TwemojiBanknote width={106} height={106} style={[styles.bgItem, styles.bgC]} />
          <TwemojiCoin width={98} height={98} style={[styles.bgItem, styles.bgD]} />
          <TwemojiCoin width={88} height={88} style={[styles.bgItem, styles.bgE]} />
        </View>
      );
    }

    if (isWin) {
      // For small wins (<100%), show coins only
      if (testPercent < 100) {
        return (
          <View pointerEvents="none" style={styles.backgroundAccessories}>
            <TwemojiCoin width={112} height={112} style={[styles.bgItem, styles.bgA]} />
            <TwemojiCoin width={104} height={104} style={[styles.bgItem, styles.bgB]} />
            <TwemojiCoin width={96} height={96} style={[styles.bgItem, styles.bgC]} />
            <TwemojiCoin width={88} height={88} style={[styles.bgItem, styles.bgD]} />
            <TwemojiCoin width={80} height={80} style={[styles.bgItem, styles.bgE]} />
          </View>
        );
      }

      // Scale richness: gradually replace Coins with Banknotes from 100% to 2500%
      // At 100%: 1 Banknote, 4 Coins
      // At 2500%: 5 Banknotes
      
      const IconA = testPercent >= 100 ? TwemojiBanknote : TwemojiCoin;
      const IconB = testPercent >= 600 ? TwemojiBanknote : TwemojiCoin;
      const IconC = testPercent >= 1200 ? TwemojiBanknote : TwemojiCoin;
      const IconD = testPercent >= 1800 ? TwemojiBanknote : TwemojiCoin;
      const IconE = testPercent >= 2400 ? TwemojiBanknote : TwemojiCoin;

      return (
        <View pointerEvents="none" style={styles.backgroundAccessories}>
          <IconA width={112} height={112} style={[styles.bgItem, styles.bgA]} />
          <IconB width={104} height={104} style={[styles.bgItem, styles.bgB]} />
          <IconC width={96} height={96} style={[styles.bgItem, styles.bgC]} />
          <IconD width={88} height={88} style={[styles.bgItem, styles.bgD]} />
          <IconE width={80} height={80} style={[styles.bgItem, styles.bgE]} />
        </View>
      );
    }

    if (isLoss) {
      return (
        <View pointerEvents="none" style={styles.backgroundAccessories}>
          <TwemojiSkull width={118} height={118} style={[styles.bgItem, styles.bgA]} />
          <TwemojiFreezingFace width={104} height={104} style={[styles.bgItem, styles.bgC]} />
          <TwemojiHotFace width={96} height={96} style={[styles.bgItem, styles.bgD]} />
          <TwemojiCoin width={88} height={88} style={[styles.bgItem, styles.bgE]} />
        </View>
      );
    }

    return (
      <View pointerEvents="none" style={styles.backgroundAccessories}>
        <TwemojiCoin width={112} height={112} style={[styles.bgItem, styles.bgA]} />
        <TwemojiCoin width={104} height={104} style={[styles.bgItem, styles.bgB]} />
        <TwemojiCoin width={96} height={96} style={[styles.bgItem, styles.bgC]} />
        <TwemojiCoin width={88} height={88} style={[styles.bgItem, styles.bgD]} />
      </View>
    );
  };

  return (
    <Animated.View pointerEvents={visible ? "auto" : "none"} style={[styles.container, { backgroundColor: palette.background }, overlayStyle]}>
      <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1 }} style={[styles.viewShot, { backgroundColor: palette.background }]}>
        <View style={[styles.topChrome, { borderBottomColor: palette.divider }]} />
        <BackgroundAccessory />
        <View style={[styles.content, { paddingTop: Math.max(28, insets.top + 18) }]}>
          {/* App branding for screenshot shares */}
          <View style={[styles.appBranding, { top: insets.top + 8 }]}>
            <Image 
              source={require("../../assets/AppIcon-ios-marketing.png")} 
              style={styles.appIcon} 
            />

          </View>
          <View style={styles.emojiWrap}>
            <Emoji />
          </View>
          <Text style={[styles.pnlValue, { color: profitColor }]}>
            {percentPrefix}
            {testPercent.toFixed(1)}%
          </Text>
          <Text style={[styles.title, { color: palette.textPrimary }]}>{titleText}</Text>
          <View style={{ alignItems: 'center', zIndex: 20 }}>
            <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{subtitleText}</Text>
            {screenshotTag && (
              <View 
                style={{ 
                  position: "absolute",
                  top: "100%",
                  marginTop: 10,
                  backgroundColor: palette.profit, 
                  paddingHorizontal: 16, 
                  paddingVertical: 8, 
                  borderRadius: 24,
                  borderWidth: 2,
                  borderColor: "#ffffff",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 5,
                  elevation: 6,
                  transform: [{ rotate: "-3deg" }]
                }}
              >
                <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "800", letterSpacing: -0.5 }}>
                  @{screenshotTag.replace(/^@/, '')}
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.statsContainer, { borderTopColor: palette.divider }]}>
            <View style={[styles.statRow, { borderBottomColor: palette.divider }]}>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Trades Won</Text>
              <Text style={[styles.statValue, { color: palette.profit }]}>{safeResult.stats.tradesWon}</Text>
            </View>
            <View style={[styles.statRow, { borderBottomColor: palette.divider }]}>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Trades Lost</Text>
              <Text style={[styles.statValue, { color: palette.danger }]}>{safeResult.stats.tradesLost}</Text>
            </View>
            <View style={[styles.statRow, { borderBottomColor: palette.divider }]}>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Best Trade</Text>
              <Text style={[styles.statValue, { color: palette.profit }]}>
                {safeResult.stats.biggestWinPercent > 0 ? `+${safeResult.stats.biggestWinPercent.toFixed(1)}%` : "—"}
              </Text>
            </View>
            <View style={[styles.statRow, { borderBottomColor: palette.divider }]}>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Worst Trade</Text>
              <Text style={[styles.statValue, { color: palette.danger }]}>
                {safeResult.stats.biggestLossPercent > 0 ? `-${safeResult.stats.biggestLossPercent.toFixed(1)}%` : "—"}
              </Text>
            </View>
            <View style={[styles.statRow, { borderBottomColor: palette.divider }]}>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Closest to Liquidation</Text>
              <Text style={[styles.statValue, { color: safeResult.stats.closestToLiquidation < 5 ? palette.danger : palette.textPrimary }]}>
                {safeResult.stats.closestToLiquidation < 100 ? `${safeResult.stats.closestToLiquidation.toFixed(1)}%` : "—"}
              </Text>
            </View>
            <View style={[styles.statRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Longest Trade</Text>
              <Text style={[styles.statValue, { color: palette.textPrimary }]}>
                {safeResult.stats.longestTrade > 0 ? `${(safeResult.stats.longestTrade / 1000).toFixed(1)}s` : "—"}
              </Text>
            </View>
          </View>
        </View>
      </ViewShot>

      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        <View style={{ gap: 10 }}>
           <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={styles.buttonWrapper}>
                <UiButton title="🏷️ Tag" onPress={handleAddTag} variant="bordered" controlSize="large" darkMode={darkMode} />
              </View>
              {onShowLeaderboard && (
                <View style={styles.buttonWrapper}>
                   <UiButton title="🏆 Top degens" onPress={onShowLeaderboard} variant="bordered" controlSize="large" darkMode={darkMode} />
                </View>
              )}
           </View>
           <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={styles.buttonWrapper}>
                <UiButton title="📸 Flex" onPress={handleShare} variant="bordered" controlSize="large" darkMode={darkMode} />
              </View>
              <View style={styles.buttonWrapper}>
                <UiButton
                  title="Again"
                  onPress={onNextRound}
                  variant="borderedProminent"
                  color={palette.button}
                  controlSize="large"
                  darkMode={darkMode}
                />
              </View>
           </View>
        </View>
      </View>

      {/* Tag Input Modal - Cross-platform replacement for Alert.prompt */}
      <Modal
        visible={tagModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleTagCancel}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: palette.background }]}>
              <Text style={[styles.modalTitle, { color: palette.textPrimary }]}>Add Tag</Text>
              <Text style={[styles.modalSubtitle, { color: palette.textSecondary }]}>
                Enter a name or tag for your screenshot
              </Text>
              <TextInput
                style={[styles.modalInput, { 
                  color: palette.textPrimary, 
                  borderColor: palette.divider,
                  backgroundColor: darkMode ? "#1a1d22" : "#f5f5f5"
                }]}
                value={tagInputValue}
                onChangeText={setTagInputValue}
                placeholder="@username"
                placeholderTextColor={palette.textSecondary}
                autoFocus
                onSubmitEditing={handleTagSubmit}
                returnKeyType="done"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={handleTagCancel} style={styles.modalButton}>
                  <Text style={[styles.modalButtonText, { color: palette.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleTagSubmit} style={styles.modalButton}>
                  <Text style={[styles.modalButtonText, { color: palette.profit }]}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Animated.View>
  );
});

RoundResultsSheet.displayName = "RoundResultsSheet";

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 45,
  },
  topChrome: {
    height: 1,
    borderBottomWidth: 1,
  },
  appBranding: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  appIcon: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  appName: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  emojiWrap: {
    marginBottom: 10,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  pnlValue: {
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginBottom: 6,
    textAlign: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  statsContainer: {
    width: "100%",
    borderTopWidth: 1,
    marginTop: 22,
    paddingTop: 8,
    maxWidth: 320,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  footer: {
    width: "100%",
    paddingHorizontal: 16,
  },
  buttons: {
    flexDirection: "row",
    gap: 10,
  },
  buttonWrapper: {
    flex: 1,
  },
  viewShot: {
    flex: 1,
  },

  backgroundAccessories: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  bgItem: {
    position: "absolute",
    opacity: 0.55,
  },
  bgA: {
    top: 70,
    left: -18,
    transform: [{ rotate: "-14deg" }],
  },
  bgB: {
    top: 140,
    right: -14,
    transform: [{ rotate: "18deg" }],
  },
  bgC: {
    bottom: 210,
    left: 18,
    transform: [{ rotate: "10deg" }],
  },
  bgD: {
    bottom: 160,
    right: 26,
    transform: [{ rotate: "-8deg" }],
  },
  bgE: {
    top: 260,
    left: 210,
    transform: [{ rotate: "22deg" }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 14,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
