import type { Candle, PatternDefinition, PatternLine, PatternResult } from "../types";
import { MAX_PRICE, MIN_PRICE } from "../constants";
import { clamp } from "../utils";

const PATTERN_LENGTH = 150;

const generateId = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const generateRange = (
  startPrice: number,
  length: number
): {
  candles: Candle[];
  rangeHigh: number;
  rangeLow: number;
  breakoutDirection: "up" | "down";
} => {
  const pct = (value: number) => startPrice * value;
  const minPad = pct(0.02);

  // Range height: 3-6% of start price
  const rangeHeight = pct(0.03 + Math.random() * 0.03);
  const rangeMid = clamp(startPrice, MIN_PRICE + rangeHeight, MAX_PRICE - rangeHeight);
  const rangeHigh = clamp(rangeMid + rangeHeight / 2, MIN_PRICE + minPad, MAX_PRICE - minPad);
  const rangeLow = clamp(rangeMid - rangeHeight / 2, MIN_PRICE + minPad, rangeHigh - pct(0.015));

  const breakoutDirection: "up" | "down" = Math.random() < 0.5 ? "up" : "down";

  const edgeBuffer = pct(0.002);
  const wickUnit = pct(0.0018);
  const noiseUnit = pct(0.0008);
  const swingUnit = edgeBuffer * 2.4;
  const counterChance = 0.28;

  // We'll oscillate between support and resistance naturally
  // Using a wave-based approach with some randomness
  const candles: Candle[] = [];
  let previousClose = startPrice;

  // Transition to range area first (10-15 candles)
  const transitionLength = 10 + Math.floor(Math.random() * 6);
  const rangeLength = length - transitionLength - 12; // Reserve 12 for breakout
  const breakoutLength = 12;

  // Transition: drift toward range mid
  for (let i = 0; i < transitionLength; i += 1) {
    const progress = i / transitionLength;
    const target = previousClose + (rangeMid - previousClose) * 0.15;
    const noise = (Math.random() - 0.5) * noiseUnit * 2;
    const open = previousClose;
    const close = clamp(target + noise, MIN_PRICE, MAX_PRICE);
    const wickUp = wickUnit * (0.3 + Math.random() * 0.8);
    const wickDown = wickUnit * (0.3 + Math.random() * 0.8);
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;

    candles.push({ id: generateId(), open, high, low, close });
    previousClose = close;
  }

  // Range oscillation phase
  // Create deliberate swings that hit both support and resistance multiple times
  // We'll plan out the swings: at least 3-4 touches on each side
  const numSwings = 6 + Math.floor(Math.random() * 3); // 6-8 swings total
  const candlesPerSwing = Math.floor(rangeLength / numSwings);

  // Alternate between going to high and low, with some randomness on which we start with
  let goingUp = Math.random() < 0.5;

  for (let swing = 0; swing < numSwings; swing += 1) {
    const isLastSwing = swing === numSwings - 1;
    const swingCandles = isLastSwing ? rangeLength - candles.length + transitionLength : candlesPerSwing;

    // Target for this swing - actually reach the edge
    const targetEdge = goingUp ? rangeHigh : rangeLow;

    for (let j = 0; j < swingCandles; j += 1) {
      const swingProgress = (j + 1) / swingCandles;
      // Smooth easing toward the edge - stronger pull as we get closer to end
      const eased = Math.pow(swingProgress, 1.5);

      // Interpolate from current position toward target
      const distanceToTarget = targetEdge - previousClose;
      // Move more aggressively - cover most of the distance
      const stepSize = distanceToTarget * (0.15 + eased * 0.35);

      // Counter-trend candles for realism (less frequent, smaller)
      const isCounter = Math.random() < counterChance * 0.7;

      const noise = (Math.random() - 0.5) * noiseUnit * 1.5;
      const open = previousClose;
      let close: number;

      if (isCounter) {
        // Small counter-trend move
        const counterMove = swingUnit * 0.4 * (goingUp ? -1 : 1);
        close = previousClose + counterMove + noise;
      } else {
        close = previousClose + stepSize + noise;
      }

      // Allow closes to get very close to the edges
      close = clamp(close, rangeLow + edgeBuffer * 0.1, rangeHigh - edgeBuffer * 0.1);

      const isBullish = close >= open;
      const wickUp = wickUnit * (0.2 + Math.random() * (isBullish ? 0.5 : 0.9));
      const wickDown = wickUnit * (0.2 + Math.random() * (isBullish ? 0.9 : 0.5));

      let high = Math.max(open, close) + wickUp;
      let low = Math.min(open, close) - wickDown;

      // At swing endpoints, push the close right to the edge
      const nearEnd = j >= swingCandles - 2;
      if (nearEnd) {
        if (goingUp) {
          // Push close up near resistance
          close = clamp(rangeHigh - edgeBuffer * (0.05 + Math.random() * 0.1), rangeLow, rangeHigh);
          high = Math.max(close, rangeHigh + edgeBuffer * 0.2);
        } else {
          // Push close down near support
          close = clamp(rangeLow + edgeBuffer * (0.05 + Math.random() * 0.1), rangeLow, rangeHigh);
          low = Math.min(close, rangeLow - edgeBuffer * 0.2);
        }
      }

      // Clamp wicks
      high = Math.min(high, rangeHigh + edgeBuffer * 0.5);
      low = Math.max(low, rangeLow - edgeBuffer * 0.5);

      candles.push({ id: generateId(), open, high, low, close });
      previousClose = close;
    }

    // Flip direction for next swing
    goingUp = !goingUp;
  }

  // Breakout phase
  const breakoutStart = previousClose;
  const breakoutTarget =
    breakoutDirection === "up" ? rangeHigh + rangeHeight * (0.6 + Math.random() * 0.4) : rangeLow - rangeHeight * (0.6 + Math.random() * 0.4);

  for (let i = 0; i < breakoutLength; i += 1) {
    const progress = (i + 1) / breakoutLength;
    // Accelerating breakout
    const eased = progress * progress;
    const target = breakoutStart + (breakoutTarget - breakoutStart) * eased;

    const noise = (Math.random() - 0.5) * noiseUnit * 3;
    const open = previousClose;
    const close = clamp(target + noise, MIN_PRICE, MAX_PRICE);

    const isBullish = close >= open;
    const wickUp = wickUnit * (0.3 + Math.random() * (isBullish ? 0.5 : 1.0));
    const wickDown = wickUnit * (0.3 + Math.random() * (isBullish ? 1.0 : 0.5));

    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;

    candles.push({ id: generateId(), open, high, low, close });
    previousClose = close;
  }

  return { candles, rangeHigh, rangeLow, breakoutDirection };
};

export const rangePattern: PatternDefinition = {
  id: "range",
  label: "Range",
  length: PATTERN_LENGTH,
  generate: (startPrice: number): PatternResult => {
    const { candles, rangeHigh, rangeLow, breakoutDirection } = generateRange(startPrice, PATTERN_LENGTH);
    const lastCandle = candles[candles.length - 1];
    const targetPrice = breakoutDirection === "up" ? lastCandle.close * 1.02 : lastCandle.close * 0.98;

    const lines: PatternLine[] = [
      {
        id: "range-resistance",
        type: "resistance",
        startOffset: 0,
        endOffset: PATTERN_LENGTH - 1,
        startPrice: rangeHigh,
        endPrice: rangeHigh,
      },
      {
        id: "range-support",
        type: "support",
        startOffset: 0,
        endOffset: PATTERN_LENGTH - 1,
        startPrice: rangeLow,
        endPrice: rangeLow,
      },
    ];

    return { candles, lines, targetPrice };
  },
};
