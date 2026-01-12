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

export const createTargetRunout = (startPrice: number, targetPrice: number): Candle[] => {
  const distance = targetPrice - startPrice;
  if (distance === 0) {
    return [];
  }

  const absDistance = Math.abs(distance);
  const totalSteps = Math.max(6, Math.min(18, Math.round(absDistance / 2)));
  const runSteps = Math.max(1, totalSteps - 1);
  const candles: Candle[] = [];
  let previousClose = startPrice;
  const direction = distance > 0 ? 1 : -1;
  const counterChance = 0.35;

  for (let index = 0; index < runSteps; index += 1) {
    const remaining = targetPrice - previousClose;
    const step = remaining / (runSteps - index + 1);
    const wiggle = (Math.random() - 0.5) * Math.abs(step) * 0.9;
    let close = previousClose + step + wiggle;
    const reverseBar = Math.random() < counterChance;
    if (reverseBar) {
      const reverseSize = Math.abs(step) * (0.2 + Math.random() * 0.6);
      close = previousClose - direction * reverseSize + (Math.random() - 0.5) * Math.abs(step) * 0.2;
    } else {
      close = direction > 0 ? Math.max(close, previousClose + Math.abs(step) * 0.2) : Math.min(close, previousClose - Math.abs(step) * 0.2);
    }
    const open = previousClose;
    const bodySize = Math.abs(close - open);
    const longWickChance = 0.03;
    const wickMultiplier = (Math.random() < longWickChance ? 1.8 : 1) * (0.45 + Math.random() * 0.75);
    const wickSize = (WICK_VARIANCE * 0.55 + bodySize * 0.22) * wickMultiplier;
    const wickDraw = randomAbsNormalClamped(1.7);
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

  const finalOpen = previousClose;
  const finalClose = targetPrice;
  const finalBodySize = Math.abs(finalClose - finalOpen);
  const finalWickMultiplier = (Math.random() < 0.05 ? 1.9 : 1) * (0.5 + Math.random() * 0.85);
  const finalWickSize = (WICK_VARIANCE * 0.6 + finalBodySize * 0.22) * finalWickMultiplier;
  const finalWickDraw = randomAbsNormalClamped(1.7);
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
