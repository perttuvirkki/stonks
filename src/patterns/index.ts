import type { Candle, PatternDefinition, PatternLine, PatternResult } from "../types";
import { BASE_PRICE, MAX_PRICE, MIN_PRICE } from "../constants";
import { clamp } from "../utils";
import {
  ascendingBroadeningWedgePattern,
  ascendingTrianglePattern,
  ascendingWedgePattern,
  descendingBroadeningWedgePattern,
  descendingTrianglePattern,
  descendingWedgePattern,
} from "./triangles";
import { bearFlagPattern, bearPennantPattern, bearRectanglePattern, bullFlagPattern, bullPennantPattern, bullRectanglePattern } from "./continuations";
import {
  cupAndHandlePattern,
  diamondBottomPattern,
  diamondTopPattern,
  doubleBottomPattern,
  doubleTopPattern,
  headAndShouldersPattern,
  inverseCupAndHandlePattern,
  reverseHeadAndShouldersPattern,
} from "./reversals";
import { rangePattern } from "./range";

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

// Safety net around the generators: a bad start price (NaN, out of range) or a value the
// engine clips at the price limits must never reach the chart as an invalid candle.

const safePatternStart = (startPrice: number) => {
  const edgeMargin = Math.max(1, (MAX_PRICE - MIN_PRICE) * 0.01);
  const fallback = clamp(BASE_PRICE, MIN_PRICE + edgeMargin, MAX_PRICE - edgeMargin);
  return clamp(Number.isFinite(startPrice) ? startPrice : fallback, MIN_PRICE + edgeMargin, MAX_PRICE - edgeMargin);
};

const safePrice = (value: number, fallback: number) => clamp(Number.isFinite(value) ? value : fallback, MIN_PRICE, MAX_PRICE);

const normalizeCandles = (candles: Candle[], startPrice: number) => {
  let previousClose = startPrice;
  return candles.map((candle) => {
    const open = safePrice(candle.open, previousClose);
    const close = safePrice(candle.close, open);
    const high = Math.max(safePrice(candle.high, Math.max(open, close)), open, close);
    const low = Math.min(safePrice(candle.low, Math.min(open, close)), open, close);
    previousClose = close;
    return { ...candle, open, close, high, low };
  });
};

const normalizeLine = (line: PatternLine, fallbackPrice: number): PatternLine => ({
  ...line,
  points: line.points.map((point) => ({ offset: Math.max(0, Math.round(point.offset)), price: safePrice(point.price, fallbackPrice) })),
  revealOffset: Math.max(0, Math.round(line.revealOffset)),
  extendBy: Math.max(0, Math.round(line.extendBy)),
});

const normalizeResult = (result: PatternResult, startPrice: number): PatternResult => {
  const candles = normalizeCandles(result.candles, startPrice);
  const formationEnd = candles.at(-1)?.close ?? startPrice;
  const runout = normalizeCandles(result.runout, formationEnd);
  return {
    candles,
    runout,
    targetPrice: safePrice(result.targetPrice, runout.at(-1)?.close ?? formationEnd),
    breakoutPrice: safePrice(result.breakoutPrice, formationEnd),
    lines: result.lines.filter((line) => line.points.length >= 2).map((line) => normalizeLine(line, startPrice)),
  };
};

const makeSafePattern = (pattern: PatternDefinition): PatternDefinition => ({
  ...pattern,
  generate: (startPrice) => {
    const start = safePatternStart(startPrice);
    return normalizeResult(pattern.generate(start), start);
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

  const finitePrice = Number.isFinite(currentPrice) ? currentPrice : BASE_PRICE;
  // Near the price ceiling a bullish pattern would get clipped; only let price fall from there.
  const nearCeiling = finitePrice > MAX_PRICE * 0.85 && source.some((pattern) => pattern.bias !== "bullish");

  // Normalize each side independently because BASE_PRICE is intentionally not
  // the midpoint. At BASE_PRICE every pattern is equally likely; near either
  // price boundary, patterns pointing back toward the playable range gain weight.
  const spanDown = Math.max(1, BASE_PRICE - MIN_PRICE);
  const spanUp = Math.max(1, MAX_PRICE - BASE_PRICE);
  const centered = clamp(
    finitePrice < BASE_PRICE ? (finitePrice - BASE_PRICE) / spanDown : (finitePrice - BASE_PRICE) / spanUp,
    -1,
    1,
  );
  const directionalBias = 0.8;
  const weights = source.map((pattern) => {
    if (pattern.bias === "bullish") return nearCeiling ? 0 : 1 - directionalBias * centered;
    if (pattern.bias === "bearish") return 1 + directionalBias * centered;
    return 1;
  });

  return pickWeighted(source, weights, random);
};
