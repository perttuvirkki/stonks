import type { PatternBias, PatternLineKind } from "../types";

// Everything the post-game review needs to re-draw a round and assign blame. The game records
// trades and spawned patterns as they happen; the review snapshots the candles when it opens, so
// it also shows a few candles of "what happened right after you left".

export type ReviewCandle = { index: number; open: number; high: number; low: number; close: number };

export type ReviewTradeOutcome = "open" | "closed" | "bell" | "liquidated";

export type ReviewTrade = {
  side: "long" | "short";
  leverage: number;
  spot: boolean;
  entryIndex: number;
  entryPrice: number;
  exitIndex: number | null;
  exitPrice: number | null;
  outcome: ReviewTradeOutcome;
};

export type ReviewPatternLine = {
  id: string;
  kind: PatternLineKind;
  points: { index: number; price: number }[];
  endIndex: number;
};

export type ReviewPattern = {
  id: string;
  label: string;
  bias: PatternBias;
  startIndex: number;
  /** Last candle of the formation; the breakout and run to target come after it. */
  formationEndIndex: number;
  /** Last candle of the run to target. */
  endIndex: number;
  lines: ReviewPatternLine[];
};

export type RoundReviewData = {
  candles: ReviewCandle[];
  trades: ReviewTrade[];
  patterns: ReviewPattern[];
  /** Candle the round ended on (the bell, or the liquidation). */
  roundEndIndex: number;
  liquidationPrice: number | null;
  liquidated: boolean;
  percent: number;
};

export type ReviewFinding = {
  emoji: string;
  title: string;
  body: string;
  /** 1-based trade number this finding is about, if any. */
  trade?: number;
};

export type ReviewVerdict = {
  title: string;
  subtitle: string;
  stamp: string;
  stonks: boolean;
};

/** A spot to point at on the chart, meme-arrow style. */
export type ReviewCallout = { index: number; price: number; text: string; tone: "bad" | "good" | "neutral" };

export type RoundReviewAnalysis = {
  verdict: ReviewVerdict;
  findings: ReviewFinding[];
  callouts: ReviewCallout[];
};

/** How far past an exit "you left money on the table" looks. */
const MISSED_LOOKAHEAD = 30;

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const formatPercent = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(Math.abs(value) >= 100 ? 0 : 1)}%`;

/** Profit of a trade as a percentage of its margin (what the player actually felt). */
export const tradeReturnPercent = (trade: ReviewTrade) => {
  if (trade.outcome === "liquidated") {
    return -100;
  }
  if (trade.exitPrice === null || trade.entryPrice <= 0) {
    return 0;
  }
  const move = (trade.exitPrice - trade.entryPrice) / trade.entryPrice;
  const signed = trade.side === "long" ? move : -move;
  return Math.max(-100, signed * trade.leverage * 100);
};

export const patternAt = (patterns: ReviewPattern[], index: number) => {
  // The newest pattern wins if two overlap (a new one can spawn during the previous runout).
  for (let i = patterns.length - 1; i >= 0; i -= 1) {
    const pattern = patterns[i];
    if (index >= pattern.startIndex && index <= pattern.endIndex) {
      return pattern;
    }
  }
  return null;
};

const sideVerb = (trade: ReviewTrade) => (trade.side === "short" ? "shorted" : trade.spot ? "bought" : "went long");
const sideLabel = (trade: ReviewTrade) =>
  `${trade.side === "short" ? "Short" : trade.spot ? "Buy" : "Long"}${trade.spot ? "" : ` ${trade.leverage}x`}`;

const biasWord = (bias: PatternBias) => (bias === "bullish" ? "bullish" : bias === "bearish" ? "bearish" : "going-nowhere");

const isAgainst = (trade: ReviewTrade, pattern: ReviewPattern | null) =>
  !!pattern && ((pattern.bias === "bullish" && trade.side === "short") || (pattern.bias === "bearish" && trade.side === "long"));

const isWith = (trade: ReviewTrade, pattern: ReviewPattern | null) =>
  !!pattern && ((pattern.bias === "bullish" && trade.side === "long") || (pattern.bias === "bearish" && trade.side === "short"));

/** First candle after the exit where price is back past the entry, in the trade's favour. */
const recoveryAfterExit = (trade: ReviewTrade, candles: ReviewCandle[]) => {
  if (trade.exitIndex === null) {
    return null;
  }
  for (const candle of candles) {
    if (candle.index <= trade.exitIndex) {
      continue;
    }
    const recovered = trade.side === "long" ? candle.close > trade.entryPrice : candle.close < trade.entryPrice;
    if (recovered) {
      return candle;
    }
  }
  return null;
};

/** How much more the trade would have made at its best point in the candles after the exit. */
const missedAfterExit = (trade: ReviewTrade, candles: ReviewCandle[]) => {
  if (trade.exitIndex === null || trade.exitPrice === null) {
    return null;
  }
  let best: ReviewCandle | null = null;
  for (const candle of candles) {
    if (candle.index <= trade.exitIndex || candle.index > trade.exitIndex + MISSED_LOOKAHEAD) {
      continue;
    }
    if (!best || (trade.side === "long" ? candle.high > best.high : candle.low < best.low)) {
      best = candle;
    }
  }
  if (!best) {
    return null;
  }
  const bestPrice = trade.side === "long" ? best.high : best.low;
  const move = (bestPrice - trade.exitPrice) / trade.exitPrice;
  const percent = (trade.side === "long" ? move : -move) * trade.leverage * 100;
  return { candle: best, price: bestPrice, percent };
};

const roastTrade = (trade: ReviewTrade, number: number, data: RoundReviewData): ReviewFinding => {
  const pattern = patternAt(data.patterns, trade.entryIndex);
  const name = pattern?.label;
  const returnPercent = tradeReturnPercent(trade);
  const label = sideLabel(trade);
  const forming = pattern && trade.entryIndex <= pattern.formationEndIndex;
  const held = trade.exitIndex !== null ? trade.exitIndex - trade.entryIndex : 0;
  const recovery = returnPercent < 0 ? recoveryAfterExit(trade, data.candles) : null;
  const missed = returnPercent > 0 ? missedAfterExit(trade, data.candles) : null;

  if (trade.outcome === "liquidated") {
    if (pattern && isAgainst(trade, pattern)) {
      return {
        emoji: "💀",
        trade: number,
        title: `${label} into a ${name}`,
        body: `A ${name} is a ${biasWord(pattern.bias)} pattern. You ${sideVerb(trade)} at ${trade.leverage}x anyway. The chart drew you a picture and you still got it wrong.`,
      };
    }
    if (recovery) {
      return {
        emoji: "💀",
        trade: number,
        title: `${label}, liquidated`,
        body: `Liquidated after ${held} candles. Price came back ${recovery.index - (trade.exitIndex ?? 0)} candles later, which is the market's way of saying "lol".`,
      };
    }
    return {
      emoji: "💀",
      trade: number,
      title: `${label}, liquidated`,
      body: pick([
        `Wiped out in ${held} candles. Your broker didn't even have time to call.`,
        `${trade.leverage}x leverage means a ${(100 / trade.leverage).toFixed(1)}% move ends you. It moved ${(100 / trade.leverage).toFixed(1)}%.`,
        `Liquidated in ${held} candles. A goldfish holds a position longer than that.`,
      ]),
    };
  }

  if (returnPercent < 0) {
    if (pattern && isAgainst(trade, pattern)) {
      return {
        emoji: "🤡",
        trade: number,
        title: `Fought the ${name}`,
        body: `It was a textbook ${name}${forming ? " forming right in front of you" : ", already breaking out"}. That's ${biasWord(pattern.bias)}. You ${sideVerb(trade)}. ${formatPercent(returnPercent)}.`,
      };
    }
    if (recovery) {
      return {
        emoji: "🧻",
        trade: number,
        title: "Paper hands",
        body: `Panic-closed at ${formatPercent(returnPercent)}. ${recovery.index - (trade.exitIndex ?? 0)} candles later it was back past your entry. Patience is free, you know.`,
      };
    }
    if (!pattern) {
      return {
        emoji: "☁️",
        trade: number,
        title: "Traded pure noise",
        body: `There was no pattern there. You saw a bunny in the clouds and ${sideVerb(trade)} ${trade.spot ? "with the rent money" : `at ${trade.leverage}x`}. ${formatPercent(returnPercent)}.`,
      };
    }
    if (trade.outcome === "bell") {
      return {
        emoji: "🛍️",
        trade: number,
        title: "Held the bag to the bell",
        body: `Sat in a losing ${label} until time ran out, hoping. Hope is not a strategy. ${formatPercent(returnPercent)}.`,
      };
    }
    if (isWith(trade, pattern)) {
      return {
        emoji: "🫠",
        trade: number,
        title: "Right idea, still lost",
        body: `You read the ${name} correctly and still lost money on it. Honestly, that takes talent. ${formatPercent(returnPercent)}.`,
      };
    }
    return {
      emoji: "📉",
      trade: number,
      title: `${label} into a ${name}`,
      body: `A ${name} goes nowhere on purpose. You paid ${formatPercent(returnPercent)} to find out.`,
    };
  }

  if (returnPercent > 0) {
    if (missed && missed.percent > Math.max(10, returnPercent * 0.5)) {
      return {
        emoji: "🏃",
        trade: number,
        title: "Left early",
        body: `Took ${formatPercent(returnPercent)} and ran. It kept going for another ${formatPercent(missed.percent)} without you.`,
      };
    }
    if (pattern && isAgainst(trade, pattern)) {
      return {
        emoji: "🎰",
        trade: number,
        title: "Wrong, but paid",
        body: `You ${sideVerb(trade)} a ${biasWord(pattern.bias)} ${name} and made ${formatPercent(returnPercent)}. This is the worst thing that could have happened to you.`,
      };
    }
    if (pattern && isWith(trade, pattern)) {
      return {
        emoji: "🕰️",
        trade: number,
        title: "Even a broken clock",
        body: `${label} on a ${name}, ${formatPercent(returnPercent)}. Correct, for once. Don't let it go to your head. It will.`,
      };
    }
    return {
      emoji: "🍀",
      trade: number,
      title: "Pure luck",
      body: `No pattern, no plan, ${formatPercent(returnPercent)}. The market is setting you up for something.`,
    };
  }

  return {
    emoji: "😐",
    trade: number,
    title: "Breakeven",
    body: "Opened a trade, closed it for nothing. A lot of effort to stay exactly where you were.",
  };
};

const roastRound = (data: RoundReviewData): ReviewFinding[] => {
  const findings: ReviewFinding[] = [];
  const leveraged = data.trades.filter((trade) => !trade.spot);
  const maxLeverage = leveraged.reduce((max, trade) => Math.max(max, trade.leverage), 0);

  if (maxLeverage >= 50) {
    findings.push({
      emoji: "🎢",
      title: `${maxLeverage}x leverage`,
      body: "The maximum. Because 25x felt like cowardice.",
    });
  }
  if (data.trades.length >= 8) {
    findings.push({
      emoji: "⌨️",
      title: "Overtrading",
      body: `${data.trades.length} trades in one round. That's not trading, that's tapping.`,
    });
  }

  // The move that was right there: a pattern that ran during the round while the player was flat.
  const roundStart = data.trades[0]?.entryIndex ?? data.roundEndIndex;
  const missedPattern = data.patterns.find((pattern) => {
    const breakout = pattern.formationEndIndex + 1;
    if (pattern.bias === "neutral" || breakout < roundStart || breakout > data.roundEndIndex) {
      return false;
    }
    return !data.trades.some(
      (trade) => trade.entryIndex <= pattern.endIndex && (trade.exitIndex ?? data.roundEndIndex) >= breakout && isWith(trade, pattern),
    );
  });
  if (missedPattern) {
    findings.push({
      emoji: "👀",
      title: `Missed the ${missedPattern.label}`,
      body: `A ${biasWord(missedPattern.bias)} ${missedPattern.label} broke out during your round and you weren't on it. It's highlighted above, for your shame.`,
    });
  }
  return findings;
};

const verdictFor = (data: RoundReviewData): ReviewVerdict => {
  if (data.liquidated) {
    return pick([
      { title: "What went wrong", subtitle: "A forensic investigation into your choices.", stamp: "NOT STONKS", stonks: false },
      { title: "Crime scene", subtitle: "Please do not touch the evidence.", stamp: "REKT", stonks: false },
      { title: "The autopsy", subtitle: "Cause of death: leverage.", stamp: "NOT STONKS", stonks: false },
    ]);
  }
  if (data.percent < 0) {
    return pick([
      { title: "What went wrong", subtitle: "Spoiler: it was you.", stamp: "SKILL ISSUE", stonks: false },
      { title: "Post-mortem", subtitle: "We looked at the tape. It's not the market.", stamp: "NOT STONKS", stonks: false },
      { title: "Exhibit A", subtitle: "The prosecution rests.", stamp: "SKILL ISSUE", stonks: false },
    ]);
  }
  if (data.percent > 0) {
    return pick([
      { title: "How did that work?", subtitle: "Investigators are still baffled.", stamp: "STONKS", stonks: true },
      { title: "Suspiciously green", subtitle: "We checked. It was mostly luck.", stamp: "LUCK", stonks: true },
      { title: "The replay", subtitle: "Watch closely. Nobody, including you, knows why this worked.", stamp: "STONKS", stonks: true },
    ]);
  }
  return { title: "The replay", subtitle: "You traded and nothing happened. Impressive in its own way.", stamp: "MEH", stonks: false };
};

export const analyzeRound = (data: RoundReviewData): RoundReviewAnalysis => {
  const findings = data.trades.map((trade, index) => roastTrade(trade, index + 1, data));
  // Long rounds would bury the summary; keep the worst few trades and the round-level roasts.
  const ranked = findings
    .map((finding, index) => ({ finding, returnPercent: tradeReturnPercent(data.trades[index]) }))
    .sort((a, b) => a.returnPercent - b.returnPercent)
    .slice(0, 4)
    .sort((a, b) => (a.finding.trade ?? 0) - (b.finding.trade ?? 0))
    .map((entry) => entry.finding);

  const callouts: ReviewCallout[] = [];
  const worst = data.trades.reduce<{ trade: ReviewTrade; returnPercent: number } | null>((acc, trade) => {
    const returnPercent = tradeReturnPercent(trade);
    return !acc || returnPercent < acc.returnPercent ? { trade, returnPercent } : acc;
  }, null);
  if (worst && worst.returnPercent < 0) {
    const verb = worst.trade.side === "short" ? "shorted" : "bought";
    callouts.push({ index: worst.trade.entryIndex, price: worst.trade.entryPrice, text: `you ${verb} here 🤡`, tone: "bad" });
    const recovery = worst.trade.outcome !== "bell" ? recoveryAfterExit(worst.trade, data.candles) : null;
    if (recovery) {
      callouts.push({ index: recovery.index, price: recovery.close, text: "it came back here", tone: "neutral" });
    }
  } else {
    const best = data.trades.reduce<{ trade: ReviewTrade; returnPercent: number } | null>((acc, trade) => {
      const returnPercent = tradeReturnPercent(trade);
      return !acc || returnPercent > acc.returnPercent ? { trade, returnPercent } : acc;
    }, null);
    if (best && best.returnPercent > 0) {
      callouts.push({ index: best.trade.entryIndex, price: best.trade.entryPrice, text: "lucky guess 🍀", tone: "good" });
    }
  }

  return { verdict: verdictFor(data), findings: [...ranked, ...roastRound(data)], callouts };
};
