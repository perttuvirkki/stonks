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

const generateDoubleTop = (
  startPrice: number,
  length: number
): {
  candles: Candle[];
  necklineStart: number;
  necklineEnd: number;
  peakLeft: number;
  peakRight: number;
  breakdown: number;
} => {
  const pct = (value: number) => startPrice * value;
  const minPad = pct(0.015);
  const neckline = clamp(startPrice * (0.982 + Math.random() * 0.006), MIN_PRICE + minPad, MAX_PRICE - minPad);
  const necklineStart = neckline;
  const necklineEnd = neckline;
  const peakLeft = clamp(neckline + pct(0.03 + Math.random() * 0.012), neckline + pct(0.018), MAX_PRICE - minPad);
  const peakRight = clamp(peakLeft * (0.997 + Math.random() * 0.008), neckline + pct(0.016), MAX_PRICE - minPad);
  const height = Math.max(peakLeft, peakRight) - neckline;
  const preRallyLow = clamp(neckline - height * (0.62 + Math.random() * 0.16), MIN_PRICE + minPad, neckline - pct(0.004));
  const breakdown = clamp(neckline - height * (0.35 + Math.random() * 0.15), MIN_PRICE + minPad, neckline - pct(0.004));
  const continuation1 = clamp(neckline - height * (0.55 + Math.random() * 0.15), MIN_PRICE + minPad, breakdown - pct(0.003));
  const continuation2 = clamp(neckline - height * (0.75 + Math.random() * 0.15), MIN_PRICE + minPad, continuation1 - pct(0.003));
  const continuation3 = clamp(neckline - height * (0.90 + Math.random() * 0.15), MIN_PRICE + minPad, continuation2 - pct(0.002));

  const edgeBuffer = pct(0.0009);
  const wickUnit = pct(0.0016);
  const noiseUnit = pct(0.0006);
  const swingPeriod = 2 + Math.floor(Math.random() * 3);
  const swingUnit = edgeBuffer * 3.6;
  const counterChance = 0.35;

  // Rally -> top -> neckline -> retest top -> breakdown & continuation.
  const fractions = [0, 0.22, 0.36, 0.58, 0.72, 0.82, 0.9, 1];
  const pivotIndices = buildPivotIndices(length, fractions);
  const pivotTypes: Array<"support" | "resistance"> = ["support", "resistance", "support", "resistance", "support", "support", "support", "support"];
  const pivotPrices = [preRallyLow, peakLeft, neckline, peakRight, breakdown, continuation1, continuation2, continuation3];
  const pivotLookup = new Map<number, { type: "support" | "resistance"; price: number }>(
    pivotIndices.map((index, idx) => [index, { type: pivotTypes[idx]!, price: pivotPrices[idx]! }])
  );

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

    const upperCap = Math.max(peakLeft, peakRight) + edgeBuffer * 1.5;
    const lowerCap = continuation3 - edgeBuffer * 1.5;

    const open = previousClose;
    const target = startPricePoint + (endPricePoint - startPricePoint) * segmentProgress;
    const noise = (Math.random() - 0.5) * noiseUnit;
    let closeTarget = target + noise;

    const pivot = pivotLookup.get(index);
    if (!pivot) {
      const swing = Math.sin((index / swingPeriod) * Math.PI) * swingUnit;
      drift += (Math.random() - 0.5) * edgeBuffer * 1.4;
      drift = clamp(drift, -edgeBuffer * 2.4, edgeBuffer * 2.4);
      closeTarget += swing + drift + (Math.random() - 0.5) * edgeBuffer * 1.2;
      if (Math.random() < counterChance) {
        const pullback = 0.4 + Math.random() * 0.5;
        closeTarget = open - (closeTarget - open) * pullback;
      }
    }

    if (pivot) {
      if (pivot.type === "support") {
        closeTarget = pivot.price + Math.random() * (edgeBuffer * 0.9);
      } else {
        closeTarget = pivot.price - Math.random() * (edgeBuffer * 0.9);
      }
    }

    const close = clamp(closeTarget, lowerCap, upperCap);
    let high = Math.max(open, close) + Math.random() * wickUnit;
    let low = Math.min(open, close) - Math.random() * wickUnit;

    if (pivot?.type === "resistance") {
      high = Math.max(high, close + edgeBuffer * 0.5);
    }
    if (pivot?.type === "support") {
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

  return { candles, necklineStart, necklineEnd, peakLeft, peakRight, breakdown };
};

export const doubleTopPattern: PatternDefinition = {
  id: "double-top",
  label: "Double Top",
  length: PATTERN_LENGTH,
  generate: (startPrice): PatternResult => {
    const { candles, necklineStart, necklineEnd, peakLeft, peakRight } = generateDoubleTop(startPrice, PATTERN_LENGTH);
    const necklineFloor = Math.min(necklineStart, necklineEnd);
    const height = Math.max(peakLeft, peakRight) - necklineFloor;
    const targetPrice = clamp(necklineEnd - height, MIN_PRICE, MAX_PRICE);
    const lines: PatternLine[] = [
      {
        id: "double-top-neckline",
        type: "support",
        startOffset: 0,
        endOffset: PATTERN_LENGTH - 1,
        startPrice: necklineStart,
        endPrice: necklineEnd,
      },
      {
        id: "double-top-peaks",
        type: "resistance",
        startOffset: Math.round(PATTERN_LENGTH * 0.14),
        endOffset: Math.round(PATTERN_LENGTH * 0.46),
        startPrice: peakLeft,
        endPrice: peakRight,
      },
    ];

    return {
      candles,
      targetPrice,
      lines,
    };
  },
};
