import type { Candle, PatternDefinition, PatternLine, PatternResult } from "../types";
import { MAX_PRICE, MIN_PRICE } from "../constants";
import { clamp } from "../utils";

const PATTERN_LENGTH = 72;

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

const generateBullRectangle = (
  startPrice: number,
  length: number
): {
  candles: Candle[];
  poleTop: number;
  rectHigh: number;
  rectLow: number;
  poleLength: number;
} => {
  const pct = (value: number) => startPrice * value;
  const minPad = pct(0.015);

  const poleTop = clamp(startPrice * 1.06, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const poleHeight = Math.max(pct(0.02), poleTop - startPrice);
  const rectHeight = Math.max(pct(0.012), poleHeight * 0.36);

  const rectHigh = clamp(poleTop * 0.995, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const rectLow = clamp(rectHigh - rectHeight, MIN_PRICE + minPad, rectHigh - pct(0.007));

  const edgeBuffer = pct(0.0009);
  const wickUnit = pct(0.0016);
  const noiseUnit = pct(0.0006);
  const swingPeriod = 2 + Math.floor(Math.random() * 3);
  const swingUnit = edgeBuffer * 3.2;
  const counterChance = 0.32;
  let drift = 0;

  const poleLength = Math.max(8, Math.round(length * 0.4));
  const rectLength = Math.max(6, length - poleLength);
  const rectTouches = 3 + Math.floor(Math.random() * 3);
  const pivotCount = rectTouches * 2;
  const pivotIndices = buildPivotIndices(rectLength, pivotCount);
  const pivotTypes = pivotIndices.map((_, idx) => (idx % 2 === 0 ? "resistance" : "support"));
  const pivotPrices = pivotIndices.map((_, idx) => {
    if (pivotTypes[idx] === "resistance") {
      return rectHigh - edgeBuffer * (0.4 + Math.random() * 0.9);
    }
    return rectLow + edgeBuffer * (0.4 + Math.random() * 0.9);
  });
  const pivotLookup = new Map<number, "support" | "resistance">(pivotIndices.map((index, idx) => [index, pivotTypes[idx]]));

  const candles: Candle[] = [];
  let previousClose = startPrice;
  let segmentIndex = 0;

  for (let index = 0; index < length; index += 1) {
    const inPole = index < poleLength;
    let target = poleTop;
    let lowerBound = startPrice - poleHeight * 0.15;
    let upperBound = poleTop + edgeBuffer * 1.6;
    let pivotType: "support" | "resistance" | undefined;

    if (!inPole) {
      const rectIndex = index - poleLength;
      lowerBound = rectLow + edgeBuffer * 0.6;
      upperBound = rectHigh - edgeBuffer * 0.6;

      while (segmentIndex < pivotIndices.length - 2 && rectIndex > pivotIndices[segmentIndex + 1]) {
        segmentIndex += 1;
      }
      const startIndex = pivotIndices[segmentIndex];
      const endIndex = pivotIndices[segmentIndex + 1] ?? startIndex;
      const startPricePoint = pivotPrices[segmentIndex];
      const endPricePoint = pivotPrices[segmentIndex + 1] ?? startPricePoint;
      const segmentProgress = endIndex === startIndex ? 0 : (rectIndex - startIndex) / (endIndex - startIndex);
      target = startPricePoint + (endPricePoint - startPricePoint) * segmentProgress;
      pivotType = pivotLookup.get(rectIndex);
    } else {
      const progress = poleLength === 1 ? 1 : index / (poleLength - 1);
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
    rectHigh,
    rectLow,
    poleLength,
  };
};

export const bullRectanglePattern: PatternDefinition = {
  id: "bull-rectangle",
  label: "Bull Rectangle",
  length: PATTERN_LENGTH,
  generate: (startPrice): PatternResult => {
    const { candles, poleTop, rectHigh, rectLow, poleLength } = generateBullRectangle(startPrice, PATTERN_LENGTH);
    const height = poleTop - startPrice;
    const targetPrice = clamp(rectHigh + height, MIN_PRICE, MAX_PRICE);
    const lines: PatternLine[] = [
      {
        id: "bull-rectangle-upper",
        type: "resistance",
        startOffset: poleLength,
        endOffset: PATTERN_LENGTH - 1,
        startPrice: rectHigh,
        endPrice: rectHigh,
      },
      {
        id: "bull-rectangle-lower",
        type: "support",
        startOffset: poleLength,
        endOffset: PATTERN_LENGTH - 1,
        startPrice: rectLow,
        endPrice: rectLow,
      },
    ];

    return {
      candles,
      targetPrice,
      lines,
    };
  },
};
