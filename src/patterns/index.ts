import type { PatternDefinition } from '../types';
import { MAX_PRICE, MIN_PRICE } from '../constants';
import { ascendingTrianglePattern } from './ascendingTriangle';
import { descendingTrianglePattern } from './descendingTriangle';
import { headAndShouldersPattern } from './headAndShoulders';
import { reverseHeadAndShouldersPattern } from './reverseHeadAndShoulders';
import { cupAndHandlePattern } from './cupAndHandle';
import { bullFlagPattern } from './bullFlag';
import { bearFlagPattern } from './bearFlag';
import { bullPennantPattern } from './bullPennant';
import { bearPennantPattern } from './bearPennant';
import { doubleTopPattern } from './doubleTop';

export const allPatterns: PatternDefinition[] = [
  ascendingTrianglePattern,
  descendingTrianglePattern,
  headAndShouldersPattern,
  reverseHeadAndShouldersPattern,
  cupAndHandlePattern,
  bullFlagPattern,
  bearFlagPattern,
  bullPennantPattern,
  bearPennantPattern,
  doubleTopPattern,
];

const bullishPatternIds = new Set([
  'ascending-triangle',
  'reverse-head-and-shoulders',
  'cup-and-handle',
  'bull-flag',
  'bull-pennant',
]);

const bearishPatternIds = new Set([
  'descending-triangle',
  'head-and-shoulders',
  'bear-flag',
  'bear-pennant',
  'double-top',
]);

const pickRandom = (patterns: PatternDefinition[]) =>
  patterns[Math.floor(Math.random() * patterns.length)];

export const choosePattern = (currentPrice: number, enabledIds?: string[]) => {
  const source =
    enabledIds && enabledIds.length
      ? allPatterns.filter((pattern) => enabledIds.includes(pattern.id))
      : allPatterns;
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
  const normalized = Math.max(
    0,
    Math.min(1, (currentPrice - MIN_PRICE) / range),
  );
  const bearishWeight = 0.1 + 0.8 * normalized;
  const roll = Math.random();
  if (roll < bearishWeight) {
    return pickRandom(bearish);
  }
  return pickRandom(bullish);
};
