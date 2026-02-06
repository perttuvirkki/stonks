import type { Candle, PatternDefinition, PatternLine, PatternResult } from "../types";
import { MAX_PRICE, MIN_PRICE } from "../constants";
import { clamp } from "../utils";

const PATTERN_LENGTH = 96;
const HIT_MIN = 4;
const HIT_MAX = 7;

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

const generateDiamondBottom = (
  startPrice: number,
  length: number
): {
  candles: Candle[];
  leadLength: number;
  midOffset: number;
  upperStart: number;
  upperMid: number;
  upperEnd: number;
  lowerStart: number;
  lowerMid: number;
  lowerEnd: number;
  height: number;
} => {
  const pct = (value: number) => startPrice * value;
  const minPad = pct(0.015);

  const edgeBuffer = pct(0.0009);
  const wickUnit = pct(0.0016);
  const noiseUnit = pct(0.0006);
  const swingPeriod = 2 + Math.floor(Math.random() * 3);
  const swingUnit = edgeBuffer * 3.2;
  const counterChance = 0.32;

  const leadLength = Math.max(10, Math.round(length * 0.28));
  const diamondLength = Math.max(10, length - leadLength);
  const mid = Math.max(1, Math.floor(diamondLength / 2));

  const trough = clamp(startPrice * 0.95, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const leadHeight = Math.max(pct(0.02), startPrice - trough);

  const centerStart = clamp(trough * 1.005, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const baseHalfHeight = Math.max(pct(0.011), leadHeight * 0.31);
  const expandHalfHeight = baseHalfHeight * (1.5 + Math.random() * 0.3);
  const contractHalfHeight = baseHalfHeight * (0.8 + Math.random() * 0.22);

  const centerMid = clamp(centerStart + leadHeight * (0.08 + Math.random() * 0.08), MIN_PRICE + minPad, MAX_PRICE - minPad);
  const centerEnd = clamp(centerStart + leadHeight * (0.25 + Math.random() * 0.12), MIN_PRICE + minPad, MAX_PRICE - minPad);

  const upperStart = clamp(centerStart + baseHalfHeight, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const lowerStart = clamp(centerStart - baseHalfHeight, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const upperMid = clamp(centerMid + expandHalfHeight, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const lowerMid = clamp(centerMid - expandHalfHeight, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const upperEnd = clamp(centerEnd + contractHalfHeight, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const lowerEnd = clamp(centerEnd - contractHalfHeight, MIN_PRICE + minPad, MAX_PRICE - minPad);

  const height = Math.max(pct(0.013), upperMid - lowerMid);

  // Add wobble so the diamond doesn't look like a perfect polygon.
  const upperWobble: number[] = [];
  const lowerWobble: number[] = [];
  let upperDrift = 0;
  let lowerDrift = 0;
  const wobbleCap = edgeBuffer * 2.8;
  const wobblePeriod = 4 + Math.floor(Math.random() * 4);
  const wobblePhase = Math.random() * Math.PI * 2;
  for (let i = 0; i < diamondLength; i += 1) {
    upperDrift += (Math.random() - 0.5) * edgeBuffer * 1.2;
    lowerDrift += (Math.random() - 0.5) * edgeBuffer * 1.2;
    upperDrift = clamp(upperDrift, -wobbleCap, wobbleCap);
    lowerDrift = clamp(lowerDrift, -wobbleCap, wobbleCap);
    const wobble = Math.sin(wobblePhase + (i / wobblePeriod) * Math.PI) * edgeBuffer * (0.8 + Math.random() * 0.6);
    upperWobble[i] = upperDrift + wobble;
    lowerWobble[i] = lowerDrift - wobble;
  }

  const minGap = edgeBuffer * 3.2;
  const getDiamondBoundsAt = (diamondIndex: number) => {
    const baseHigh = diamondHighAt(diamondIndex);
    const baseLow = diamondLowAt(diamondIndex);
    let high = baseHigh + (upperWobble[diamondIndex] ?? 0);
    let low = baseLow + (lowerWobble[diamondIndex] ?? 0);
    if (high <= low + minGap) {
      const midPoint = (high + low) / 2;
      high = midPoint + minGap / 2;
      low = midPoint - minGap / 2;
    }
    high = clamp(high, MIN_PRICE + minPad, MAX_PRICE - minPad);
    low = clamp(low, MIN_PRICE + minPad, high - minGap);
    return { high, low };
  };

  const diamondHighAt = (diamondIndex: number) => {
    if (diamondLength <= 1) {
      return upperEnd;
    }
    if (diamondIndex <= mid) {
      const t = mid === 0 ? 1 : diamondIndex / mid;
      return upperStart + (upperMid - upperStart) * t;
    }
    const t = (diamondIndex - mid) / Math.max(1, diamondLength - 1 - mid);
    return upperMid + (upperEnd - upperMid) * t;
  };

  const diamondLowAt = (diamondIndex: number) => {
    if (diamondLength <= 1) {
      return lowerEnd;
    }
    if (diamondIndex <= mid) {
      const t = mid === 0 ? 1 : diamondIndex / mid;
      return lowerStart + (lowerMid - lowerStart) * t;
    }
    const t = (diamondIndex - mid) / Math.max(1, diamondLength - 1 - mid);
    return lowerMid + (lowerEnd - lowerMid) * t;
  };

  const touches = HIT_MIN + Math.floor(Math.random() * (HIT_MAX - HIT_MIN + 1));
  const pivotCount = touches * 2;
  const pivotIndices = buildPivotIndices(diamondLength, pivotCount);
  const pivotTypes: Array<"support" | "resistance"> = [];
  for (let i = 0; i < pivotIndices.length; i += 1) {
    if (i === 0) {
      pivotTypes.push("support");
      continue;
    }
    const prev = pivotTypes[i - 1];
    const alternate = prev === "resistance" ? "support" : "resistance";
    pivotTypes.push(Math.random() < 0.14 ? prev : alternate);
  }
  const pivotPrices = pivotIndices.map((index, idx) => {
    const { high, low } = getDiamondBoundsAt(index);
    if (pivotTypes[idx] === "support") {
      return low + edgeBuffer * (0.4 + Math.random() * 0.9);
    }
    return high - edgeBuffer * (0.4 + Math.random() * 0.9);
  });
  const pivotLookup = new Map<number, "support" | "resistance">(pivotIndices.map((index, idx) => [index, pivotTypes[idx]]));

  const candles: Candle[] = [];
  let previousClose = startPrice;
  let segmentIndex = 0;
  let drift = 0;

  for (let index = 0; index < length; index += 1) {
    const inLead = index < leadLength;
    let target = trough;
    let lowerBound = trough - edgeBuffer * 1.6;
    let upperBound = startPrice + leadHeight * 0.15;
    let pivotType: "support" | "resistance" | undefined;

    if (inLead) {
      const progress = leadLength === 1 ? 1 : index / (leadLength - 1);
      target = startPrice + (trough - startPrice) * progress;
      if (index === leadLength - 1) {
        drift = 0;
      }
    } else {
      const diamondIndex = index - leadLength;
      const bounds = getDiamondBoundsAt(diamondIndex);
      const high = bounds.high;
      const low = bounds.low;
      lowerBound = low + edgeBuffer * 0.6;
      upperBound = high - edgeBuffer * 0.6;

      while (segmentIndex < pivotIndices.length - 2 && diamondIndex > pivotIndices[segmentIndex + 1]) {
        segmentIndex += 1;
      }
      const startIndex = pivotIndices[segmentIndex];
      const endIndex = pivotIndices[segmentIndex + 1] ?? startIndex;
      const startPricePoint = pivotPrices[segmentIndex];
      const endPricePoint = pivotPrices[segmentIndex + 1] ?? startPricePoint;
      const segmentProgress = endIndex === startIndex ? 0 : (diamondIndex - startIndex) / (endIndex - startIndex);
      target = startPricePoint + (endPricePoint - startPricePoint) * segmentProgress;
      pivotType = pivotLookup.get(diamondIndex);
    }

    const openGap = (Math.random() - 0.5) * edgeBuffer * 1.2;
    const open = clamp(previousClose + openGap, lowerBound, upperBound);
    const noiseScale = inLead ? 0.6 : 1.1;
    const noise = (Math.random() - 0.5) * noiseUnit * noiseScale;
    let closeTarget = target + noise;

    if (!inLead) {
      if (pivotType) {
        const forceTouch = Math.random() < 0.58;
        if (forceTouch && pivotType === "support") {
          closeTarget = lowerBound + Math.random() * edgeBuffer * 1.1;
        } else if (forceTouch && pivotType === "resistance") {
          closeTarget = upperBound - Math.random() * edgeBuffer * 1.1;
        }
      }
      if (!pivotType) {
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
      const swing = Math.sin((index / swingPeriod) * Math.PI) * edgeBuffer * 2.2;
      drift += (Math.random() - 0.5) * edgeBuffer * 0.9;
      drift = clamp(drift, -edgeBuffer * 1.8, edgeBuffer * 1.8);
      closeTarget += swing + drift;
    }

    const close = clamp(closeTarget, lowerBound, upperBound);
    const wickMult = (Math.random() < 0.1 ? 2.6 : 1) * (0.65 + Math.random() * 0.95);
    let high = Math.max(open, close) + Math.random() * wickUnit * wickMult;
    let low = Math.min(open, close) - Math.random() * wickUnit * wickMult;

    if (!inLead && pivotType && Math.random() < 0.55) {
      if (pivotType === "resistance") {
        high = Math.max(high, upperBound + Math.random() * edgeBuffer);
      }
      if (pivotType === "support") {
        low = Math.min(low, lowerBound - Math.random() * edgeBuffer);
      }
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
    leadLength,
    midOffset: leadLength + mid,
    upperStart,
    upperMid,
    upperEnd,
    lowerStart,
    lowerMid,
    lowerEnd,
    height,
  };
};

export const diamondBottomPattern: PatternDefinition = {
  id: "diamond-bottom",
  label: "Diamond Bottom",
  length: PATTERN_LENGTH,
  generate: (startPrice): PatternResult => {
    const { candles, leadLength, midOffset, upperStart, upperMid, upperEnd, lowerStart, lowerMid, lowerEnd, height } = generateDiamondBottom(
      startPrice,
      PATTERN_LENGTH
    );

    const targetPrice = clamp(upperEnd + height * 0.9, MIN_PRICE, MAX_PRICE);
    const lines: PatternLine[] = [
      {
        id: "diamond-bottom-upper-left",
        type: "resistance",
        startOffset: leadLength,
        endOffset: midOffset,
        startPrice: upperStart,
        endPrice: upperMid,
      },
      {
        id: "diamond-bottom-upper-right",
        type: "resistance",
        startOffset: midOffset,
        endOffset: PATTERN_LENGTH - 1,
        startPrice: upperMid,
        endPrice: upperEnd,
      },
      {
        id: "diamond-bottom-lower-left",
        type: "support",
        startOffset: leadLength,
        endOffset: midOffset,
        startPrice: lowerStart,
        endPrice: lowerMid,
      },
      {
        id: "diamond-bottom-lower-right",
        type: "support",
        startOffset: midOffset,
        endOffset: PATTERN_LENGTH - 1,
        startPrice: lowerMid,
        endPrice: lowerEnd,
      },
    ];

    return {
      candles,
      targetPrice,
      lines,
    };
  },
};
