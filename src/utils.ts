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
  retestChance?: number;
  random?: () => number;
};

export const createTargetRunout = (startPrice: number, targetPrice: number, options: TargetRunoutOptions = {}): Candle[] => {
  const random = options.random ?? Math.random;
  const nextRandom = () => {
    const value = random();
    return Number.isFinite(value) ? clamp(value, Number.EPSILON, 1 - Number.EPSILON) : 0.5;
  };
  const nextNormal = () => {
    const u = nextRandom();
    const v = nextRandom();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const smoothstep = (value: number) => value * value * (3 - 2 * value);

  const safeStartPrice = clamp(Number.isFinite(startPrice) ? startPrice : MIN_PRICE, MIN_PRICE, MAX_PRICE);
  const safeTargetPrice = clamp(Number.isFinite(targetPrice) ? targetPrice : safeStartPrice, MIN_PRICE, MAX_PRICE);
  const distance = safeTargetPrice - safeStartPrice;
  if (distance === 0) {
    return [];
  }

  const absDistance = Math.abs(distance);
  const direction = distance > 0 ? 1 : -1;

  // Drama changes tempo and follow-through, while the phase model below keeps
  // even violent moves structurally plausible.
  const dramaRoll = nextRandom();
  const dramaLevel = dramaRoll < 0.15 ? 3 : dramaRoll < 0.35 ? 2 : dramaRoll < 0.7 ? 1 : 0;

  // Drama affects step count, speed, and overshoot
  const baseSteps = Math.max(6, Math.min(18, Math.round(absDistance / 2)));
  const stepMultiplier = dramaLevel === 3 ? 0.4 : dramaLevel === 2 ? 0.6 : dramaLevel === 0 ? 1.3 : 1;
  const speedMultiplier = typeof options.speedMultiplier === "number" && isFinite(options.speedMultiplier) && options.speedMultiplier > 0 ? options.speedMultiplier : 1;
  const minSteps = typeof options.minSteps === "number" && isFinite(options.minSteps) ? Math.max(1, Math.floor(options.minSteps)) : 3;
  const maxSteps = typeof options.maxSteps === "number" && isFinite(options.maxSteps) ? Math.max(minSteps, Math.floor(options.maxSteps)) : Infinity;
  const totalSteps = Math.min(maxSteps, Math.max(minSteps, Math.round(baseSteps * stepMultiplier * speedMultiplier)));
  const runSteps = Math.max(0, totalSteps - 1);

  // Overshoot for dramatic moves
  const overshootMultiplier =
    typeof options.overshootMultiplier === "number" && isFinite(options.overshootMultiplier) && options.overshootMultiplier >= 0
      ? options.overshootMultiplier
      : 1;
  const overshootAmount =
    dramaLevel === 3 ? absDistance * (0.1 + nextRandom() * 0.16) : dramaLevel === 2 ? absDistance * (0.04 + nextRandom() * 0.08) : 0;

  // Counter-trend chance varies by drama
  const counterChanceMultiplier =
    typeof options.counterChanceMultiplier === "number" && isFinite(options.counterChanceMultiplier) && options.counterChanceMultiplier >= 0
      ? options.counterChanceMultiplier
      : 1;
  const counterChance = (dramaLevel === 3 ? 0.06 : dramaLevel === 2 ? 0.12 : dramaLevel === 0 ? 0.3 : 0.22) * counterChanceMultiplier;
  const requestedRetestChance = typeof options.retestChance === "number" && Number.isFinite(options.retestChance) ? options.retestChance : 0.56;
  const hasRetest = totalSteps >= 8 && nextRandom() < clamp(requestedRetestChance, 0, 1);
  const impulseEnd = 0.3;
  const retestEnd = 0.55;
  const impulseFraction = 0.5 + nextRandom() * (dramaLevel >= 2 ? 0.22 : 0.14);
  const retestFraction = impulseFraction * (0.34 + nextRandom() * 0.22);

  const getPathProgress = (progress: number) => {
    if (!hasRetest) {
      return dramaLevel >= 2 ? 1 - Math.pow(1 - progress, 1.65) : smoothstep(progress);
    }
    if (progress <= impulseEnd) {
      return impulseFraction * (1 - Math.pow(1 - progress / impulseEnd, 2));
    }
    if (progress <= retestEnd) {
      const phase = smoothstep((progress - impulseEnd) / (retestEnd - impulseEnd));
      return impulseFraction + (retestFraction - impulseFraction) * phase;
    }
    const phase = smoothstep((progress - retestEnd) / (1 - retestEnd));
    return retestFraction + (1 - retestFraction) * phase;
  };

  const candles: Candle[] = [];
  let previousClose = safeStartPrice;
  let correlatedNoise = 0;
  let volatilityRegime = 0.85 + nextRandom() * 0.35;

  for (let index = 0; index < runSteps; index += 1) {
    // The last target candle is reserved below, so progress never reaches 1
    // early. This avoids a duplicate target close followed by a snap-back.
    const progress = (index + 1) / totalSteps;
    const pathProgress = getPathProgress(progress);
    const overshootPhase = progress > 0.72 ? Math.sin(((progress - 0.72) / 0.28) * Math.PI) : 0;
    const overshoot = overshootAmount * overshootMultiplier * Math.max(0, overshootPhase);
    const pathTarget = safeStartPrice + distance * pathProgress + direction * overshoot;

    const expectedStep = absDistance / Math.max(1, totalSteps);
    const shock = nextRandom() < 0.06 ? 1.45 + nextRandom() * 0.55 : 0.75 + nextRandom() * 0.35;
    volatilityRegime = clamp(volatilityRegime * 0.82 + shock * 0.18, 0.65, 1.85);
    correlatedNoise = correlatedNoise * 0.52 + nextNormal() * expectedStep * 0.13 * volatilityRegime;

    const inPlannedRetest = hasRetest && progress > impulseEnd && progress <= retestEnd;
    let close = pathTarget + correlatedNoise;
    if (!inPlannedRetest && nextRandom() < counterChance) {
      close = previousClose - direction * expectedStep * (0.08 + nextRandom() * 0.24) + correlatedNoise * 0.4;
    }
    close = clamp(close, MIN_PRICE, MAX_PRICE);

    const gapScale = Math.min(WICK_VARIANCE * 0.12, expectedStep * 0.05) * volatilityRegime;
    const gapLimit = Math.min(WICK_VARIANCE * 0.25, expectedStep * 0.12);
    const open = clamp(previousClose + clamp(nextNormal() * gapScale, -gapLimit, gapLimit), MIN_PRICE, MAX_PRICE);
    const bodySize = Math.abs(close - open);

    // Wicks inherit the clustered regime and become asymmetric around momentum
    // bodies. Rare sweeps mimic stops being taken around a breakout or retest.
    const longWickChance = dramaLevel >= 2 ? 0.15 : 0.03;
    const baseWickMultiplier = dramaLevel === 3 ? 1.6 : dramaLevel === 2 ? 1.3 : 1;
    const wickMultiplier = (nextRandom() < longWickChance ? 2.2 : baseWickMultiplier) * (0.45 + nextRandom() * 0.75) * volatilityRegime;
    const wickSize = (WICK_VARIANCE * 0.42 + bodySize * 0.16 + expectedStep * 0.08) * wickMultiplier;
    const upperWick = Math.min(Math.abs(nextNormal()), dramaLevel >= 2 ? 2.2 : 1.7) * wickSize * (close >= open ? 0.82 : 1.08);
    const lowerWick = Math.min(Math.abs(nextNormal()), dramaLevel >= 2 ? 2.2 : 1.7) * wickSize * (close >= open ? 1.08 : 0.82);
    const high = clamp(Math.max(open, close) + upperWick, Math.max(open, close), MAX_PRICE);
    const low = clamp(Math.min(open, close) - lowerWick, MIN_PRICE, Math.min(open, close));

    candles.push({
      id: `${Date.now()}-${index}-${Math.floor(nextRandom() * 100000)}`,
      open,
      close,
      high,
      low,
    });

    previousClose = close;
  }

  // The game resolves on an exact target, but the final candle still inherits
  // the active volatility regime and may wick beyond it before closing there.
  const finalOpen = previousClose;
  const finalClose = safeTargetPrice;
  const finalBodySize = Math.abs(finalClose - finalOpen);

  const finalWickMultiplier = (nextRandom() < (dramaLevel >= 2 ? 0.2 : 0.05) ? 2.5 : 1) * (0.5 + nextRandom() * 0.85) * volatilityRegime;
  const finalWickSize = (WICK_VARIANCE * 0.6 + finalBodySize * 0.22) * finalWickMultiplier;
  const finalHigh = clamp(Math.max(finalOpen, finalClose) + Math.min(Math.abs(nextNormal()), dramaLevel >= 2 ? 2.5 : 1.7) * finalWickSize, Math.max(finalOpen, finalClose), MAX_PRICE);
  const finalLow = clamp(Math.min(finalOpen, finalClose) - Math.min(Math.abs(nextNormal()), dramaLevel >= 2 ? 2.5 : 1.7) * finalWickSize, MIN_PRICE, Math.min(finalOpen, finalClose));

  candles.push({
    id: `${Date.now()}-target-${Math.floor(nextRandom() * 100000)}`,
    open: finalOpen,
    close: finalClose,
    high: finalHigh,
    low: finalLow,
  });

  return candles;
};
