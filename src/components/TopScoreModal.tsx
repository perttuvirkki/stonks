import React, { memo, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { UiButton } from "./UiButton";
import { TERMINAL_FONT, getTerminalPalette } from "../theme/terminal";
import { useGameStore } from "../stores/useGameStore";
import TwemojiTrophy from "../../assets/twemoji/1f3c6.svg";

export type TopScoreModalProps = {
  visible: boolean;
  darkMode: boolean;
  onClose: () => void;
};

export const TopScoreModal = memo(({ visible, darkMode, onClose }: TopScoreModalProps) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const translateY = useSharedValue(windowHeight);
  const [rendered, setRendered] = useState(visible);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const highScores = useGameStore((state) => state.highScores);
  const clearScores = useGameStore((state) => state.clearScores);

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

  const bottomPad = Math.max(16, insets.bottom + 12);
  const topPad = Math.max(16, insets.top + 32);

  const palette = getTerminalPalette(darkMode);
  const background = palette.bg;
  const textPrimary = palette.text;
  const textSecondary = palette.textDim;
  const activeColor = palette.amber;
  const rowBg = palette.panel;
  const border = palette.border;

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return "";
    }
  };

  return (
    <Animated.View style={[styles.overlay, animatedStyle, { backgroundColor: background }]}>
      <View style={[styles.content, { paddingTop: topPad }]}>
        <View style={styles.header}>
            <TwemojiTrophy width={64} height={64} style={{ marginBottom: 16 }} />
          <Text style={[styles.title, { color: palette.amber }]}>Top Scores</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>Local Legends</Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {highScores.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={[styles.emptyText, { color: textSecondary }]}>No scores yet. Get trading!</Text>
                </View>
            ) : (
                highScores.map((score, index) => (
                    <View key={score.id} style={[styles.scoreRow, { backgroundColor: rowBg, borderColor: border }]}>
                        <View style={[styles.rankBadge, index < 3 && { backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32' }]}>
                            <Text style={[styles.rankText, index < 3 ? { color: '#000' } : { color: textSecondary }]}>{index + 1}</Text>
                        </View>
                        <View style={styles.scoreDetails}>
                             <Text style={[styles.scoreValue, { color: textPrimary }]}>${score.score.toLocaleString()}</Text>
                             <Text style={[styles.scoreDate, { color: textSecondary }]}>{formatDate(score.date)}</Text>
                        </View>
                    </View>
                ))
            )}
        </ScrollView>
      </View>

      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        <View style={styles.buttonContainer}>
           <UiButton
            title="Close"
            onPress={onClose}
            variant="borderedProminent"
            color={activeColor}
            controlSize="large"
            darkMode={darkMode}
          />
           {highScores.length > 0 && <UiButton
            title="Clear Scores"
            onPress={clearScores}
            variant="plain"
            color={textSecondary}
            controlSize="small"
            darkMode={darkMode}
          />}
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    width: "100%",
    maxWidth: 640,
  },
  title: {
    fontFamily: TERMINAL_FONT,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: TERMINAL_FONT,
    fontSize: 13,
    textTransform: "uppercase",
    textAlign: "center",
  },
  scrollView: {
    width: "100%",
    maxWidth: 640,
    flex: 1,
  },
  scrollContent: {
      gap: 0,
      paddingBottom: 24,
  },
  scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
  },
  rankBadge: {
      width: 32,
      height: 32,
      borderRadius: 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
      backgroundColor: 'rgba(120,120,120,0.1)',
  },
  rankText: {
      fontFamily: TERMINAL_FONT,
      fontWeight: '700',
      fontSize: 16,
  },
  scoreDetails: {
      flex: 1,
  },
  scoreValue: {
      fontFamily: TERMINAL_FONT,
      fontSize: 20,
      fontWeight: '700',
  },
  scoreDate: {
      fontFamily: TERMINAL_FONT,
      fontSize: 11,
      marginTop: 2,
  },
  emptyState: {
      padding: 40,
      alignItems: 'center',
  },
  emptyText: {
      fontFamily: TERMINAL_FONT,
      fontSize: 14,
  },
  footer: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  buttonContainer: {
      gap: 12,
  },
});
