import type { Candle, PatternDefinition, PatternLine, PatternResult } from "../types";
import { MAX_PRICE, MIN_PRICE } from "../constants";
import { clamp } from "../utils";

const PATTERN_LENGTH = 128;

const buildPivotIndices = (length: number, fractions: number[]): number[] => {
  const maxIndex = Math.max(0, length - 1);
  const indices: number[] = [];
  let last = -1;
  for (const fraction of fractions) {
    const raw = Math.round(fraction * maxIndex);
    const clamped = Math.max(0, Math.min(maxIndex, raw));
    const next = clamped <= last ? Math.min(maxIndex, last + 1) : clamped;
    if (next > maxIndex) {
      break;
    }
    indices.push(next);
    last = next;
  }
  if (indices[indices.length - 1] !== maxIndex) {
    indices[indices.length - 1] = maxIndex;
  }
  return indices;
};

const generateReverseHeadAndShoulders = (
  startPrice: number,
  length: number
): {
  candles: Candle[];
  necklineStart: number;
  necklineEnd: number;
  shoulderLeft: number;
  shoulderRight: number;
  head: number;
} => {
  const pct = (value: number) => startPrice * value;
  const minPad = pct(0.015);
  const necklineStart = clamp(startPrice * 1.02, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const necklineEnd = clamp(startPrice * 1.025, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const shoulderLeftMax = Math.max(MIN_PRICE + minPad, necklineStart - pct(0.012));
  const shoulderLeft = clamp(startPrice * 0.975, MIN_PRICE + minPad, shoulderLeftMax);
  const shoulderRightMax = Math.max(MIN_PRICE + minPad, necklineEnd - pct(0.01));
  const shoulderRight = clamp(startPrice * 0.978, MIN_PRICE + minPad, shoulderRightMax);
  const headMax = Math.max(MIN_PRICE + minPad, Math.min(shoulderLeft, shoulderRight) - pct(0.006));
  const head = clamp(startPrice * 0.95, MIN_PRICE + minPad, headMax);
  const edgeBuffer = pct(0.0009);
  const wickUnit = pct(0.0016);
  const noiseUnit = pct(0.0006);
  const swingPeriod = 2 + Math.floor(Math.random() * 3);
  const swingUnit = edgeBuffer * 3.6;
  const counterChance = 0.35;

  const fractions = [0, 0.14, 0.28, 0.46, 0.6, 0.76, 0.88, 1];
  const pivotIndices = buildPivotIndices(length, fractions);
  const pivotTypes: Array<"support" | "resistance"> = [
    "resistance",
    "support",
    "resistance",
    "support",
    "resistance",
    "support",
    "resistance",
    "resistance",
  ];
  const headIndex = 3;
  const headPivotIndex = pivotIndices[headIndex] ?? 0;

  const necklineAt = (progress: number) => necklineStart + (necklineEnd - necklineStart) * progress;

  const pivotPrices = pivotIndices.map((index, idx) => {
    const progress = length === 1 ? 1 : index / (length - 1);
    const neckline = necklineAt(progress);
    if (pivotTypes[idx] === "resistance") {
      return neckline - edgeBuffer * (0.2 + Math.random() * 0.5);
    }
    const support = idx === headIndex ? head : idx < headIndex ? shoulderLeft : shoulderRight;
    return support + edgeBuffer * (0.2 + Math.random() * 0.5);
  });
  const pivotLookup = new Map<number, "support" | "resistance">(pivotIndices.map((index, idx) => [index, pivotTypes[idx]]));

  const candles: Candle[] = [];
  let previousClose = startPrice;
  let segmentIndex = 0;
  let drift = 0;

  for (let index = 0; index < length; index += 1) {
    while (segmentIndex < pivotIndices.length - 2 && index > pivotIndices[segmentIndex + 1]) {
      segmentIndex += 1;
    }
    const startIndex = pivotIndices[segmentIndex];
    const endIndex = pivotIndices[segmentIndex + 1] ?? startIndex;
    const startPricePoint = pivotPrices[segmentIndex];
    const endPricePoint = pivotPrices[segmentIndex + 1] ?? startPricePoint;
    const segmentProgress = endIndex === startIndex ? 0 : (index - startIndex) / (endIndex - startIndex);

    const progress = length === 1 ? 1 : index / (length - 1);
    const neckline = necklineAt(progress);
    const upperCap = neckline + edgeBuffer * 1.5;
    const lowerCap = head - edgeBuffer * 1.5;
    const open = previousClose;
    const target = startPricePoint + (endPricePoint - startPricePoint) * segmentProgress;
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
    if (pivotType === "resistance") {
      closeTarget = neckline - Math.random() * (edgeBuffer * 0.9);
    } else if (pivotType === "support") {
      const shoulderLevel = index <= headPivotIndex ? shoulderLeft : shoulderRight;
      const cap = index === headPivotIndex ? head : shoulderLevel;
      closeTarget = cap + Math.random() * (edgeBuffer * 0.9);
    }

    const close = clamp(closeTarget, lowerCap, upperCap);
    let high = Math.max(open, close) + Math.random() * wickUnit;
    let low = Math.min(open, close) - Math.random() * wickUnit;

    if (pivotType === "resistance") {
      high = Math.max(high, close + edgeBuffer * 0.5);
    }
    if (pivotType === "support") {
      low = Math.min(low, close - edgeBuffer * 0.5);
    }

    high = clamp(Math.max(high, open, close), lowerCap, upperCap);
    low = clamp(Math.min(low, open, close), lowerCap, upperCap);

    candles.push({
      id: `${Date.now()}-${index}-${Math.floor(Math.random() * 10000)}`,
      open,
      close,
      high,
      low,
    });

    previousClose = close;
  }

  return { candles, necklineStart, necklineEnd, shoulderLeft, shoulderRight, head };
};

export const reverseHeadAndShouldersPattern: PatternDefinition = {
  id: "reverse-head-and-shoulders",
  label: "Reverse Head & Shoulders",
  length: PATTERN_LENGTH,
  generate: (startPrice): PatternResult => {
    const { candles, necklineStart, necklineEnd, shoulderLeft, shoulderRight, head } = generateReverseHeadAndShoulders(startPrice, PATTERN_LENGTH);
    const height = necklineStart - head;
    const targetPrice = clamp(necklineEnd + height, MIN_PRICE, MAX_PRICE);
    const lines: PatternLine[] = [
      {
        id: "reverse-head-and-shoulders-neckline",
        type: "resistance",
        startOffset: 0,
        endOffset: PATTERN_LENGTH - 1,
        startPrice: necklineStart,
        endPrice: necklineEnd,
      },
      {
        id: "reverse-head-and-shoulders-shoulder",
        type: "support",
        startOffset: Math.round(PATTERN_LENGTH * 0.12),
        endOffset: Math.round(PATTERN_LENGTH * 0.72),
        startPrice: shoulderLeft,
        endPrice: shoulderRight,
      },
    ];

    return {
      candles,
      targetPrice,
      lines,
    };
  },
};
