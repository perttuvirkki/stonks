import React from "react";
import { Text, View } from "react-native";
import { UiButton, type ButtonVariant } from "./UiButton";

export type ChartType = "candles" | "line" | "area" | "baseline";

export type StackBarProps = {
  stackBalance: number;
  formatMoney: (value: number) => string;
  useLeverage: boolean;
  leverage: number;
  wagerPercentUsed: number;
  wagerAmount: number;
  darkMode: boolean;
  isChartFollowing: boolean;
  chartType: ChartType;
  resetChartView: () => void;
  setChartType: (nextType: ChartType) => void;
  onTestRocketToast?: () => void;
  openSettings: () => void;
  minorVariant: ButtonVariant;
  styles: Record<string, any>;
};

export function StackBar({
  stackBalance,
  formatMoney,
  useLeverage,
  leverage,
  wagerPercentUsed,
  wagerAmount,
  darkMode,
  isChartFollowing,
  chartType,
  resetChartView,
  setChartType,
  onTestRocketToast,
  openSettings,
  minorVariant,
  styles,
}: StackBarProps) {
  const chartTypeOrder: ChartType[] = ["candles", "line", "area", "baseline"];
  const chartTypeLabel: Record<ChartType, string> = {
    candles: "🕯",
    line: "📈",
    area: "〰︎",
    baseline: "≋",
  };
  const cycleChartType = () => {
    const currentIndex = Math.max(0, chartTypeOrder.indexOf(chartType));
    const nextType = chartTypeOrder[(currentIndex + 1) % chartTypeOrder.length];
    setChartType(nextType);
  };

  return (
    <View style={[styles.stackBar, darkMode && styles.stackBarDark]}>
      <View>
        <Text style={[styles.stackLabel, darkMode && styles.stackLabelDark]}>Stack</Text>
        <Text style={[styles.stackValue, darkMode && styles.stackValueDark]}>${formatMoney(stackBalance)}</Text>
      </View>
      <View style={styles.stackBarRight}>
        <View style={styles.stackWager}>
          <Text style={[styles.stackWagerLabel, darkMode && styles.stackWagerLabelDark]}>Wager · {useLeverage ? `${leverage}x` : "Spot"}</Text>
          <Text style={[styles.stackWagerValue, darkMode && styles.stackWagerValueDark]}>
            {Math.round(wagerPercentUsed * 100)}% (${formatMoney(wagerAmount)})
          </Text>
        </View>
        <UiButton
          title="Follow"
          onPress={resetChartView}
          variant={isChartFollowing ? "borderedProminent" : minorVariant}
          color={isChartFollowing ? "#1a9f7a" : undefined}
          controlSize="small"
          style={[styles.followButton, !isChartFollowing && darkMode && styles.followButtonDark]}
          darkMode={darkMode}
        />
        <UiButton
          title={chartTypeLabel[chartType]}
          onPress={cycleChartType}
          variant={minorVariant}
          controlSize="small"
          style={[styles.settingsButton, darkMode && styles.settingsButtonDark]}
          darkMode={darkMode}
        />
        {onTestRocketToast ? (
          <UiButton
            title="Test 🚀"
            onPress={onTestRocketToast}
            variant={minorVariant}
            controlSize="small"
            style={[styles.settingsButton, darkMode && styles.settingsButtonDark]}
            darkMode={darkMode}
          />
        ) : null}
        <UiButton
          systemImage="gearshape"
          onPress={openSettings}
          variant={minorVariant}
          style={[styles.settingsButton, darkMode && styles.settingsButtonDark]}
          darkMode={darkMode}
        />
      </View>
    </View>
  );
}
