import type { PatternDefinition } from "../types";
import { MAX_PRICE, MIN_PRICE } from "../constants";
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
import { ascendingWedgePattern } from "./ascendingWedge";
import { descendingWedgePattern } from "./descendingWedge";
import { ascendingBroadeningWedgePattern } from "./ascendingBroadeningWedge";
import { descendingBroadeningWedgePattern } from "./descendingBroadeningWedge";
import { bullRectanglePattern } from "./bullRectangle";
import { bearRectanglePattern } from "./bearRectangle";
import { diamondTopPattern } from "./diamondTop";
import { diamondBottomPattern } from "./diamondBottom";

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

const pickRandom = (patterns: PatternDefinition[]) => patterns[Math.floor(Math.random() * patterns.length)];

export const choosePattern = (currentPrice: number, enabledIds?: string[]) => {
  const source = enabledIds && enabledIds.length ? allPatterns.filter((pattern) => enabledIds.includes(pattern.id)) : allPatterns;
  if (source.length === 0) {
    return null;
  }

  const bullish = source.filter((pattern) => bullishPatternIds.has(pattern.id));
  const bearish = source.filter((pattern) => bearishPatternIds.has(pattern.id));
  const fallback = pickRandom(source);

  if (!Number.isFinite(currentPrice) || bullish.length === 0 || bearish.length === 0) {
    return fallback;
  }

  const range = Math.max(1, MAX_PRICE - MIN_PRICE);
  const normalized = Math.max(0, Math.min(1, (currentPrice - MIN_PRICE) / range));
  const bearishWeight = 0.1 + 0.8 * normalized;
  const roll = Math.random();
  if (roll < bearishWeight) {
    return pickRandom(bearish);
  }
  return pickRandom(bullish);
};
