import React from "react";
import { ScrollView, View } from "react-native";
import { UiButton, type ButtonVariant } from "./UiButton";

export type PatternLike = { id: string; label: string };

export type PatternBarProps = {
  patterns: PatternLike[];
  enabledPatternIds: string[];
  togglePattern: (patternId: string) => void;
  darkMode: boolean;
  majorVariant: ButtonVariant;
  minorVariant: ButtonVariant;
  styles: Record<string, any>;
};

export function PatternBar({ patterns, enabledPatternIds, togglePattern, darkMode, majorVariant, minorVariant, styles }: PatternBarProps) {
  return (
    <View style={[styles.patternBar, darkMode && styles.patternBarDark]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.patternRow}>
        {patterns.map((pattern) => {
          const isActive = enabledPatternIds.includes(pattern.id);
          const patternColor = isActive ? "#1a9f7a" : darkMode ? "#cfd3d8" : "#444444";
          return (
            <View key={pattern.id} style={[styles.patternToggle, darkMode && styles.patternToggleDark, isActive && styles.patternToggleActive]}>
              <UiButton
                title={pattern.label}
                onPress={() => togglePattern(pattern.id)}
                variant={isActive ? majorVariant : minorVariant}
                color={patternColor}
                darkMode={darkMode}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
