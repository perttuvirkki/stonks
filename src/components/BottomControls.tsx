import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UiButton, type ButtonVariant } from "./UiButton";
import { UiPicker } from "./UiPicker";

export type BottomControlsProps = {
  darkMode: boolean;

  useLeverage: boolean;
  toggleUseLeverage: () => void;

  majorVariant: ButtonVariant;
  minorVariant: ButtonVariant;

  wagerOptionLabels: string[];
  leverageIndex: number;
  onSelectLeverageIndex: (index: number) => void;

  hasPositions: boolean;
  primaryIsShort: boolean;
  primarySide: "long" | "short";

  canBuy: boolean;
  canOpenLong: boolean;
  canOpenShort: boolean;

  onBuy: (side: "long" | "short") => void;
  onSell: () => void;

  styles: Record<string, any>;
};

export function BottomControls({
  darkMode,
  useLeverage,
  toggleUseLeverage,
  majorVariant,
  minorVariant,
  wagerOptionLabels,
  leverageIndex,
  onSelectLeverageIndex,
  hasPositions,
  primaryIsShort,
  primarySide,
  canBuy,
  canOpenLong,
  canOpenShort,
  onBuy,
  onSell,
  styles,
}: BottomControlsProps) {
  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={styles.bottomSafeArea}>
      <View style={[styles.wagerBar, darkMode && styles.wagerBarDark]}>
        <View
          style={[
            styles.wagerModeButton,
            !useLeverage && styles.wagerModeButtonInactive,
            darkMode && styles.wagerModeButtonDark,
            darkMode && !useLeverage && styles.wagerModeButtonInactiveDark,
          ]}
        >
          <UiButton
            title={useLeverage ? "Leverage" : "Spot"}
            onPress={toggleUseLeverage}
            variant="borderedProminent"
            color={useLeverage ? "#d94b4b" : "#1a9f7a"}
            style={styles.wagerModeButtonControl}
            darkMode={darkMode}
          />
        </View>

        <UiPicker
          options={wagerOptionLabels}
          selectedIndex={leverageIndex}
          onSelect={onSelectLeverageIndex}
          style={styles.wagerPicker}
          darkMode={darkMode}
        />
      </View>

      <View style={styles.tradeBar}>
        {useLeverage ? (
          hasPositions ? (
            <>
              <UiButton
                title={primaryIsShort ? "Short" : "Long"}
                onPress={() => onBuy(primarySide)}
                disabled={!canBuy}
                variant={majorVariant}
                color={primaryIsShort ? "#f5a524" : "#1a9f7a"}
                controlSize="large"
                style={[
                  styles.tradeButton,
                  primaryIsShort ? styles.shortButton : styles.buyButton,
                  !canBuy && (primaryIsShort ? styles.shortButtonDisabled : styles.buyButtonDisabled),
                ]}
                darkMode={darkMode}
              />
              <UiButton
                title="Sell"
                onPress={onSell}
                disabled={!hasPositions}
                variant={majorVariant}
                color="#d94b4b"
                controlSize="large"
                style={[styles.tradeButton, styles.sellButton, !hasPositions && styles.sellButtonDisabled]}
                darkMode={darkMode}
              />
            </>
          ) : (
            <>
              <UiButton
                title="Long"
                onPress={() => onBuy("long")}
                disabled={!canBuy || !canOpenLong}
                variant={majorVariant}
                color="#1a9f7a"
                controlSize="large"
                style={[styles.tradeButton, styles.buyButton, (!canBuy || !canOpenLong) && styles.buyButtonDisabled]}
                darkMode={darkMode}
              />
              <UiButton
                title="Short"
                onPress={() => onBuy("short")}
                disabled={!canBuy || !canOpenShort}
                variant={majorVariant}
                color="#f5a524"
                controlSize="large"
                style={[styles.tradeButton, styles.shortButton, (!canBuy || !canOpenShort) && styles.shortButtonDisabled]}
                darkMode={darkMode}
              />
            </>
          )
        ) : (
          <>
            <UiButton
              title="Buy"
              onPress={() => onBuy("long")}
              disabled={!canBuy}
              variant={majorVariant}
              color="#1a9f7a"
              controlSize="large"
              style={[styles.tradeButton, styles.buyButton, !canBuy && styles.buyButtonDisabled]}
              darkMode={darkMode}
            />
            <UiButton
              title="Sell"
              onPress={onSell}
              disabled={!hasPositions}
              variant={majorVariant}
              color="#d94b4b"
              controlSize="large"
              style={[styles.tradeButton, styles.sellButton, !hasPositions && styles.sellButtonDisabled]}
              darkMode={darkMode}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
