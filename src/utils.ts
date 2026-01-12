import { MAX_PRICE, MIN_PRICE, VOLATILITY, WICK_VARIANCE } from './constants';
import type { Candle } from './types';

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

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
  const open = previousClose;
  const rawClose = open + (Math.random() - 0.5) * VOLATILITY;
  const close = clamp(rawClose, MIN_PRICE, MAX_PRICE);
  const wickScale = 0.6 + Math.random() * 0.9;
  const wickSize = WICK_VARIANCE * wickScale;
  const high = Math.max(open, close) + Math.random() * wickSize;
  const low = Math.min(open, close) - Math.random() * wickSize;

  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    open,
    close,
    high,
    low,
  };
};

export const createTargetRunout = (
  startPrice: number,
  targetPrice: number,
): Candle[] => {
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
      close =
        previousClose -
        direction * reverseSize +
        (Math.random() - 0.5) * Math.abs(step) * 0.2;
    } else {
      close =
        direction > 0
          ? Math.max(close, previousClose + Math.abs(step) * 0.2)
          : Math.min(close, previousClose - Math.abs(step) * 0.2);
    }
    const open = previousClose;
    const wickScale = 0.5 + Math.random() * 0.8;
    const wickSize = 0.8 * wickScale;
    const high = Math.max(open, close) + Math.random() * wickSize;
    const low = Math.min(open, close) - Math.random() * wickSize;

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
  const finalWickScale = 0.5 + Math.random() * 0.8;
  const finalWickSize = 0.8 * finalWickScale;
  const finalHigh = Math.max(finalOpen, finalClose) + Math.random() * finalWickSize;
  const finalLow = Math.min(finalOpen, finalClose) - Math.random() * finalWickSize;

  candles.push({
    id: `${Date.now()}-target-${Math.floor(Math.random() * 100000)}`,
    open: finalOpen,
    close: finalClose,
    high: finalHigh,
    low: finalLow,
  });

  return candles;
};
