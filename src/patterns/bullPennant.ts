import type { Candle, PatternDefinition, PatternLine, PatternResult } from "../types";
import { MAX_PRICE, MIN_PRICE } from "../constants";
import { clamp } from "../utils";

const PATTERN_LENGTH = 48;

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

const generateBullPennant = (
  startPrice: number,
  length: number
): {
  candles: Candle[];
  poleTop: number;
  pennantHighStart: number;
  pennantHighEnd: number;
  pennantLowStart: number;
  pennantLowEnd: number;
  poleLength: number;
} => {
  const pct = (value: number) => startPrice * value;
  const minPad = pct(0.015);
  const poleTop = clamp(startPrice * 1.055, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const poleDepth = Math.max(pct(0.02), poleTop - startPrice);
  const pennantHeight = Math.max(pct(0.012), poleDepth * 0.35);
  const pennantHighStart = clamp(poleTop * 0.995, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const pennantLowStart = clamp(
    pennantHighStart - pennantHeight,
    MIN_PRICE + minPad,
    pennantHighStart - pct(0.006),
  );
  const converge = pennantHeight * 0.35;
  const drift = pennantHeight * 0.05;
  const pennantHighEnd = clamp(
    pennantHighStart - converge - drift,
    pennantLowStart + pct(0.006),
    MAX_PRICE - minPad,
  );
  const pennantLowEnd = clamp(
    pennantLowStart + converge - drift,
    MIN_PRICE + minPad,
    pennantHighEnd - pct(0.006),
  );
  const edgeBuffer = pct(0.0009);
  const wickUnit = pct(0.0016);
  const noiseUnit = pct(0.0006);
  const swingPeriod = 2 + Math.floor(Math.random() * 3);
  const swingUnit = edgeBuffer * 3.2;
  const counterChance = 0.32;
  let driftNoise = 0;

  const poleLength = Math.max(8, Math.round(length * 0.4));
  const pennantLength = Math.max(6, length - poleLength);
  const pivotTouches = 3 + Math.floor(Math.random() * 3);
  const pivotCount = pivotTouches * 2;
  const pivotIndices = buildPivotIndices(pennantLength, pivotCount);
  const pivotTypes = pivotIndices.map((_, idx) => (idx % 2 === 0 ? "resistance" : "support"));
  const pivotPrices = pivotIndices.map((index, idx) => {
    const progress = pennantLength === 1 ? 1 : index / (pennantLength - 1);
    const high = pennantHighStart + (pennantHighEnd - pennantHighStart) * progress;
    const low = pennantLowStart + (pennantLowEnd - pennantLowStart) * progress;
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
      const pennantIndex = index - poleLength;
      const progress = pennantLength === 1 ? 1 : pennantIndex / (pennantLength - 1);
      const high = pennantHighStart + (pennantHighEnd - pennantHighStart) * progress;
      const low = pennantLowStart + (pennantLowEnd - pennantLowStart) * progress;
      lowerBound = low + edgeBuffer * 0.6;
      upperBound = high - edgeBuffer * 0.6;

      while (
        segmentIndex < pivotIndices.length - 2 &&
        pennantIndex > pivotIndices[segmentIndex + 1]
      ) {
        segmentIndex += 1;
      }
      const startIndex = pivotIndices[segmentIndex];
      const endIndex = pivotIndices[segmentIndex + 1] ?? startIndex;
      const startPricePoint = pivotPrices[segmentIndex];
      const endPricePoint = pivotPrices[segmentIndex + 1] ?? startPricePoint;
      const segmentProgress =
        endIndex === startIndex
          ? 0
          : (pennantIndex - startIndex) / (endIndex - startIndex);
      target = startPricePoint + (endPricePoint - startPricePoint) * segmentProgress;
      pivotType = pivotLookup.get(pennantIndex);
    } else {
      const progress = poleLength === 1 ? 1 : index / (poleLength - 1);
      target = startPrice + (poleTop - startPrice) * progress;
      if (index === poleLength - 1) {
        driftNoise = 0;
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
        driftNoise += (Math.random() - 0.5) * edgeBuffer * 1.2;
        driftNoise = clamp(driftNoise, -edgeBuffer * 2.2, edgeBuffer * 2.2);
        closeTarget += swing + driftNoise + (Math.random() - 0.5) * edgeBuffer * 1.1;
        if (Math.random() < counterChance) {
          const pullback = 0.4 + Math.random() * 0.5;
          closeTarget = open - (closeTarget - open) * pullback;
        }
      }
    } else {
      const swing = Math.sin((index / swingPeriod) * Math.PI) * edgeBuffer * 2.4;
      driftNoise += (Math.random() - 0.5) * edgeBuffer * 0.9;
      driftNoise = clamp(driftNoise, -edgeBuffer * 1.8, edgeBuffer * 1.8);
      closeTarget += swing + driftNoise;
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
    pennantHighStart,
    pennantHighEnd,
    pennantLowStart,
    pennantLowEnd,
    poleLength,
  };
};

export const bullPennantPattern: PatternDefinition = {
  id: "bull-pennant",
  label: "Bull Pennant",
  length: PATTERN_LENGTH,
  generate: (startPrice): PatternResult => {
    const {
      candles,
      poleTop,
      pennantHighStart,
      pennantHighEnd,
      pennantLowStart,
      pennantLowEnd,
      poleLength,
    } = generateBullPennant(startPrice, PATTERN_LENGTH);
    const height = poleTop - startPrice;
    const targetPrice = clamp(poleTop + height, MIN_PRICE, MAX_PRICE);
    const lines: PatternLine[] = [
      {
        id: "bull-pennant-upper",
        type: "resistance",
        startOffset: poleLength,
        endOffset: PATTERN_LENGTH - 1,
        startPrice: pennantHighStart,
        endPrice: pennantHighEnd,
      },
      {
        id: "bull-pennant-lower",
        type: "support",
        startOffset: poleLength,
        endOffset: PATTERN_LENGTH - 1,
        startPrice: pennantLowStart,
        endPrice: pennantLowEnd,
      },
    ];

    return {
      candles,
      targetPrice,
      lines,
    };
  },
};
