import { memo, useCallback, useMemo, useRef } from "react";
import { Dimensions, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeIn, FadeInDown, Keyframe } from "react-native-reanimated";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";
import { UiButton } from "./UiButton";
import { RoundReviewChart } from "./RoundReviewChart";
import { pushEnter, pushExit } from "../transitions";
import { analyzeRound, type RoundReviewData } from "../review/roundReview";

const CHART_HEIGHT = 250;
const FINDING_DELAY_MS = 380;
const FINDING_STAGGER_MS = 90;

const stampEnter = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 1.6 }, { rotate: "-4deg" }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: "-12deg" }], easing: Easing.out(Easing.cubic) },
})
  .duration(360)
  .delay(700);

export type RoundReviewSheetProps = {
  data: RoundReviewData | null;
  darkMode: boolean;
  onClose: () => void;
};

// "What went wrong": the round re-drawn with the patterns that formed and every trade marked, plus
// a findings list that blames the player for each one. Pushed over the results / margin call screen.
export const RoundReviewSheet = memo(({ data, darkMode, onClose }: RoundReviewSheetProps) => {
  if (!data) {
    return null;
  }
  return <RoundReviewContent data={data} darkMode={darkMode} onClose={onClose} />;
});

RoundReviewSheet.displayName = "RoundReviewSheet";

const RoundReviewContent = ({ data, darkMode, onClose }: { data: RoundReviewData; darkMode: boolean; onClose: () => void }) => {
  const insets = useSafeAreaInsets();
  const viewShotRef = useRef<ViewShotRef>(null);
  const analysis = useMemo(() => analyzeRound(data), [data]);
  const chartWidth = Dimensions.get("window").width - 32;

  const palette = {
    background: darkMode ? "#0d0f12" : "#ffffff",
    card: darkMode ? "#15181d" : "#f6f7f8",
    textPrimary: darkMode ? "#f5f5f5" : "#111111",
    textSecondary: darkMode ? "#b8bec6" : "#666666",
    divider: darkMode ? "#1f2329" : "#eeeeee",
    profit: "#1a9f7a",
    danger: "#d94b4b",
  };
  const stampColor = analysis.verdict.stonks ? palette.profit : palette.danger;

  const handleShare = useCallback(async () => {
    try {
      const uri = await viewShotRef.current?.capture();
      if (uri) {
        await Share.share({ url: uri, title: "What went wrong" });
      }
    } catch (error) {
      console.warn("Share failed:", error);
    }
  }, []);

  return (
    <Animated.View entering={pushEnter} exiting={pushExit} style={[styles.container, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1 }} style={{ backgroundColor: palette.background, paddingHorizontal: 16 }}>
          <Text style={[styles.kicker, { color: stampColor }]}>{data.liquidated ? "INCIDENT REPORT" : "POST-GAME REVIEW"}</Text>
          <Text style={[styles.title, { color: palette.textPrimary }]}>{analysis.verdict.title}</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{analysis.verdict.subtitle}</Text>

          <Animated.View entering={FadeIn.delay(180).duration(420)} style={[styles.chartCard, { borderColor: palette.divider }]}>
            <RoundReviewChart data={data} callouts={analysis.callouts} width={chartWidth} height={CHART_HEIGHT} darkMode={darkMode} />
            <Animated.View entering={stampEnter} pointerEvents="none" style={[styles.stamp, { borderColor: stampColor }]}>
              <Text style={[styles.stampText, { color: stampColor }]}>
                {analysis.verdict.stamp} {analysis.verdict.stonks ? "📈" : "📉"}
              </Text>
            </Animated.View>
          </Animated.View>

          <View style={styles.findings}>
            {analysis.findings.map((finding, index) => (
              <Animated.View
                key={`${finding.title}-${index}`}
                entering={FadeInDown.delay(FINDING_DELAY_MS + index * FINDING_STAGGER_MS).duration(360)}
                style={[styles.finding, { backgroundColor: palette.card }]}
              >
                <Text style={styles.findingEmoji}>{finding.emoji}</Text>
                <View style={styles.findingText}>
                  <Text style={[styles.findingTitle, { color: palette.textPrimary }]}>
                    {finding.trade ? <Text style={{ color: palette.textSecondary }}>#{finding.trade} </Text> : null}
                    {finding.title}
                  </Text>
                  <Text style={[styles.findingBody, { color: palette.textSecondary }]}>{finding.body}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        </ViewShot>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 12), borderTopColor: palette.divider }]}>
        <View style={styles.buttonWrapper}>
          <UiButton title="📸 Expose me" onPress={handleShare} variant="bordered" controlSize="large" darkMode={darkMode} />
        </View>
        <View style={styles.buttonWrapper}>
          <UiButton title="Blame the market" onPress={onClose} variant="borderedProminent" color={palette.profit} controlSize="large" darkMode={darkMode} />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 60,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 14,
  },
  chartCard: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  stamp: {
    position: "absolute",
    left: 10,
    bottom: 26,
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    transform: [{ rotate: "-12deg" }],
  },
  stampText: {
    fontSize: 20,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 0.5,
  },
  findings: {
    marginTop: 14,
    gap: 10,
  },
  finding: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  findingEmoji: {
    fontSize: 26,
    lineHeight: 32,
  },
  findingText: {
    flex: 1,
  },
  findingTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 2,
  },
  findingBody: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  buttonWrapper: {
    flex: 1,
  },
});
