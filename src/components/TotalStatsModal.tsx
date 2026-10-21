import { memo, useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useGameStore, type LifetimeStats } from "../stores/useGameStore";
import { UiButton } from "./UiButton";

type TotalStatsModalProps = {
  visible: boolean;
  darkMode: boolean;
  onClose: () => void;
};

const formatNumber = (n: number) => n.toLocaleString();
const formatMoney = (n: number) => `$${Math.round(n).toLocaleString()}`;
const formatPercent = (n: number) => `${Math.round(n)}%`;
const formatTime = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

type StatRowProps = {
  label: string;
  value: string;
  darkMode: boolean;
  highlight?: "profit" | "loss" | "neutral";
};

const StatRow = memo(({ label, value, darkMode, highlight }: StatRowProps) => {
  const valueColor = 
    highlight === "profit" ? "#1a9f7a" :
    highlight === "loss" ? "#d94b4b" :
    darkMode ? "#f5f5f5" : "#111111";

  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, darkMode && styles.statLabelDark]}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
});

StatRow.displayName = "StatRow";

const SectionHeader = memo(({ title, darkMode }: { title: string; darkMode: boolean }) => (
  <View style={[styles.sectionHeader, darkMode && styles.sectionHeaderDark]}>
    <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>{title}</Text>
  </View>
));

SectionHeader.displayName = "SectionHeader";

export const TotalStatsModal = memo(({ visible, darkMode, onClose }: TotalStatsModalProps) => {
  const insets = useSafeAreaInsets();
  const windowHeight = Dimensions.get("window").height;
  const translateY = useSharedValue(windowHeight);
  const [rendered, setRendered] = useState(visible);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const stats = useGameStore((state) => state.lifetimeStats);

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

  const winRate = stats.totalTrades > 0 
    ? (stats.tradesWon / stats.totalTrades * 100) 
    : 0;

  const netProfit = stats.totalProfit - stats.totalLoss;
  const bottomPad = Math.max(16, insets.bottom + 12);
  const topPad = Math.max(16, insets.top + 32);
  const background = darkMode ? "#0d0f12" : "#ffffff";
  const textPrimary = darkMode ? "#f5f5f5" : "#111111";
  const textSecondary = darkMode ? "#b8bec6" : "#666666";
  const activeColor = "#1a9f7a";

  return (
    <Animated.View style={[styles.overlay, animatedStyle, { backgroundColor: background }]}>
      <View style={[styles.content, { paddingTop: topPad }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: textPrimary }]}>📊 Total Stats</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>Your Lifetime Performance</Text>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Overview */}
          <SectionHeader title="Overview" darkMode={darkMode} />
          <StatRow label="Rounds Played" value={formatNumber(stats.totalRounds)} darkMode={darkMode} />
          <StatRow label="Total Play Time" value={formatTime(stats.totalPlayTimeMs)} darkMode={darkMode} />
          <StatRow 
            label="Net Profit/Loss" 
            value={formatMoney(netProfit)} 
            darkMode={darkMode} 
            highlight={netProfit >= 0 ? "profit" : "loss"}
          />

          {/* Trading Performance */}
          <SectionHeader title="Trading Performance" darkMode={darkMode} />
          <StatRow label="Total Trades" value={formatNumber(stats.totalTrades)} darkMode={darkMode} />
          <StatRow label="Trades Won" value={formatNumber(stats.tradesWon)} darkMode={darkMode} highlight="profit" />
          <StatRow label="Trades Lost" value={formatNumber(stats.tradesLost)} darkMode={darkMode} highlight="loss" />
          <StatRow 
            label="Win Rate" 
            value={formatPercent(winRate)} 
            darkMode={darkMode} 
            highlight={winRate >= 50 ? "profit" : "loss"}
          />

          {/* Money */}
          <SectionHeader title="Money" darkMode={darkMode} />
          <StatRow label="Total Profit" value={formatMoney(stats.totalProfit)} darkMode={darkMode} highlight="profit" />
          <StatRow label="Total Loss" value={formatMoney(stats.totalLoss)} darkMode={darkMode} highlight="loss" />
          <StatRow label="Best Round Profit" value={formatMoney(stats.bestRoundProfit)} darkMode={darkMode} highlight="profit" />
          <StatRow label="Worst Round Loss" value={formatMoney(stats.worstRoundLoss)} darkMode={darkMode} highlight="loss" />

          {/* Records */}
          <SectionHeader title="Records" darkMode={darkMode} />
          <StatRow label="Biggest Win %" value={formatPercent(stats.biggestWinPercent)} darkMode={darkMode} highlight="profit" />
          <StatRow label="Biggest Loss %" value={formatPercent(stats.biggestLossPercent)} darkMode={darkMode} highlight="loss" />
          <StatRow label="Biggest Win Amount" value={formatMoney(stats.biggestWinAmount)} darkMode={darkMode} highlight="profit" />
          <StatRow label="Biggest Loss Amount" value={formatMoney(stats.biggestLossAmount)} darkMode={darkMode} highlight="loss" />

          {/* Streaks & Risk */}
          <SectionHeader title="Streaks & Risk" darkMode={darkMode} />
          <StatRow label="Longest Win Streak" value={formatNumber(stats.longestWinStreak)} darkMode={darkMode} highlight="profit" />
          <StatRow label="Current Win Streak" value={formatNumber(stats.currentWinStreak)} darkMode={darkMode} />
          <StatRow label="Liquidations" value={formatNumber(stats.liquidations)} darkMode={darkMode} highlight="loss" />


          {/* Leverage */}
          <SectionHeader title="Leverage" darkMode={darkMode} />
          {(() => {
            const leverageStats = stats.leverageStats || {};
            const leverages = [5, 10, 25, 50];
            const totalLeverageTrades = leverages.reduce((sum, l) => sum + (leverageStats[l]?.tradesCount || 0), 0);
            const favoriteLeverage = leverages.reduce((fav, l) => {
              const count = leverageStats[l]?.tradesCount || 0;
              return count > (leverageStats[fav]?.tradesCount || 0) ? l : fav;
            }, 5);
            
            return (
              <>
                <StatRow 
                  label="Favorite Leverage" 
                  value={totalLeverageTrades > 0 ? `${favoriteLeverage}x` : "—"} 
                  darkMode={darkMode} 
                />
                {leverages.map((l) => {
                  const data = leverageStats[l] || { tradesCount: 0, liquidations: 0 };
                  return (
                    <StatRow 
                      key={l}
                      label={`${l}x Trades / Liquidations`}
                      value={`${formatNumber(data.tradesCount)} / ${formatNumber(data.liquidations)}`}
                      darkMode={darkMode}
                      highlight={data.liquidations > 0 ? "loss" : "neutral"}
                    />
                  );
                })}
              </>
            );
          })()}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        <UiButton
          title="Close"
          onPress={onClose}
          variant="borderedProminent"
          color={activeColor}
          controlSize="large"
        />
      </View>
    </Animated.View>
  );
});

TotalStatsModal.displayName = "TotalStatsModal";

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e6e6e6",
    paddingBottom: 8,
  },
  sectionHeaderDark: {
    borderBottomColor: "#2b2f35",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionTitleDark: {
    color: "#9aa0a6",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  statLabel: {
    fontSize: 16,
    color: "#444444",
  },
  statLabelDark: {
    color: "#b0b5bd",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
