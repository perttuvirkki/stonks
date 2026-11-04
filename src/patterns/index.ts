import type { Candle, PatternDefinition, PatternDirection, PatternLine, PatternResult } from "../types";
import { BASE_PRICE, MAX_PRICE, MIN_PRICE } from "../constants";
import { clamp } from "../utils";
import { ascendingTrianglePattern } from "./ascendingTriangle";
import { descendingTrianglePattern } from "./descendingTriangle";
import { headAndShouldersPattern } from "./headAndShoulders";
import { reverseHeadAndShouldersPattern } from "./reverseHeadAndShoulders";
import { cupAndHandlePattern } from "./cupAndHandle";
import { inverseCupAndHandlePattern } from "./inverseCupAndHandle";
import { bullFlagPattern } from "./bullFlag";
import { bearFlagPattern } from "./bearFlag";
import { bullPennantPattern } from "./bullPennant";
import { bearPennantPattern } from "./bearPennant";
import { doubleTopPattern } from "./doubleTop";
import { doubleBottomPattern } from "./doubleBottom";
import { ascendingWedgePattern } from "./ascendingWedge";
import { descendingWedgePattern } from "./descendingWedge";
import { ascendingBroadeningWedgePattern } from "./ascendingBroadeningWedge";
import { descendingBroadeningWedgePattern } from "./descendingBroadeningWedge";
import { bullRectanglePattern } from "./bullRectangle";
import { bearRectanglePattern } from "./bearRectangle";
import { diamondTopPattern } from "./diamondTop";
import { diamondBottomPattern } from "./diamondBottom";
import { rangePattern } from "./range";
import { enhancePatternCandles } from "./realism";

const rawPatterns: PatternDefinition[] = [
  ascendingTrianglePattern,
  descendingTrianglePattern,
  ascendingWedgePattern,
  descendingWedgePattern,
  ascendingBroadeningWedgePattern,
  descendingBroadeningWedgePattern,
  headAndShouldersPattern,
  reverseHeadAndShouldersPattern,
  cupAndHandlePattern,
  inverseCupAndHandlePattern,
  bullFlagPattern,
  bearFlagPattern,
  bullRectanglePattern,
  bearRectanglePattern,
  diamondTopPattern,
  diamondBottomPattern,
  bullPennantPattern,
  bearPennantPattern,
  doubleTopPattern,
  doubleBottomPattern,
  rangePattern,
];

const bullishPatternIds = new Set([
  "ascending-triangle",
  "descending-wedge",
  "descending-broadening-wedge",
  "reverse-head-and-shoulders",
  "cup-and-handle",
  "bull-flag",
  "bull-rectangle",
  "diamond-bottom",
  "bull-pennant",
  "double-bottom",
]);

const bearishPatternIds = new Set([
  "descending-triangle",
  "ascending-wedge",
  "ascending-broadening-wedge",
  "head-and-shoulders",
  "inverse-cup-and-handle",
  "bear-flag",
  "bear-rectangle",
  "diamond-top",
  "bear-pennant",
  "double-top",
]);

const getDirection = (patternId: string): PatternDirection => {
  if (bullishPatternIds.has(patternId)) return "bullish";
  if (bearishPatternIds.has(patternId)) return "bearish";
  return "neutral";
};

const safePatternStart = (startPrice: number) => {
  const span = MAX_PRICE - MIN_PRICE;
  const edgeMargin = Math.max(1, span * 0.01);
  const fallback = clamp(BASE_PRICE, MIN_PRICE + edgeMargin, MAX_PRICE - edgeMargin);
  return clamp(Number.isFinite(startPrice) ? startPrice : fallback, MIN_PRICE + edgeMargin, MAX_PRICE - edgeMargin);
};

const safePrice = (value: number, fallback: number) => clamp(Number.isFinite(value) ? value : fallback, MIN_PRICE, MAX_PRICE);

const normalizeCandle = (candle: Candle, fallbackPrice: number, patternId: string, index: number): Candle => {
  const open = safePrice(candle.open, fallbackPrice);
  const close = safePrice(candle.close, open);
  const low = safePrice(candle.low, Math.min(open, close));
  const high = safePrice(candle.high, Math.max(open, close));

  return {
    ...candle,
    id: `${patternId}-${index}-${candle.id}`,
    open,
    close,
    low: Math.min(low, open, close),
    high: Math.max(high, open, close),
  };
};

const normalizeLine = (line: PatternLine, candleCount: number, fallbackPrice: number): PatternLine => {
  const maxOffset = Math.max(0, candleCount - 1);
  const startOffset = clamp(Number.isFinite(line.startOffset) ? Math.round(line.startOffset) : 0, 0, maxOffset);
  const endOffset = clamp(Number.isFinite(line.endOffset) ? Math.round(line.endOffset) : maxOffset, startOffset, maxOffset);

  return {
    ...line,
    startOffset,
    endOffset,
    startPrice: safePrice(line.startPrice, fallbackPrice),
    endPrice: safePrice(line.endPrice, fallbackPrice),
  };
};

const normalizeResult = (result: PatternResult, startPrice: number, patternId: string): PatternResult => {
  let previousClose = startPrice;
  const realisticCandles = enhancePatternCandles(result.candles, startPrice);
  const candles = realisticCandles.map((candle, index) => {
    const normalized = normalizeCandle(candle, previousClose, patternId, index);
    previousClose = normalized.close;
    return normalized;
  });
  const fallbackTarget = candles.at(-1)?.close ?? startPrice;

  return {
    candles,
    targetPrice: safePrice(result.targetPrice, fallbackTarget),
    lines: result.lines?.map((line) => normalizeLine(line, candles.length, startPrice)),
  };
};

const makeSafePattern = (pattern: PatternDefinition): PatternDefinition => ({
  ...pattern,
  direction: getDirection(pattern.id),
  generate: (startPrice) => {
    const normalizedStart = safePatternStart(startPrice);
    return normalizeResult(pattern.generate(normalizedStart), normalizedStart, pattern.id);
  },
});

export const allPatterns: PatternDefinition[] = rawPatterns.map(makeSafePattern);

const normalizeRoll = (random: () => number) => {
  const roll = random();
  return Number.isFinite(roll) ? clamp(roll, 0, 1 - Number.EPSILON) : 0.5;
};

const pickWeighted = (patterns: PatternDefinition[], weights: number[], random: () => number) => {
  const totalWeight = weights.reduce((total, weight) => total + Math.max(0, weight), 0);
  if (totalWeight <= 0) return patterns[0];

  let threshold = normalizeRoll(random) * totalWeight;
  for (let index = 0; index < patterns.length; index += 1) {
    threshold -= Math.max(0, weights[index]);
    if (threshold < 0) return patterns[index];
  }
  return patterns[patterns.length - 1];
};

export const choosePattern = (currentPrice: number, enabledIds?: string[], random: () => number = Math.random) => {
  const enabledSet = enabledIds ? new Set(enabledIds) : null;
  const source = enabledSet ? allPatterns.filter((pattern) => enabledSet.has(pattern.id)) : allPatterns;
  if (source.length === 0) {
    return null;
  }

  // Normalize each side independently because BASE_PRICE is intentionally not
  // the midpoint. At BASE_PRICE every pattern is equally likely; near either
  // price boundary, patterns pointing back toward the playable range gain weight.
  const spanDown = Math.max(1, BASE_PRICE - MIN_PRICE);
  const spanUp = Math.max(1, MAX_PRICE - BASE_PRICE);
  const finitePrice = Number.isFinite(currentPrice) ? currentPrice : BASE_PRICE;
  const centered = clamp(
    finitePrice < BASE_PRICE ? (finitePrice - BASE_PRICE) / spanDown : (finitePrice - BASE_PRICE) / spanUp,
    -1,
    1,
  );
  const directionalBias = 0.8;
  const weights = source.map((pattern) => {
    if (pattern.direction === "bullish") return 1 - directionalBias * centered;
    if (pattern.direction === "bearish") return 1 + directionalBias * centered;
    return 1;
  });

  return pickWeighted(source, weights, random);
};
