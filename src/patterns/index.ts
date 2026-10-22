import type { PatternDefinition } from "../types";
import { BASE_PRICE, MAX_PRICE, MIN_PRICE } from "../constants";
import {
  ascendingBroadeningWedgePattern,
  ascendingTrianglePattern,
  ascendingWedgePattern,
  descendingBroadeningWedgePattern,
  descendingTrianglePattern,
  descendingWedgePattern,
  symmetricalTrianglePattern,
} from "./triangles";
import {
  bearFlagPattern,
  bearPennantPattern,
  bearRectanglePattern,
  bullFlagPattern,
  bullPennantPattern,
  bullRectanglePattern,
  fallingChannelPattern,
  risingChannelPattern,
} from "./continuations";
import {
  cupAndHandlePattern,
  diamondBottomPattern,
  diamondTopPattern,
  doubleBottomPattern,
  doubleTopPattern,
  headAndShouldersPattern,
  inverseCupAndHandlePattern,
  reverseHeadAndShouldersPattern,
  roundingBottomPattern,
  roundingTopPattern,
  tripleBottomPattern,
  tripleTopPattern,
} from "./reversals";
import { rangePattern } from "./range";

export const allPatterns: PatternDefinition[] = [
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
  tripleTopPattern,
  tripleBottomPattern,
  symmetricalTrianglePattern,
  risingChannelPattern,
  fallingChannelPattern,
  roundingTopPattern,
  roundingBottomPattern,
  rangePattern,
];

const pickRandom = (patterns: PatternDefinition[]) => patterns[Math.floor(Math.random() * patterns.length)];

export const choosePattern = (currentPrice: number, enabledIds?: string[]) => {
  const source = enabledIds && enabledIds.length ? allPatterns.filter((pattern) => enabledIds.includes(pattern.id)) : allPatterns;
  if (source.length === 0) {
    return null;
  }

  const bullish = source.filter((pattern) => pattern.bias === "bullish");
  const bearish = source.filter((pattern) => pattern.bias === "bearish");
  const neutral = source.filter((pattern) => pattern.bias === "neutral");

  if (!Number.isFinite(currentPrice) || bullish.length === 0 || bearish.length === 0) {
    return pickRandom(source);
  }
  // Near the price ceiling a bullish pattern would get clipped; only let price fall from there.
  if (currentPrice > MAX_PRICE * 0.85) {
    return pickRandom(bearish);
  }
  // Neutral patterns (the range) get their fair share instead of never showing up.
  if (neutral.length && Math.random() < neutral.length / source.length) {
    return pickRandom(neutral);
  }

  // Bias should "center" around BASE_PRICE (not MIN/MAX midpoint).
  // At BASE_PRICE => bearishWeight ~= 0.5 (neutral).
  // Towards MAX_PRICE => bearishWeight trends towards 0.9 (more bearish patterns).
  // Towards MIN_PRICE => bearishWeight trends towards 0.1 (more bullish patterns).
  const spanDown = Math.max(1, BASE_PRICE - MIN_PRICE);
  const spanUp = Math.max(1, MAX_PRICE - BASE_PRICE);
  const span = Math.max(spanDown, spanUp);
  const centered = Math.max(-1, Math.min(1, (currentPrice - BASE_PRICE) / span));
  const bearishWeight = 0.5 + 0.4 * centered;
  const roll = Math.random();
  if (roll < bearishWeight) {
    return pickRandom(bearish);
  }
  return pickRandom(bullish);
};
