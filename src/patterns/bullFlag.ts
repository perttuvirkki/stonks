import type { Candle, PatternDefinition, PatternLine, PatternResult } from "../types";
import { MAX_PRICE, MIN_PRICE } from "../constants";
import { clamp } from "../utils";

const PATTERN_LENGTH = 72;
const POLE_FRACTION_MIN = 0.22;
const POLE_FRACTION_MAX = 0.32;
const POLE_EASE_MIN = 0.55;
const POLE_EASE_MAX = 0.75;

const buildPivotIndices = (length: number, pivotCount: number): number[] => {
  if (pivotCount <= 1) {
    return [0];
  }
  const gaps = pivotCount - 1;
  const total = Math.max(1, length - 1);
  const baseGap = Math.max(1, Math.floor(total / gaps));
  const remainder = total - baseGap * gaps;
  const gapSizes: number[] = [];

  for (let i = 0; i < gaps; i += 1) {
    gapSizes.push(baseGap + (i < remainder ? 1 : 0));
  }

  const indices: number[] = [0];
  let index = 0;
  for (const gap of gapSizes) {
    index += gap;
    indices.push(index);
  }
  return indices;
};

const generateBullFlag = (
  startPrice: number,
  length: number
): {
  candles: Candle[];
  poleTop: number;
  flagHighStart: number;
  flagHighEnd: number;
  flagLowStart: number;
  flagLowEnd: number;
  poleLength: number;
} => {
  const pct = (value: number) => startPrice * value;
  const minPad = pct(0.015);
  const poleTop = clamp(startPrice * 1.055, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const poleDepth = Math.max(pct(0.02), poleTop - startPrice);
  const channelHeight = Math.max(pct(0.01), poleDepth * 0.3);
  const flagHighStart = clamp(poleTop * 0.995, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const flagHighEnd = clamp(poleTop * 0.985, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const flagLowStart = clamp(
    flagHighStart - channelHeight,
    MIN_PRICE + minPad,
    flagHighStart - pct(0.006),
  );
  const flagLowEnd = clamp(
    flagHighEnd - channelHeight,
    MIN_PRICE + minPad,
    flagHighEnd - pct(0.006),
  );
  const edgeBuffer = pct(0.0009);
  const wickUnit = pct(0.0016);
  const noiseUnit = pct(0.0006);
  const swingPeriod = 2 + Math.floor(Math.random() * 3);
  const swingUnit = edgeBuffer * 3.2;
  const counterChance = 0.32;
  let drift = 0;

  const poleFraction = POLE_FRACTION_MIN + Math.random() * (POLE_FRACTION_MAX - POLE_FRACTION_MIN);
  const poleEase = POLE_EASE_MIN + Math.random() * (POLE_EASE_MAX - POLE_EASE_MIN);
  const minFlagLength = 6;
  const maxPoleLength = Math.max(1, length - minFlagLength);
  const poleLength = Math.min(maxPoleLength, Math.max(8, Math.round(length * poleFraction)));
  const flagLength = Math.max(6, length - poleLength);
  const flagTouches = 3 + Math.floor(Math.random() * 3);
  const pivotCount = flagTouches * 2;
  const pivotIndices = buildPivotIndices(flagLength, pivotCount);
  const pivotTypes = pivotIndices.map((_, idx) => (idx % 2 === 0 ? "resistance" : "support"));
  const pivotPrices = pivotIndices.map((index, idx) => {
    const progress = flagLength === 1 ? 1 : index / (flagLength - 1);
    const high = flagHighStart + (flagHighEnd - flagHighStart) * progress;
    const low = flagLowStart + (flagLowEnd - flagLowStart) * progress;
    if (pivotTypes[idx] === "resistance") {
      return high - edgeBuffer * (0.4 + Math.random() * 0.9);
    }
    return low + edgeBuffer * (0.4 + Math.random() * 0.9);
  });
  const pivotLookup = new Map<number, "support" | "resistance">(
    pivotIndices.map((index, idx) => [index, pivotTypes[idx]]),
  );

  const candles: Candle[] = [];
  let previousClose = startPrice;
  let segmentIndex = 0;

  for (let index = 0; index < length; index += 1) {
    const inPole = index < poleLength;
    let target = poleTop;
    let lowerBound = startPrice - poleDepth * 0.15;
    let upperBound = poleTop + edgeBuffer * 1.6;
    let pivotType: "support" | "resistance" | undefined;

    if (!inPole) {
      const flagIndex = index - poleLength;
      const progress = flagLength === 1 ? 1 : flagIndex / (flagLength - 1);
      const high = flagHighStart + (flagHighEnd - flagHighStart) * progress;
      const low = flagLowStart + (flagLowEnd - flagLowStart) * progress;
      lowerBound = low + edgeBuffer * 0.6;
      upperBound = high - edgeBuffer * 0.6;

      while (
        segmentIndex < pivotIndices.length - 2 &&
        flagIndex > pivotIndices[segmentIndex + 1]
      ) {
        segmentIndex += 1;
      }
      const startIndex = pivotIndices[segmentIndex];
      const endIndex = pivotIndices[segmentIndex + 1] ?? startIndex;
      const startPricePoint = pivotPrices[segmentIndex];
      const endPricePoint = pivotPrices[segmentIndex + 1] ?? startPricePoint;
      const segmentProgress =
        endIndex === startIndex ? 0 : (flagIndex - startIndex) / (endIndex - startIndex);
      target = startPricePoint + (endPricePoint - startPricePoint) * segmentProgress;
      pivotType = pivotLookup.get(flagIndex);
    } else {
      const rawProgress = poleLength === 1 ? 1 : index / (poleLength - 1);
      const progress = Math.pow(rawProgress, poleEase);
      target = startPrice + (poleTop - startPrice) * progress;
      if (index === poleLength - 1) {
        drift = 0;
      }
    }

    const open = previousClose;
    const noiseScale = inPole ? 0.6 : 1.1;
    const noise = (Math.random() - 0.5) * noiseUnit * noiseScale;
    let closeTarget = target + noise;

    if (!inPole) {
      if (pivotType === "support") {
        closeTarget = lowerBound + Math.random() * edgeBuffer * 0.8;
      } else if (pivotType === "resistance") {
        closeTarget = upperBound - Math.random() * edgeBuffer * 0.8;
      } else {
        const swing = Math.sin((index / swingPeriod) * Math.PI) * swingUnit;
        drift += (Math.random() - 0.5) * edgeBuffer * 1.2;
        drift = clamp(drift, -edgeBuffer * 2.2, edgeBuffer * 2.2);
        closeTarget += swing + drift + (Math.random() - 0.5) * edgeBuffer * 1.1;
        if (Math.random() < counterChance) {
          const pullback = 0.4 + Math.random() * 0.5;
          closeTarget = open - (closeTarget - open) * pullback;
        }
      }
    } else {
      const swing = Math.sin((index / swingPeriod) * Math.PI) * edgeBuffer * 2.4;
      drift += (Math.random() - 0.5) * edgeBuffer * 0.9;
      drift = clamp(drift, -edgeBuffer * 1.8, edgeBuffer * 1.8);
      closeTarget += swing + drift;
    }

    const close = clamp(closeTarget, lowerBound, upperBound);
    let high = Math.max(open, close) + Math.random() * wickUnit;
    let low = Math.min(open, close) - Math.random() * wickUnit;

    if (!inPole && pivotType === "resistance") {
      high = Math.max(high, upperBound + Math.random() * edgeBuffer);
    }
    if (!inPole && pivotType === "support") {
      low = Math.min(low, lowerBound - Math.random() * edgeBuffer);
    }

    high = clamp(Math.max(high, open, close), lowerBound, upperBound + edgeBuffer * 1.6);
    low = clamp(Math.min(low, open, close), lowerBound - edgeBuffer * 1.6, upperBound);

    candles.push({
      id: `${Date.now()}-${index}-${Math.floor(Math.random() * 10000)}`,
      open,
      close,
      high,
      low,
    });

    previousClose = close;
  }

  return {
    candles,
    poleTop,
    flagHighStart,
    flagHighEnd,
    flagLowStart,
    flagLowEnd,
    poleLength,
  };
};

export const bullFlagPattern: PatternDefinition = {
  id: "bull-flag",
  label: "Bull Flag",
  length: PATTERN_LENGTH,
  generate: (startPrice): PatternResult => {
    const {
      candles,
      poleTop,
      flagHighStart,
      flagHighEnd,
      flagLowStart,
      flagLowEnd,
      poleLength,
    } = generateBullFlag(startPrice, PATTERN_LENGTH);
    const height = poleTop - startPrice;
    const targetPrice = clamp(poleTop + height, MIN_PRICE, MAX_PRICE);
    const lines: PatternLine[] = [
      {
        id: "bull-flag-upper",
        type: "resistance",
        startOffset: poleLength,
        endOffset: PATTERN_LENGTH - 1,
        startPrice: flagHighStart,
        endPrice: flagHighEnd,
      },
      {
        id: "bull-flag-lower",
        type: "support",
        startOffset: poleLength,
        endOffset: PATTERN_LENGTH - 1,
        startPrice: flagLowStart,
        endPrice: flagLowEnd,
      },
    ];

    return {
      candles,
      targetPrice,
      lines,
    };
  },
};
