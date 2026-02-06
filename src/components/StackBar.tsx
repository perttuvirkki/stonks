import React from "react";
import { Text, View } from "react-native";
import { UiButton, type ButtonVariant } from "./UiButton";

import TwemojiCandle from "../../assets/twemoji/1f56f.svg";
import TwemojiLineChart from "../../assets/twemoji/1f4c8.svg";
import TwemojiWavyDash from "../../assets/twemoji/3030.svg";
import TwemojiBarChart from "../../assets/twemoji/1f4ca.svg";
import TwemojiGear from "../../assets/twemoji/2699.svg";

export type ChartType = "candles" | "line" | "area" | "baseline";

export type StackBarProps = {
  stackBalance: number;
  formatMoney: (value: number) => string;
  useLeverage: boolean;
  leverage: number;
  wagerPercentUsed: number;
  wagerAmount: number;
  roundSecondsRemaining?: number | null;
  darkMode: boolean;
  chartType: ChartType;
  setChartType: (nextType: ChartType) => void;
  onTestRocketToast?: () => void;
  openSettings: () => void;
  openPatterns: () => void;
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
  roundSecondsRemaining,
  darkMode,
  chartType,
  setChartType,
  onTestRocketToast,
  openSettings,
  openPatterns,
  minorVariant,
  styles,
}: StackBarProps) {
  const chartTypeOrder: ChartType[] = ["candles", "line", "area", "baseline"];
  
  const ChartTypeIcon = (() => {
    switch (chartType) {
      case "candles": return <TwemojiCandle width={22} height={22} />;
      case "line": return <TwemojiLineChart width={22} height={22} />;
      case "area": return <TwemojiWavyDash width={22} height={22} />;
      case "baseline": return <TwemojiWavyDash width={22} height={22} />;
      default: return <TwemojiCandle width={22} height={22} />;
    }
  })();

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
        {roundSecondsRemaining == null && (
          <UiButton
            onPress={openPatterns}
            variant={minorVariant}
            controlSize="regular"
            style={[styles.settingsButton, darkMode && styles.settingsButtonDark]}
            darkMode={darkMode}
          >
            <TwemojiBarChart width={22} height={22} />
          </UiButton>
        )}
        <UiButton
          onPress={cycleChartType}
          variant={minorVariant}
          controlSize="regular"
          style={[styles.settingsButton, darkMode && styles.settingsButtonDark]}
          darkMode={darkMode}
        >
          {ChartTypeIcon}
        </UiButton>
        {onTestRocketToast ? (
          <UiButton
            title="Test 🚀"
            onPress={onTestRocketToast}
            variant={minorVariant}
            controlSize="regular"
            style={[styles.settingsButton, darkMode && styles.settingsButtonDark]}
            darkMode={darkMode}
          />
        ) : null}
        <UiButton
          onPress={openSettings}
          variant={minorVariant}
          style={[styles.settingsButton, darkMode && styles.settingsButtonDark]}
          darkMode={darkMode}
        >
          <TwemojiGear width={22} height={22} />
        </UiButton>
      </View>
    </View>
  );
}
