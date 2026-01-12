import type { Candle, PatternDefinition, PatternLine, PatternResult } from "../types";
import { MAX_PRICE, MIN_PRICE } from "../constants";
import { clamp } from "../utils";

const PATTERN_LENGTH = 48;
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

const generateAscendingBroadeningWedge = (
  startPrice: number,
  length: number
): {
  candles: Candle[];
  resistanceStart: number;
  resistanceEnd: number;
  supportStart: number;
  supportEnd: number;
} => {
  const pct = (value: number) => startPrice * value;
  const minPad = pct(0.015);

  const supportStart = clamp(startPrice * 0.982, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const resistanceStart = clamp(startPrice * 1.024, supportStart + pct(0.012), MAX_PRICE - minPad);

  const heightStart = Math.max(pct(0.012), resistanceStart - supportStart);
  const heightEnd = clamp(heightStart * (1.55 + Math.random() * 0.55), heightStart, heightStart * 2.4);

  const supportEnd = clamp(supportStart + heightStart * (0.35 + Math.random() * 0.35), MIN_PRICE + minPad, MAX_PRICE - minPad);

  let resistanceEnd = clamp(supportEnd + heightEnd, supportEnd + pct(0.006), MAX_PRICE - minPad);
  if (resistanceEnd <= supportEnd + pct(0.006)) {
    resistanceEnd = clamp(supportEnd + pct(0.006), MIN_PRICE + minPad, MAX_PRICE - minPad);
  }

  const edgeBuffer = pct(0.0009);
  const wickUnit = pct(0.0016);
  const noiseUnit = pct(0.0006);
  const swingPeriod = 2 + Math.floor(Math.random() * 3);
  const swingUnit = edgeBuffer * 4;
  const counterChance = 0.35;

  const progressWarp: number[] = [];
  const supportWobble: number[] = [];
  const resistanceWobble: number[] = [];
  let progressDrift = (Math.random() - 0.5) * 0.06;
  let supportDrift = 0;
  let resistanceDrift = 0;
  const wobbleCap = edgeBuffer * 3.6;
  for (let index = 0; index < length; index += 1) {
    progressDrift += (Math.random() - 0.5) * 0.018;
    progressDrift = clamp(progressDrift, -0.09, 0.09);
    const phase = (index / Math.max(1, length - 1)) * Math.PI * 2;
    progressWarp[index] = progressDrift + Math.sin(phase) * (0.03 + Math.random() * 0.02);

    supportDrift += (Math.random() - 0.5) * edgeBuffer * 1.5;
    resistanceDrift += (Math.random() - 0.5) * edgeBuffer * 1.6;
    supportDrift = clamp(supportDrift, -wobbleCap, wobbleCap);
    resistanceDrift = clamp(resistanceDrift, -wobbleCap, wobbleCap);
    supportWobble[index] = supportDrift;
    resistanceWobble[index] = resistanceDrift;
  }

  const minChannel = pct(0.006);
  const getBoundsAt = (index: number) => {
    const baseProgress = length === 1 ? 1 : index / (length - 1);
    const warped = clamp(baseProgress + (progressWarp[index] ?? 0), 0, 1);
    let support = supportStart + (supportEnd - supportStart) * warped + (supportWobble[index] ?? 0);
    let resistance = resistanceStart + (resistanceEnd - resistanceStart) * warped + (resistanceWobble[index] ?? 0);
    if (resistance <= support + minChannel) {
      const mid = (support + resistance) / 2;
      support = mid - minChannel / 2;
      resistance = mid + minChannel / 2;
    }
    support = clamp(support, MIN_PRICE + minPad, MAX_PRICE - minPad);
    resistance = clamp(resistance, support + minChannel, MAX_PRICE - minPad);
    return { support, resistance };
  };

  const candles: Candle[] = [];
  let previousClose = startPrice;

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
    pivotTypes.push(Math.random() < 0.16 ? prev : alternate);
  }
  const pivotPrices = pivotIndices.map((index, idx) => {
    const { support, resistance } = getBoundsAt(index);
    const upperBound = resistance - edgeBuffer;
    const lowerBound = support + edgeBuffer;
    if (pivotTypes[idx] === "support") {
      return clamp(lowerBound + Math.random() * edgeBuffer, lowerBound, upperBound - pct(0.004));
    }
    return clamp(upperBound - Math.random() * edgeBuffer, lowerBound + pct(0.004), upperBound);
  });
  const pivotLookup = new Map<number, "support" | "resistance">(pivotIndices.map((index, idx) => [index, pivotTypes[idx]]));

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

    const { support, resistance } = getBoundsAt(index);
    const lowerBound = support + edgeBuffer;
    const upperBound = resistance - edgeBuffer;

    const openGap = (Math.random() - 0.5) * edgeBuffer * 1.2;
    const open = clamp(previousClose + openGap, lowerBound, upperBound);
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

    if (pivotType) {
      const forceTouch = Math.random() < 0.6;
      if (forceTouch && pivotType === "support") {
        closeTarget = lowerBound + Math.random() * (edgeBuffer * 1.1);
      } else if (forceTouch && pivotType === "resistance") {
        closeTarget = upperBound - Math.random() * (edgeBuffer * 1.1);
      }
    }

    const close = clamp(closeTarget, lowerBound, upperBound);
    const wickMult = (Math.random() < 0.1 ? 2.5 : 1) * (0.65 + Math.random() * 0.95);
    let high = Math.max(open, close) + Math.random() * wickUnit * wickMult;
    let low = Math.min(open, close) - Math.random() * wickUnit * wickMult;

    if (pivotType && Math.random() < 0.55) {
      if (pivotType === "resistance") {
        high = resistance + Math.random() * edgeBuffer * (0.7 + Math.random() * 0.8);
      }
      if (pivotType === "support") {
        low = support - Math.random() * edgeBuffer * (0.7 + Math.random() * 0.8);
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

  return { candles, resistanceStart, resistanceEnd, supportStart, supportEnd };
};

export const ascendingBroadeningWedgePattern: PatternDefinition = {
  id: "ascending-broadening-wedge",
  label: "Ascending Broadening Wedge",
  length: PATTERN_LENGTH,
  generate: (startPrice): PatternResult => {
    const { candles, resistanceStart, resistanceEnd, supportStart, supportEnd } = generateAscendingBroadeningWedge(startPrice, PATTERN_LENGTH);
    const height = resistanceEnd - supportEnd;
    const targetPrice = clamp(supportEnd - height * 0.9, MIN_PRICE, MAX_PRICE);
    const lines: PatternLine[] = [
      {
        id: "ascending-broadening-wedge-resistance",
        type: "resistance",
        startOffset: 0,
        endOffset: PATTERN_LENGTH - 1,
        startPrice: resistanceStart,
        endPrice: resistanceEnd,
      },
      {
        id: "ascending-broadening-wedge-support",
        type: "support",
        startOffset: 0,
        endOffset: PATTERN_LENGTH - 1,
        startPrice: supportStart,
        endPrice: supportEnd,
      },
    ];

    return {
      candles,
      targetPrice,
      lines,
    };
  },
};
