import React from "react";
import { Text, View } from "react-native";
import { AnimatedNumber } from "./AnimatedNumber";
import { TERMINAL_DARK, TERMINAL_LIGHT } from "../theme/terminal";
import { UiButton, type ButtonVariant } from "./UiButton";

import TwemojiCandle from "../../assets/twemoji/1f56f.svg";
import TwemojiLineChart from "../../assets/twemoji/1f4c8.svg";
import TwemojiWavyDash from "../../assets/twemoji/3030.svg";
import TwemojiWheel from "../../assets/twemoji/1f6de.svg";

// Training mode sits on the yellow bar, so its numbers use darker inks than the terminal palette.
const TRAINING_INK = "#000000";
const TRAINING_UP = "#06612f";
const TRAINING_DOWN = "#a3140d";

export type ChartType = "candles" | "line" | "area" | "baseline";

export type StackBarProps = {
  stackBalance: number;
  formatMoney: (value: number) => string;
  useLeverage: boolean;
  leverage: number;
  wagerPercentUsed: number;
  wagerAmount: number;
  roundSecondsRemaining?: number | null;
  trainingMode?: boolean;
  /** Training Wheels session return in percent (no money changes hands in training). */
  trainingReturnPercent?: number;
  trainingTrades?: number;
  trainingWins?: number;
  darkMode: boolean;
  chartType: ChartType;
  setChartType: (nextType: ChartType) => void;
  onTestRocketToast?: () => void;
  openMenu: () => void;
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
  trainingMode = false,
  trainingReturnPercent = 0,
  trainingTrades = 0,
  trainingWins = 0,
  darkMode,
  chartType,
  setChartType,
  onTestRocketToast,
  openMenu,
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
    <View style={[styles.stackBar, darkMode && styles.stackBarDark, trainingMode && styles.stackBarTraining]}>
      <View style={styles.stackLeft}>
        <UiButton
          onPress={openMenu}
          variant={minorVariant}
          controlSize="regular"
          style={[styles.settingsButton, darkMode && styles.settingsButtonDark]}
          darkMode={darkMode}
        >
          <View style={styles.menuBurgerGlyph}>
            <View style={[styles.menuBurgerLine, darkMode && styles.menuBurgerLineDark]} />
            <View style={[styles.menuBurgerLine, darkMode && styles.menuBurgerLineDark]} />
            <View style={[styles.menuBurgerLine, darkMode && styles.menuBurgerLineDark]} />
          </View>
        </UiButton>
        {trainingMode ? (
          <View style={styles.stackTrainingWrap}>
            <View>
              <Text numberOfLines={1} style={[styles.stackLabel, styles.stackTrainingLabel]}>
                {trainingTrades > 0
                  ? `Training P&L · ${trainingTrades} ${trainingTrades === 1 ? "trade" : "trades"} · ${Math.round((trainingWins / trainingTrades) * 100)}% won`
                  : "Training P&L · no money"}
              </Text>
              <AnimatedNumber
                value={trainingReturnPercent}
                format={(value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}%`}
                flash
                baseColor={TRAINING_INK}
                upColor={TRAINING_UP}
                downColor={TRAINING_DOWN}
                style={[styles.stackValue, styles.stackTrainingValue]}
              />
            </View>
          </View>
        ) : (
          <View>
            <Text style={[styles.stackLabel, darkMode && styles.stackLabelDark]}>Stack</Text>
            <AnimatedNumber
              value={stackBalance}
              format={(value) => `$${formatMoney(value)}`}
              flash
              baseColor={darkMode ? TERMINAL_DARK.text : TERMINAL_LIGHT.text}
              upColor={darkMode ? TERMINAL_DARK.green : TERMINAL_LIGHT.green}
              downColor={darkMode ? TERMINAL_DARK.red : TERMINAL_LIGHT.red}
              style={[styles.stackValue, darkMode && styles.stackValueDark]}
            />
          </View>
        )}
      </View>
      <View style={styles.stackBarRight}>
        {roundSecondsRemaining == null && trainingMode && (
          <UiButton
            onPress={openPatterns}
            variant={minorVariant}
            controlSize="regular"
            style={[styles.settingsButton, darkMode && styles.settingsButtonDark]}
            darkMode={darkMode}
          >
            <TwemojiWheel width={22} height={22} />
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
      </View>
    </View>
  );
}
