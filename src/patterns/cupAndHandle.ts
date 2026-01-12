import type { Candle, PatternDefinition, PatternLine, PatternResult } from "../types";
import { MAX_PRICE, MIN_PRICE } from "../constants";
import { clamp } from "../utils";

const PATTERN_LENGTH = 84;

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
  const rimBase = clamp(startPrice * 1.012, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const rimDrift = pct(0.004) * (Math.random() - 0.5);
  const rimStart = clamp(rimBase + rimDrift, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const rimEnd = clamp(rimBase - rimDrift, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const rim = (rimStart + rimEnd) / 2;
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

  let cupLength = Math.max(10, Math.round(length * (0.78 + Math.random() * 0.08)));
  let handleLength = Math.max(8, length - cupLength);
  if (cupLength + handleLength !== length) {
    cupLength = Math.max(8, length - handleLength);
    handleLength = length - cupLength;
  }
  const cupMidIndex = Math.floor((cupLength - 1) / 2);
  const cupSkew = (Math.random() - 0.5) * 0.28;
  const cupShapePower = 0.75 + Math.random() * 0.7;
  const handleMidIndex = cupLength + Math.floor((handleLength - 1) / 2);

  const rimAt = (index: number) => {
    if (cupLength <= 1) {
      return rim;
    }
    const t = clamp(index / (cupLength - 1), 0, 1);
    return rimStart + (rimEnd - rimStart) * t;
  };

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
      const xRaw = 2 * progress - 1 + cupSkew;
      const x = clamp(xRaw, -1, 1);
      const base = Math.sqrt(Math.max(0, 1 - x * x));
      const depthFactor = Math.pow(base, cupShapePower);
      target = rimAt(index) - cupDepth * depthFactor + (Math.random() - 0.5) * edgeBuffer * 1.4;
      lowerBound = cupBottom - edgeBuffer * 1.4;
      upperBound = rimAt(index) + edgeBuffer * 1.4;
    } else {
      const handleIndex = index - cupLength;
      const progress = handleLength === 1 ? 1 : handleIndex / (handleLength - 1);
      const base = handleStart + (handleEnd - handleStart) * progress;
      const dip = handleDepth * (1 - Math.cos(Math.PI * progress)) * 0.5;
      target = base - dip + (Math.random() - 0.5) * edgeBuffer * 1.8;
      lowerBound = handleLow - edgeBuffer * 1.1;
      upperBound = rim + edgeBuffer * 0.8;
    }

    const openGap = (Math.random() - 0.5) * edgeBuffer * 1.4;
    const open = clamp(previousClose + openGap, lowerBound, upperBound);
    const noiseScale = inCup ? 0.7 : 1.1;
    const noise = (Math.random() - 0.5) * noiseUnit * noiseScale;
    let closeTarget = target + noise;
    const isAnchor =
      index === 0 || index === cupMidIndex || index === cupLength - 1 || index === cupLength || index === handleMidIndex || index === length - 1;

    if (index === 0 || index === cupLength - 1) {
      closeTarget = rimAt(Math.min(index, cupLength - 1)) - Math.random() * edgeBuffer * (0.6 + Math.random() * 0.8);
    } else if (index === cupMidIndex) {
      closeTarget = cupBottom + Math.random() * edgeBuffer * (0.6 + Math.random() * 0.8);
    } else if (index === cupLength) {
      closeTarget = handleStart - Math.random() * edgeBuffer * (0.5 + Math.random() * 0.9);
    } else if (index === handleMidIndex) {
      closeTarget = handleLow + Math.random() * edgeBuffer * (0.5 + Math.random() * 0.9);
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
    const wickMult = (Math.random() < 0.08 ? 2.4 : 1) * (0.65 + Math.random() * 0.95);
    let high = Math.max(open, close) + Math.random() * wickUnit * wickMult;
    let low = Math.min(open, close) - Math.random() * wickUnit * wickMult;

    if ((index === 0 || index === cupLength - 1) && Math.random() < 0.55) {
      high = rimAt(Math.min(index, cupLength - 1)) + Math.random() * edgeBuffer;
    }
    if (index === cupMidIndex && Math.random() < 0.6) {
      low = cupBottom - Math.random() * edgeBuffer;
    }
    if (index === handleMidIndex && Math.random() < 0.6) {
      low = Math.min(low, handleLow - Math.random() * edgeBuffer);
    }

    high = clamp(Math.max(high, open, close), lowerBound, rimAt(Math.min(index, cupLength - 1)) + edgeBuffer * 1.8);
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
