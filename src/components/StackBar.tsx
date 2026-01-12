import React from "react";
import { Text, View } from "react-native";
import { UiButton, type ButtonVariant } from "./UiButton";

export type StackBarProps = {
  stackBalance: number;
  formatMoney: (value: number) => string;
  useLeverage: boolean;
  leverage: number;
  wagerPercentUsed: number;
  wagerAmount: number;
  darkMode: boolean;
  resetChartView: () => void;
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
  resetChartView,
  openSettings,
  minorVariant,
  styles,
}: StackBarProps) {
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
          variant={minorVariant}
          controlSize="small"
          style={[styles.followButton, darkMode && styles.followButtonDark]}
          darkMode={darkMode}
        />
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
