import type { Candle, PatternDefinition, PatternLine, PatternResult } from "../types";
import { MAX_PRICE, MIN_PRICE } from "../constants";
import { clamp } from "../utils";

const PATTERN_LENGTH = 128;

const generateCupAndHandle = (
  startPrice: number,
  length: number
): {
  candles: Candle[];
  rim: number;
  cupBottom: number;
  handleLow: number;
  handleStart: number;
  handleEnd: number;
  cupLength: number;
} => {
  const pct = (value: number) => startPrice * value;
  const minPad = pct(0.015);
  const rim = clamp(startPrice * 1.012, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const cupBottom = clamp(startPrice * 0.965, MIN_PRICE + minPad, rim - pct(0.028));
  const cupDepth = rim - cupBottom;
  const handleDepth = cupDepth * 0.18;
  const handleStart = clamp(rim - cupDepth * 0.06, MIN_PRICE + minPad, rim - pct(0.002));
  const handleEnd = clamp(rim - cupDepth * 0.14, MIN_PRICE + minPad, rim - pct(0.0025));
  const handleLow = clamp(rim - handleDepth, MIN_PRICE + minPad, handleStart - pct(0.003));
  const edgeBuffer = pct(0.0009);
  const wickUnit = pct(0.0016);
  const noiseUnit = pct(0.0006);
  const swingPeriod = 2 + Math.floor(Math.random() * 3);
  const cupSwingUnit = edgeBuffer * 2;
  const handleSwingUnit = edgeBuffer * 2.6;
  const cupBand = Math.max(edgeBuffer * 4, cupDepth * 0.08);
  const handleBand = Math.max(edgeBuffer * 3.5, handleDepth * 0.22);
  const counterChanceCup = 0.22;
  const counterChanceHandle = 0.26;
  let drift = 0;

  let cupLength = Math.max(10, Math.round(length * 0.82));
  let handleLength = Math.max(8, length - cupLength);
  if (cupLength + handleLength !== length) {
    cupLength = Math.max(8, length - handleLength);
    handleLength = length - cupLength;
  }
  const cupMidIndex = Math.floor((cupLength - 1) / 2);
  const cupQuarterIndex = Math.round(cupLength * 0.25);
  const cupThreeQuarterIndex = Math.round(cupLength * 0.75);
  const handleMidIndex = cupLength + Math.floor((handleLength - 1) / 2);

  const candles: Candle[] = [];
  let previousClose = startPrice;

  for (let index = 0; index < length; index += 1) {
    let target = rim;
    let lowerBound = cupBottom - edgeBuffer * 1.2;
    let upperBound = rim + edgeBuffer * 1.2;
    const inCup = index < cupLength;
    if (index === cupLength) {
      drift = 0;
    }

    if (index < cupLength) {
      const progress = cupLength === 1 ? 1 : index / (cupLength - 1);
      const x = 2 * progress - 1;
      const depthFactor = Math.sqrt(Math.max(0, 1 - x * x));
      target = rim - cupDepth * depthFactor;
    } else {
      const handleIndex = index - cupLength;
      const progress = handleLength === 1 ? 1 : handleIndex / (handleLength - 1);
      const base = handleStart + (handleEnd - handleStart) * progress;
      const dip = handleDepth * (1 - Math.cos(Math.PI * progress)) * 0.5;
      target = base - dip;
      lowerBound = handleLow - edgeBuffer * 1.1;
      upperBound = rim + edgeBuffer * 0.8;
    }

    const open = previousClose;
    const noiseScale = inCup ? 0.7 : 1.1;
    const noise = (Math.random() - 0.5) * noiseUnit * noiseScale;
    let closeTarget = target + noise;
    const isAnchor =
      index === 0 ||
      index === cupQuarterIndex ||
      index === cupMidIndex ||
      index === cupThreeQuarterIndex ||
      index === cupLength - 1 ||
      index === cupLength ||
      index === handleMidIndex ||
      index === length - 1;

    if (index === 0 || index === cupLength - 1) {
      closeTarget = rim - Math.random() * edgeBuffer;
    } else if (index === cupMidIndex) {
      closeTarget = cupBottom + Math.random() * edgeBuffer;
    } else if (index === cupLength) {
      closeTarget = handleStart - Math.random() * edgeBuffer;
    } else if (index === handleMidIndex) {
      closeTarget = handleLow + Math.random() * edgeBuffer;
    } else if (index === length - 1) {
      closeTarget = handleEnd + Math.random() * edgeBuffer * 0.4;
    } else if (isAnchor) {
      closeTarget = target + (Math.random() - 0.5) * edgeBuffer;
    } else if (!isAnchor) {
      const swingUnit = inCup ? cupSwingUnit : handleSwingUnit;
      const driftStep = inCup ? edgeBuffer * 0.6 : edgeBuffer * 1.4;
      const driftClamp = inCup ? edgeBuffer * 1.6 : edgeBuffer * 2.4;
      const counterChance = inCup ? counterChanceCup : counterChanceHandle;
      const swing = Math.sin((index / swingPeriod) * Math.PI) * swingUnit;
      drift += (Math.random() - 0.5) * driftStep;
      drift = clamp(drift, -driftClamp, driftClamp);
      closeTarget += swing + drift + (Math.random() - 0.5) * edgeBuffer * 1.1;
      if (Math.random() < counterChance) {
        const pullback = 0.4 + Math.random() * 0.5;
        closeTarget = open - (closeTarget - open) * pullback;
      }
    }

    const band = inCup ? cupBand : handleBand;
    closeTarget = clamp(closeTarget, target - band, target + band);
    const close = clamp(closeTarget, lowerBound, upperBound);
    let high = Math.max(open, close) + Math.random() * wickUnit;
    let low = Math.min(open, close) - Math.random() * wickUnit;

    if (index === 0 || index === cupLength - 1) {
      high = rim + Math.random() * edgeBuffer;
    }
    if (index === cupMidIndex) {
      low = cupBottom - Math.random() * edgeBuffer;
    }
    if (index === handleMidIndex) {
      low = Math.min(low, handleLow - Math.random() * edgeBuffer);
    }

    high = clamp(Math.max(high, open, close), lowerBound, rim + edgeBuffer * 1.6);
    low = clamp(Math.min(low, open, close), lowerBound, upperBound);

    candles.push({
      id: `${Date.now()}-${index}-${Math.floor(Math.random() * 10000)}`,
      open,
      close,
      high,
      low,
    });

    previousClose = close;
  }

  return { candles, rim, cupBottom, handleLow, handleStart, handleEnd, cupLength };
};

export const cupAndHandlePattern: PatternDefinition = {
  id: "cup-and-handle",
  label: "Cup & Handle",
  length: PATTERN_LENGTH,
  generate: (startPrice): PatternResult => {
    const { candles, rim, cupBottom, handleLow, handleStart, handleEnd, cupLength } = generateCupAndHandle(startPrice, PATTERN_LENGTH);
    const targetPrice = clamp(rim + (rim - cupBottom), MIN_PRICE, MAX_PRICE);
    const lines: PatternLine[] = [
      {
        id: "cup-handle-rim",
        type: "resistance",
        startOffset: 0,
        endOffset: PATTERN_LENGTH - 1,
        startPrice: rim,
        endPrice: rim,
      },
      {
        id: "cup-handle-handle",
        type: "support",
        startOffset: Math.max(0, cupLength - 1),
        endOffset: PATTERN_LENGTH - 1,
        startPrice: handleLow,
        endPrice: handleLow + Math.max(0, (handleStart - handleLow) * 0.4),
      },
    ];

    return {
      candles,
      targetPrice,
      lines,
    };
  },
};
