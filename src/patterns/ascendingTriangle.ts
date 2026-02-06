import type { Candle, PatternDefinition, PatternLine, PatternResult } from "../types";
import { MAX_PRICE, MIN_PRICE } from "../constants";
import { clamp } from "../utils";

const PATTERN_LENGTH = 72;
const HIT_MIN = 3;
const HIT_MAX = 6;

const buildPivotIndices = (length: number, pivotCount: number): number[] => {
  if (pivotCount <= 1) {
    return [0];
  }
  const gaps = pivotCount - 1;
  const total = Math.max(1, length - 1);
  const baseGap = Math.max(1, Math.floor(total / gaps));
  const remainder = total - baseGap * gaps;
  const bonusSlots = new Set<number>();
  while (bonusSlots.size < remainder) {
    bonusSlots.add(Math.floor(Math.random() * gaps));
  }
  const gapSizes: number[] = [];
  for (let i = 0; i < gaps; i += 1) {
    gapSizes.push(baseGap + (bonusSlots.has(i) ? 1 : 0));
  }

  const indices: number[] = [0];
  let index = 0;
  for (const gap of gapSizes) {
    index += gap;
    indices.push(index);
  }
  return indices;
};

const generateAscendingTriangle = (
  startPrice: number,
  length: number
): { candles: Candle[]; resistance: number; lowStart: number; lowEnd: number } => {
  const pct = (value: number) => startPrice * value;
  const minPad = pct(0.015);
  const resistance = clamp(startPrice * 1.02, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const lowStart = clamp(startPrice * 0.987, MIN_PRICE + minPad, resistance - pct(0.015));
  const lowEndCandidate = clamp(startPrice * 1.012, MIN_PRICE + minPad, resistance - pct(0.008));
  const lowEnd = clamp(lowEndCandidate, lowStart + pct(0.008), resistance - pct(0.008));
  const edgeBuffer = pct(0.0009);
  const wickUnit = pct(0.0016);
  const noiseUnit = pct(0.0006);
  const swingPeriod = 2 + Math.floor(Math.random() * 3);
  const swingUnit = edgeBuffer * 4;
  const counterChance = 0.35;
  const candles: Candle[] = [];
  let previousClose = startPrice;
  let drift = 0;
  const touchCount = HIT_MIN + Math.floor(Math.random() * (HIT_MAX - HIT_MIN + 1));
  const pivotCount = touchCount * 2;
  const pivotIndices = buildPivotIndices(length, pivotCount);
  const pivotTypes: Array<"support" | "resistance"> = [];
  for (let i = 0; i < pivotIndices.length; i += 1) {
    if (i === 0) {
      pivotTypes.push("support");
      continue;
    }
    const prev = pivotTypes[i - 1];
    const alternate = prev === "resistance" ? "support" : "resistance";
    pivotTypes.push(Math.random() < 0.18 ? prev : alternate);
  }
  const pivotPrices = pivotIndices.map((index, idx) => {
    const progress = length === 1 ? 1 : index / (length - 1);
    const support = lowStart + (lowEnd - lowStart) * progress;
    if (pivotTypes[idx] === "support") {
      return clamp(support + edgeBuffer + Math.random() * edgeBuffer, support + edgeBuffer * 0.3, resistance - pct(0.01));
    }
    return resistance - (edgeBuffer + Math.random() * edgeBuffer);
  });
  const pivotLookup = new Map<number, "support" | "resistance">(pivotIndices.map((index, idx) => [index, pivotTypes[idx]]));

  let segmentIndex = 0;
  for (let index = 0; index < length; index += 1) {
    while (segmentIndex < pivotIndices.length - 2 && index > pivotIndices[segmentIndex + 1]) {
      segmentIndex += 1;
    }
    const startIndex = pivotIndices[segmentIndex];
    const endIndex = pivotIndices[segmentIndex + 1] ?? startIndex;
    const startPrice = pivotPrices[segmentIndex];
    const endPrice = pivotPrices[segmentIndex + 1] ?? startPrice;
    const segmentProgress = endIndex === startIndex ? 0 : (index - startIndex) / (endIndex - startIndex);

    const progress = length === 1 ? 1 : index / (length - 1);
    const support = lowStart + (lowEnd - lowStart) * progress;
    const lowerBound = support + edgeBuffer;
    const upperBound = resistance - edgeBuffer;
    const open = previousClose;
    const target = startPrice + (endPrice - startPrice) * segmentProgress;
    const noise = (Math.random() - 0.5) * noiseUnit;
    let closeTarget = target + noise;

    const pivotType = pivotLookup.get(index);
    if (!pivotType) {
      const swing = Math.sin((index / swingPeriod) * Math.PI) * swingUnit;
      drift += (Math.random() - 0.5) * edgeBuffer * 1.4;
      drift = clamp(drift, -edgeBuffer * 2.4, edgeBuffer * 2.4);
      closeTarget += swing + drift + (Math.random() - 0.5) * edgeBuffer * 1.2;
      if (Math.random() < counterChance) {
        const pullback = 0.4 + Math.random() * 0.5;
        closeTarget = open - (closeTarget - open) * pullback;
      }
    }
    if (pivotType) {
      const forceTouch = Math.random() < 0.62;
      if (forceTouch && pivotType === "support") {
        closeTarget = lowerBound + Math.random() * (edgeBuffer * 1.2);
      } else if (forceTouch && pivotType === "resistance") {
        closeTarget = upperBound - Math.random() * (edgeBuffer * 1.2);
      }
    }

    const close = clamp(closeTarget, lowerBound, upperBound);
    let high = Math.max(open, close) + Math.random() * wickUnit;
    let low = Math.min(open, close) - Math.random() * wickUnit;

    if (pivotType && Math.random() < 0.55) {
      if (pivotType === "resistance") {
        high = resistance + Math.random() * edgeBuffer;
      }
      if (pivotType === "support") {
        low = support - Math.random() * edgeBuffer;
      }
    }

    high = clamp(Math.max(high, open, close), lowerBound, resistance + edgeBuffer * 1.4);
    low = clamp(Math.min(low, open, close), support - edgeBuffer * 1.4, upperBound);

    candles.push({
      id: `${Date.now()}-${index}-${Math.floor(Math.random() * 10000)}`,
      open,
      close,
      high,
      low,
    });

    previousClose = close;
  }

  return { candles, resistance, lowStart, lowEnd };
};

export const ascendingTrianglePattern: PatternDefinition = {
  id: "ascending-triangle",
  label: "Ascending Triangle",
  length: PATTERN_LENGTH,
  generate: (startPrice): PatternResult => {
    const { candles, resistance, lowStart, lowEnd } = generateAscendingTriangle(startPrice, PATTERN_LENGTH);
    const height = resistance - lowStart;
    const targetPrice = clamp(resistance + height, MIN_PRICE, MAX_PRICE);
    const lines: PatternLine[] = [
      {
        id: "ascending-triangle-resistance",
        type: "resistance",
        startOffset: 0,
        endOffset: PATTERN_LENGTH - 1,
        startPrice: resistance,
        endPrice: resistance,
      },
      {
        id: "ascending-triangle-support",
        type: "support",
        startOffset: 0,
        endOffset: PATTERN_LENGTH - 1,
        startPrice: lowStart,
        endPrice: lowEnd,
      },
    ];

    return {
      candles,
      targetPrice,
      lines,
    };
  },
};
