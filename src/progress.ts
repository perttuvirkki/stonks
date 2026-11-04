// Pure game-progress rules: which leaderboard scores and achievements each game event earns.
// Kept free of React Native imports so it can be unit tested; GameCenterService maps the keys
// to platform IDs and does the actual submitting.

export type LeaderboardKey =
  /** 60s Sprint: stack at the end of the round, in dollars. */
  | "sprint"
  /** 5 Trades: return of the run, in hundredths of a percent (1234 = +12.34%). */
  | "fiveTrades"
  /** Pop Quiz: longest streak of correct calls. */
  | "quizStreak"
  /** Training Wheels: best session return, in hundredths of a percent. */
  | "trainingReturn"
  /** All modes with money: all-time net profit in dollars (latest value, can go down). */
  | "netProfit";

export type AchievementKey =
  | "firstTrade"
  | "leverage10x"
  | "rounds100"
  | "liquidated"
  | "sprintDouble"
  | "fiveTradesDone"
  | "fiveTradesPerfect"
  | "fiveTradesDouble"
  | "quizFirstCorrect"
  | "quizStreak5"
  | "quizStreak10"
  | "trainingFirstGreen"
  | "trainingPlus50"
  | "netProfit1k"
  | "netProfit10k";

export type ProgressEvent =
  | { type: "tradeOpened"; leverage: number; training: boolean }
  | { type: "tradeClosed"; profit: number; training: boolean; trainingReturnPercent?: number }
  | {
      type: "roundEnded";
      mode: "sprint60" | "fiveTrades";
      endNetWorth: number;
      percent: number;
      tradesMade: number;
      tradesWon: number;
      /** Lifetime totals after this round was recorded. */
      totalRounds: number;
      netProfit: number;
    }
  | { type: "liquidated"; totalRounds: number; netProfit: number }
  | { type: "quizAnswered"; correct: boolean; streak: number };

export type ScoreSubmission = { board: LeaderboardKey; score: number };

export type Progress = { scores: ScoreSubmission[]; achievements: AchievementKey[] };

export const FIVE_TRADES_TARGET = 5;

/** Percent as a fixed-point integer with two decimals, the format the % leaderboards use. */
export const percentScore = (percent: number) => Math.round(percent * 100);

/** All-time net profit = profit from winning rounds minus losses from losing ones. */
export const allTimeNetProfit = (stats: { totalProfit: number; totalLoss: number }) => Math.round(stats.totalProfit - stats.totalLoss);

const netProfitProgress = (netProfit: number, totalRounds: number): Progress => {
  const achievements: AchievementKey[] = [];
  if (netProfit >= 1_000) achievements.push("netProfit1k");
  if (netProfit >= 10_000) achievements.push("netProfit10k");
  if (totalRounds >= 100) achievements.push("rounds100");
  return { scores: [{ board: "netProfit", score: Math.round(netProfit) }], achievements };
};

/** Everything an event qualifies for. Callers drop achievements that are already unlocked. */
export const progressFor = (event: ProgressEvent): Progress => {
  switch (event.type) {
    case "tradeOpened":
      return { scores: [], achievements: !event.training && event.leverage >= 10 ? ["leverage10x"] : [] };

    case "tradeClosed": {
      if (!event.training) {
        return { scores: [], achievements: ["firstTrade"] };
      }
      const achievements: AchievementKey[] = [];
      const scores: ScoreSubmission[] = [];
      if (event.profit > 0) achievements.push("trainingFirstGreen");
      const sessionReturn = event.trainingReturnPercent ?? 0;
      if (sessionReturn >= 50) achievements.push("trainingPlus50");
      // Best-score board: only positive runs are worth reporting.
      if (sessionReturn > 0) scores.push({ board: "trainingReturn", score: percentScore(sessionReturn) });
      return { scores, achievements };
    }

    case "roundEnded": {
      const base = netProfitProgress(event.netProfit, event.totalRounds);
      const scores = [...base.scores];
      const achievements = [...base.achievements];
      if (event.mode === "sprint60") {
        scores.push({ board: "sprint", score: Math.floor(event.endNetWorth) });
        if (event.percent >= 100) achievements.push("sprintDouble");
      } else {
        if (event.percent > 0) scores.push({ board: "fiveTrades", score: percentScore(event.percent) });
        if (event.tradesMade >= FIVE_TRADES_TARGET) {
          achievements.push("fiveTradesDone");
          if (event.tradesWon >= FIVE_TRADES_TARGET) achievements.push("fiveTradesPerfect");
        }
        if (event.percent >= 100) achievements.push("fiveTradesDouble");
      }
      return { scores, achievements };
    }

    case "liquidated": {
      const base = netProfitProgress(event.netProfit, event.totalRounds);
      return { scores: base.scores, achievements: ["liquidated", ...base.achievements] };
    }

    case "quizAnswered": {
      if (!event.correct) {
        return { scores: [], achievements: [] };
      }
      const achievements: AchievementKey[] = ["quizFirstCorrect"];
      if (event.streak >= 5) achievements.push("quizStreak5");
      if (event.streak >= 10) achievements.push("quizStreak10");
      return { scores: [{ board: "quizStreak", score: event.streak }], achievements };
    }
  }
};

/** Compound one closed training trade into the session return (all in percent). */
export const compoundTrainingReturn = (sessionReturnPercent: number, tradeProfit: number, stack: number) => {
  if (!(stack > 0) || !Number.isFinite(tradeProfit)) {
    return sessionReturnPercent;
  }
  const growth = (1 + sessionReturnPercent / 100) * (1 + tradeProfit / stack);
  // A blown-up session bottoms out at -100%.
  return Math.max(-100, (growth - 1) * 100);
};
