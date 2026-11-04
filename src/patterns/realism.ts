import { MAX_PRICE, MIN_PRICE } from "../constants";
import type { Candle } from "../types";
import { clamp } from "../utils";

export type RandomSource = () => number;

const safeRandom = (random: RandomSource) => {
  const value = random();
  return Number.isFinite(value) ? clamp(value, Number.EPSILON, 1 - Number.EPSILON) : 0.5;
};

const randomNormal = (random: RandomSource) => {
  const u = safeRandom(random);
  const v = safeRandom(random);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

/**
 * Adds market-like microstructure to a generator's clean geometric path.
 * The close remains tightly anchored to the original pattern, while opens,
 * volatility, and wicks gain correlated variation instead of independent noise.
 */
export const enhancePatternCandles = (candles: Candle[], startPrice: number, random: RandomSource = Math.random): Candle[] => {
  if (candles.length === 0) return [];

  const referencePrice = Math.max(1, Math.abs(startPrice));
  const observedRanges = candles
    .map((candle) => candle.high - candle.low)
    .filter((range) => Number.isFinite(range) && range > 0);
  const baselineRange = clamp(median(observedRanges) || referencePrice * 0.003, referencePrice * 0.0012, referencePrice * 0.018);

  let previousClose = clamp(startPrice, MIN_PRICE, MAX_PRICE);
  let correlatedNoise = 0;
  let volatilityRegime = 0.85 + safeRandom(random) * 0.3;

  return candles.map((candle, index) => {
    const rawOpen = Number.isFinite(candle.open) ? candle.open : previousClose;
    const rawClose = Number.isFinite(candle.close) ? candle.close : rawOpen;
    const rawHigh = Number.isFinite(candle.high) ? candle.high : Math.max(rawOpen, rawClose);
    const rawLow = Number.isFinite(candle.low) ? candle.low : Math.min(rawOpen, rawClose);
    const rawBody = Math.abs(rawClose - rawOpen);

    // Volatility tends to persist. Large bodies raise the next few candles'
    // regime, and rare shocks create short-lived bursts of wider ranges.
    const shockRegime = safeRandom(random) < 0.035 ? 1.45 + safeRandom(random) * 0.55 : 0;
    const ordinaryRegime = 0.72 + Math.min(0.85, (rawBody / baselineRange) * 0.18) + safeRandom(random) * 0.25;
    volatilityRegime = clamp(volatilityRegime * 0.86 + Math.max(shockRegime, ordinaryRegime) * 0.14, 0.62, 1.9);

    // Most traded markets are nearly continuous candle-to-candle. Small gaps
    // remain possible, with a low chance of a larger micro-gap.
    const gapScale = baselineRange * 0.035 * volatilityRegime * (safeRandom(random) < 0.025 ? 3 : 1);
    const gap = clamp(randomNormal(random) * gapScale, -baselineRange * 0.18, baselineRange * 0.18);
    const open = clamp(index === 0 ? rawOpen : previousClose + gap, MIN_PRICE, MAX_PRICE);

    // AR(1) noise creates short runs instead of white-noise zig-zags. Its
    // amplitude is capped so the defining geometric pattern remains visible.
    correlatedNoise = correlatedNoise * 0.58 + randomNormal(random) * baselineRange * 0.055 * volatilityRegime;
    const geometryOffset = clamp(correlatedNoise + (open - rawOpen) * 0.12, -baselineRange * 0.28, baselineRange * 0.28);
    let close = rawClose + geometryOffset;

    // Quiet source candles can become dojis, but strong structural legs stay
    // directional so flags, wedges, shoulders, and cups retain their shape.
    if (rawBody < baselineRange * 0.25 && safeRandom(random) < 0.16) {
      const dojiClose = open + randomNormal(random) * baselineRange * 0.055 * volatilityRegime;
      close = close * 0.58 + dojiClose * 0.42;
    }
    close = clamp(close, Math.max(MIN_PRICE, rawClose - baselineRange * 0.34), Math.min(MAX_PRICE, rawClose + baselineRange * 0.34));

    const bodyHigh = Math.max(open, close);
    const bodyLow = Math.min(open, close);
    const bodySize = Math.abs(close - open);
    const wickBase = baselineRange * (0.12 + volatilityRegime * 0.16) + bodySize * 0.14;
    const bullishBody = close >= open;
    const upperAsymmetry = bullishBody ? 0.8 + safeRandom(random) * 0.55 : 0.95 + safeRandom(random) * 0.65;
    const lowerAsymmetry = bullishBody ? 0.95 + safeRandom(random) * 0.65 : 0.8 + safeRandom(random) * 0.55;
    const liquiditySweep = safeRandom(random) < 0.035;
    const sweepUp = liquiditySweep && safeRandom(random) < 0.5;
    const upperWick = Math.min(2.8, Math.abs(randomNormal(random))) * wickBase * upperAsymmetry * (sweepUp ? 2.2 : 1);
    const lowerWick = Math.min(2.8, Math.abs(randomNormal(random))) * wickBase * lowerAsymmetry * (liquiditySweep && !sweepUp ? 2.2 : 1);

    // Retain deliberate touches from the source generator while allowing small
    // natural deviations and occasional liquidity sweeps through a trend line.
    const high = clamp(Math.max(bodyHigh + upperWick, rawHigh + randomNormal(random) * baselineRange * 0.025), bodyHigh, MAX_PRICE);
    const low = clamp(Math.min(bodyLow - lowerWick, rawLow + randomNormal(random) * baselineRange * 0.025), MIN_PRICE, bodyLow);

    previousClose = close;
    return { ...candle, open, close, high, low };
  });
};
