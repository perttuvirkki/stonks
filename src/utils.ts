import { MAX_PRICE, MIN_PRICE, VOLATILITY, WICK_VARIANCE } from "./constants";
import type { Candle } from "./types";

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const randomNormal = () => {
  // Box–Muller transform.
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const randomAbsNormal = () => Math.abs(randomNormal());

const randomAbsNormalClamped = (max: number) => Math.min(randomAbsNormal(), max);

export const getPinchAxes = (touches: { pageX: number; pageY: number }[]) => {
  if (touches.length < 2) {
    return { dx: 0, dy: 0 };
  }
  const [first, second] = touches;
  const dx = Math.abs(first.pageX - second.pageX);
  const dy = Math.abs(first.pageY - second.pageY);
  return { dx, dy };
};

export const createCandle = (previousClose: number): Candle => {
  // Add a small, realistic gap between previous close and next open.
  const gap = randomNormal() * VOLATILITY * 0.06;
  const open = clamp(previousClose + gap, MIN_PRICE, MAX_PRICE);

  // Mixture distribution: mostly small moves, sometimes bigger impulses.
  const impulseChance = 0.08;
  const baseMove = randomNormal() * VOLATILITY * 0.28;
  const impulseMove = Math.random() < impulseChance ? randomNormal() * VOLATILITY * 1.15 : 0;
  const dojiChance = 0.12;

  const rawClose = Math.random() < dojiChance ? open + randomNormal() * VOLATILITY * 0.06 : open + baseMove + impulseMove;
  const close = clamp(rawClose, MIN_PRICE, MAX_PRICE);

  const bodySize = Math.abs(close - open);

  // Wicks: tied to body + baseline variance, with rare long-wick spikes.
  const longWickChance = 0.04;
  const wickMultiplier = (Math.random() < longWickChance ? 2.0 : 1) * (0.45 + Math.random() * 0.85);
  const wickSize = (WICK_VARIANCE * 0.8 + bodySize * 0.25) * wickMultiplier;
  const wickDraw = randomAbsNormalClamped(1.9);
  const high = clamp(Math.max(open, close) + wickDraw * wickSize, MIN_PRICE, MAX_PRICE);
  const low = clamp(Math.min(open, close) - wickDraw * wickSize, MIN_PRICE, MAX_PRICE);

  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    open,
    close,
    high,
    low,
  };
};

export type TargetRunoutOptions = {
  speedMultiplier?: number; // <1 = faster (fewer candles), >1 = slower
  minSteps?: number;
  maxSteps?: number;
  overshootMultiplier?: number;
  counterChanceMultiplier?: number;
};

export const createTargetRunout = (startPrice: number, targetPrice: number, options: TargetRunoutOptions = {}): Candle[] => {
  const distance = targetPrice - startPrice;
  if (distance === 0) {
    return [];
  }

  const absDistance = Math.abs(distance);
  const direction = distance > 0 ? 1 : -1;

  // Determine drama level: 0 = calm, 1 = normal, 2 = explosive, 3 = violent
  const dramaRoll = Math.random();
  const dramaLevel = dramaRoll < 0.15 ? 3 : dramaRoll < 0.35 ? 2 : dramaRoll < 0.7 ? 1 : 0;

  // Drama affects step count, speed, and overshoot
  const baseSteps = Math.max(6, Math.min(18, Math.round(absDistance / 2)));
  const stepMultiplier = dramaLevel === 3 ? 0.4 : dramaLevel === 2 ? 0.6 : dramaLevel === 0 ? 1.3 : 1;
  const speedMultiplier = typeof options.speedMultiplier === "number" && isFinite(options.speedMultiplier) && options.speedMultiplier > 0 ? options.speedMultiplier : 1;
  const minSteps = typeof options.minSteps === "number" && isFinite(options.minSteps) ? Math.max(1, Math.floor(options.minSteps)) : 3;
  const maxSteps = typeof options.maxSteps === "number" && isFinite(options.maxSteps) ? Math.max(minSteps, Math.floor(options.maxSteps)) : Infinity;
  const totalSteps = Math.min(maxSteps, Math.max(minSteps, Math.round(baseSteps * stepMultiplier * speedMultiplier)));
  const runSteps = Math.max(1, totalSteps - 1);

  // Overshoot for dramatic moves
  const overshootMultiplier =
    typeof options.overshootMultiplier === "number" && isFinite(options.overshootMultiplier) && options.overshootMultiplier >= 0
      ? options.overshootMultiplier
      : 1;
  const overshootAmount =
    dramaLevel === 3 ? absDistance * (0.15 + Math.random() * 0.2) : dramaLevel === 2 ? absDistance * (0.06 + Math.random() * 0.12) : 0;
  const overshootTarget = targetPrice + direction * (overshootAmount * overshootMultiplier);

  // Counter-trend chance varies by drama
  const counterChanceMultiplier =
    typeof options.counterChanceMultiplier === "number" && isFinite(options.counterChanceMultiplier) && options.counterChanceMultiplier >= 0
      ? options.counterChanceMultiplier
      : 1;
  const counterChance = (dramaLevel === 3 ? 0.06 : dramaLevel === 2 ? 0.12 : dramaLevel === 0 ? 0.3 : 0.22) * counterChanceMultiplier;

  // Acceleration factor for explosive moves (front-loads the move)
  const useAcceleration = dramaLevel >= 2;

  const candles: Candle[] = [];
  let previousClose = startPrice;

  for (let index = 0; index < runSteps; index += 1) {
    const progress = (index + 1) / runSteps;

    // For dramatic moves, accelerate early then slow down
    let effectiveProgress = progress;
    if (useAcceleration) {
      // Ease-out curve: most movement happens early
      effectiveProgress = 1 - Math.pow(1 - progress, dramaLevel === 3 ? 3 : 2);
    }

    const currentTarget = dramaLevel >= 2 && index < runSteps - 2 ? overshootTarget : targetPrice;
    const targetAtProgress = startPrice + (currentTarget - startPrice) * effectiveProgress;

    const remaining = targetAtProgress - previousClose;
    const stepSize = remaining * (0.4 + Math.random() * 0.4);

    // Momentum candles for dramatic moves
    const momentumMultiplier = dramaLevel === 3 ? 1.8 + Math.random() * 0.8 : dramaLevel === 2 ? 1.3 + Math.random() * 0.5 : 1;

    const wiggle = (Math.random() - 0.5) * Math.abs(stepSize) * (dramaLevel === 0 ? 0.7 : 0.35);
    let close = previousClose + stepSize * momentumMultiplier + wiggle;

    const reverseBar = Math.random() < counterChance;
    if (reverseBar) {
      const reverseFactor = dramaLevel >= 2 ? 0.06 + Math.random() * 0.14 : 0.1 + Math.random() * 0.2;
      const reverseSize = Math.abs(stepSize) * reverseFactor;
      close = previousClose - direction * reverseSize + (Math.random() - 0.5) * Math.abs(stepSize) * 0.2;
    } else {
      close = direction > 0 ? Math.max(close, previousClose + Math.abs(stepSize) * 0.2) : Math.min(close, previousClose - Math.abs(stepSize) * 0.2);
    }

    // Clamp but allow overshoot for dramatic moves
    const clampMax = direction > 0 ? Math.max(MAX_PRICE, overshootTarget) : MAX_PRICE;
    const clampMin = direction < 0 ? Math.min(MIN_PRICE, overshootTarget) : MIN_PRICE;
    close = clamp(close, Math.max(MIN_PRICE, clampMin), Math.min(MAX_PRICE, clampMax));

    const open = previousClose;
    const bodySize = Math.abs(close - open);

    // Bigger wicks for dramatic moves
    const longWickChance = dramaLevel >= 2 ? 0.15 : 0.03;
    const baseWickMultiplier = dramaLevel === 3 ? 1.6 : dramaLevel === 2 ? 1.3 : 1;
    const wickMultiplier = (Math.random() < longWickChance ? 2.2 : baseWickMultiplier) * (0.45 + Math.random() * 0.75);
    const wickSize = (WICK_VARIANCE * 0.55 + bodySize * 0.22) * wickMultiplier;
    const wickDraw = randomAbsNormalClamped(dramaLevel >= 2 ? 2.2 : 1.7);
    const high = clamp(Math.max(open, close) + wickDraw * wickSize, MIN_PRICE, MAX_PRICE);
    const low = clamp(Math.min(open, close) - wickDraw * wickSize, MIN_PRICE, MAX_PRICE);

    candles.push({
      id: `${Date.now()}-${index}-${Math.floor(Math.random() * 100000)}`,
      open,
      close,
      high,
      low,
    });

    previousClose = close;
  }

  // Final candle - for dramatic moves, might need to snap back from overshoot
  const finalOpen = previousClose;
  const finalClose = targetPrice;
  const finalBodySize = Math.abs(finalClose - finalOpen);

  // Dramatic finale candle
  const finalWickMultiplier = (Math.random() < (dramaLevel >= 2 ? 0.2 : 0.05) ? 2.5 : 1) * (0.5 + Math.random() * 0.85);
  const finalWickSize = (WICK_VARIANCE * 0.6 + finalBodySize * 0.22) * finalWickMultiplier;
  const finalWickDraw = randomAbsNormalClamped(dramaLevel >= 2 ? 2.5 : 1.7);
  const finalHigh = clamp(Math.max(finalOpen, finalClose) + finalWickDraw * finalWickSize, MIN_PRICE, MAX_PRICE);
  const finalLow = clamp(Math.min(finalOpen, finalClose) - finalWickDraw * finalWickSize, MIN_PRICE, MAX_PRICE);

  candles.push({
    id: `${Date.now()}-target-${Math.floor(Math.random() * 100000)}`,
    open: finalOpen,
    close: finalClose,
    high: finalHigh,
    low: finalLow,
  });

  return candles;
};
