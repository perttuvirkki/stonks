import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { UiButton } from "./UiButton";
import { EmojiText } from "./Twemoji";
import { TERMINAL_FONT, getTerminalPalette } from "../theme/terminal";
import type { PatternDirection } from "../types";

export type QuizSide = "long" | "short";

export type QuizPrompt = {
  id: number;
  patternLabel: string;
  direction: Exclude<PatternDirection, "neutral">;
  answer: QuizSide | null;
};

export type QuizScore = {
  correct: number;
  total: number;
  streak: number;
  bestStreak: number;
};

export const EMPTY_QUIZ_SCORE: QuizScore = { correct: 0, total: 0, streak: 0, bestStreak: 0 };

export const isQuizAnswerCorrect = (prompt: QuizPrompt, side: QuizSide) =>
  (prompt.direction === "bullish" && side === "long") || (prompt.direction === "bearish" && side === "short");

const ASK_TAUNTS = [
  "Trading halted. Your therapist has been notified.",
  "No lines. No hints. Just vibes and a YouTube education.",
  "Circuit breaker tripped by your indecision.",
  "Pick a side. Be wrong with confidence, like the Fed.",
  "The SEC is watching. Not you specifically. Probably.",
  "Your edge is about to be tested. Statistically, it's not there.",
];

const CORRECT_QUIPS = [
  "Please do not quit your day job based on this.",
  "Somewhere a finfluencer is screenshotting this for a course.",
  "The market will now humble you in other ways.",
  "Go ahead, add \"Technical Analyst\" to your LinkedIn.",
  "Galaxy brain. Or a coin flip. We'll never know.",
  "Warren Buffett felt a disturbance in the force.",
];

const WRONG_QUIPS = [
  "Bold of you to have a strategy.",
  "Have you considered index funds?",
  "Your broker thanks you for your liquidity.",
  "Inverse you is up 40% this year.",
  "Chart-reading skill: horoscope tier.",
  "Hedge funds would like to know your location so they can take the other side.",
];

const pick = (lines: string[], seed: number) => lines[Math.abs(seed) % lines.length];

type PopQuizCardProps = {
  prompt: QuizPrompt | null;
  score: QuizScore;
  darkMode: boolean;
  onAnswer: (side: QuizSide) => void;
  onContinue: () => void;
};

export const PopQuizCard = memo(({ prompt, score, darkMode, onAnswer, onContinue }: PopQuizCardProps) => {
  const terminal = getTerminalPalette(darkMode);
  const seed = prompt?.id ?? 0;
  const taunt = useMemo(() => pick(ASK_TAUNTS, seed), [seed]);
  const correctQuip = useMemo(() => pick(CORRECT_QUIPS, seed * 7 + 3), [seed]);
  const wrongQuip = useMemo(() => pick(WRONG_QUIPS, seed * 5 + 1), [seed]);

  if (!prompt) {
    return null;
  }

  const answered = prompt.answer !== null;
  const correct = answered && isQuizAnswerCorrect(prompt, prompt.answer as QuizSide);
  const verdictColor = correct ? terminal.green : terminal.red;
  const correctSide: QuizSide = prompt.direction === "bullish" ? "long" : "short";

  return (
    <Animated.View
      key={prompt.id}
      entering={FadeInDown.duration(220)}
      exiting={FadeOut.duration(160)}
      style={[styles.card, { backgroundColor: terminal.panel, borderColor: answered ? verdictColor : terminal.amber }]}
    >
      <View style={[styles.header, { backgroundColor: terminal.header }]}>
        <Text style={[styles.headerText, { color: terminal.headerText }]}>POP QUIZ &lt;GO&gt;</Text>
        <Text style={[styles.headerText, { color: terminal.headerText }]}>{answered ? "RESULT" : "MARKET HALTED"}</Text>
      </View>

      {!answered ? (
        <View style={styles.body}>
          <Text style={[styles.label, { color: terminal.amber }]}>PATTERN COMPLETE. BREAKOUT IMMINENT.</Text>
          <Text style={[styles.question, { color: terminal.text }]}>Long or short?</Text>
          <Text style={[styles.flavor, { color: terminal.textDim }]}>{taunt}</Text>
          <View style={styles.buttonRow}>
            <UiButton
              title="▲ Long"
              variant="borderedProminent"
              color={terminal.green}
              controlSize="large"
              darkMode={darkMode}
              style={styles.answerButton}
              onPress={() => onAnswer("long")}
            />
            <UiButton
              title="▼ Short"
              variant="borderedProminent"
              color={terminal.red}
              controlSize="large"
              darkMode={darkMode}
              style={styles.answerButton}
              onPress={() => onAnswer("short")}
            />
          </View>
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(200)} style={styles.body}>
          <Text style={[styles.verdict, { color: verdictColor }]}>{correct ? "✓ CORRECT" : "✗ WRONG"}</Text>
          <View style={[styles.factRow, { borderColor: terminal.border }]}>
            <Text style={[styles.factLabel, { color: terminal.amber }]}>FORMATION</Text>
            <Text style={[styles.factValue, { color: terminal.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {prompt.patternLabel}
            </Text>
          </View>
          <View style={[styles.factRow, { borderColor: terminal.border }]}>
            <Text style={[styles.factLabel, { color: terminal.amber }]}>PLAY</Text>
            <Text style={[styles.factValue, { color: correctSide === "long" ? terminal.green : terminal.red }]}>
              {prompt.direction === "bullish" ? "BULLISH ▲ LONG" : "BEARISH ▼ SHORT"}
            </Text>
          </View>
          <Text style={[styles.flavor, { color: terminal.textDim }]}>{correct ? correctQuip : wrongQuip}</Text>
          <EmojiText style={[styles.scoreLine, { color: terminal.textDim }]}>
            SCORE {score.correct}/{score.total}
            {score.streak >= 2 ? `  ·  STREAK ${score.streak} 🔥` : ""}
          </EmojiText>
          <UiButton
            title="Resume market"
            variant="borderedProminent"
            color={terminal.amber}
            controlSize="large"
            darkMode={darkMode}
            onPress={onContinue}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
});

PopQuizCard.displayName = "PopQuizCard";

type PopQuizScoreTagProps = {
  score: QuizScore;
  darkMode: boolean;
};

export const PopQuizScoreTag = memo(({ score, darkMode }: PopQuizScoreTagProps) => {
  const terminal = getTerminalPalette(darkMode);
  const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : null;
  const text =
    score.total === 0
      ? "POP QUIZ · WAIT FOR A PATTERN"
      : `POP QUIZ · ${score.correct}/${score.total} · ${accuracy}%${score.streak >= 2 ? ` · 🔥${score.streak}` : ""}`;

  return (
    <View style={[styles.scoreTag, { backgroundColor: terminal.panel, borderColor: terminal.amber }]}>
      <EmojiText style={[styles.scoreTagText, { color: terminal.amber }]}>{text}</EmojiText>
    </View>
  );
});

PopQuizScoreTag.displayName = "PopQuizScoreTag";

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 2,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerText: {
    fontFamily: TERMINAL_FONT,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  body: {
    padding: 14,
    gap: 10,
  },
  label: {
    fontFamily: TERMINAL_FONT,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  question: {
    fontFamily: TERMINAL_FONT,
    fontSize: 24,
    fontWeight: "700",
  },
  flavor: {
    fontFamily: TERMINAL_FONT,
    fontSize: 12,
    lineHeight: 17,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  answerButton: {
    flex: 1,
  },
  verdict: {
    fontFamily: TERMINAL_FONT,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 1,
  },
  factRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    paddingBottom: 6,
  },
  factLabel: {
    fontFamily: TERMINAL_FONT,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  factValue: {
    flexShrink: 1,
    fontFamily: TERMINAL_FONT,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
  },
  scoreLine: {
    fontFamily: TERMINAL_FONT,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  scoreTag: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scoreTagText: {
    fontFamily: TERMINAL_FONT,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
});
