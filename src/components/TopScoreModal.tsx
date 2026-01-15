import React, { memo, useEffect, useRef, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { UiButton } from "./UiButton";
import { useGameStore } from "../stores/useGameStore";
import TwemojiTrophy from "../../assets/twemoji/1f3c6.svg";

export type TopScoreModalProps = {
  visible: boolean;
  darkMode: boolean;
  onClose: () => void;
};

export const TopScoreModal = memo(({ visible, darkMode, onClose }: TopScoreModalProps) => {
  const insets = useSafeAreaInsets();
  const windowHeight = Dimensions.get("window").height;
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

  const background = darkMode ? "#0d0f12" : "#ffffff";
  const textPrimary = darkMode ? "#f5f5f5" : "#111111";
  const textSecondary = darkMode ? "#b8bec6" : "#666666";
  const activeColor = "#f5a623"; // Gold/Orange for trophy
  const rowBg = darkMode ? "#15181d" : "#f8f8f8";
  const border = darkMode ? "#1f2329" : "#eeeeee";

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
          <Text style={[styles.title, { color: textPrimary }]}>Top Scores</Text>
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
          />
           {highScores.length > 0 && <UiButton
            title="Clear Scores"
            onPress={clearScores}
            variant="plain"
            color={textSecondary}
            controlSize="small"
          />}
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
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
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    textAlign: "center",
  },
  scrollView: {
    width: "100%",
    flex: 1,
  },
  scrollContent: {
      gap: 12,
      paddingBottom: 24,
  },
  scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
  },
  rankBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
      backgroundColor: 'rgba(120,120,120,0.1)',
  },
  rankText: {
      fontWeight: '700',
      fontSize: 16,
  },
  scoreDetails: {
      flex: 1,
  },
  scoreValue: {
      fontSize: 20,
      fontWeight: '700',
  },
  scoreDate: {
      fontSize: 12,
      marginTop: 2,
  },
  emptyState: {
      padding: 40,
      alignItems: 'center',
  },
  emptyText: {
      fontSize: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  buttonContainer: {
      gap: 12,
  },
});
