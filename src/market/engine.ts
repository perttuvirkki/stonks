import { BASE_PRICE, CANDLE_VOLATILITY, MAX_PRICE, MIN_PRICE } from "../constants";
import type { Candle } from "../types";
import { chance, gaussian, range, shock } from "./random";

// The market engine produces every candle in the game: ambient noise between patterns and
// the pattern formations themselves. All moves are percentage-based (so the chart behaves the
// same at 100 or 1500) and share one volatility regime, so patterns blend into the tape.

const clampPrice = (value: number) => Math.min(MAX_PRICE, Math.max(MIN_PRICE, value));

let candleSeq = 0;
const nextCandleId = () => `c${(candleSeq += 1)}`;

// Volatility clustering: a log-AR(1) regime gives calm stretches and nervous bursts.
let logRegime = 0;
const stepRegime = () => {
  logRegime = Math.max(-0.6, Math.min(0.75, 0.96 * logRegime + 0.1 * gaussian()));
  return Math.exp(logRegime);
};

// Last close-to-close move, for a little momentum between candles.
let lastMove = 0;

/** Typical close-to-close move for one candle at this price, in the current regime. */
export const candleSigma = (price: number) => Math.max(price, 20) * CANDLE_VOLATILITY * Math.exp(logRegime);

const buildCandle = (open: number, close: number, sigma: number, ceiling = Infinity, floor = -Infinity): Candle => {
  const wickScale = sigma * (chance(0.05) ? 1.5 : 0.45);
  const top = Math.max(open, close);
  const bottom = Math.min(open, close);
  const high = Math.min(top + Math.abs(gaussian()) * wickScale, Math.max(ceiling, top));
  const low = Math.max(bottom - Math.abs(gaussian()) * wickScale, Math.min(floor, bottom));
  return { id: nextCandleId(), open, close, high: clampPrice(high), low: clampPrice(low) };
};

/** One ambient candle: momentum + fat-tailed noise + a faint pull back toward BASE_PRICE. */
export const createCandle = (previousClose: number): Candle => {
  const regime = stepRegime();
  const sigma = Math.max(previousClose, 20) * CANDLE_VOLATILITY * regime;
  const meanPull = -0.03 * sigma * Math.log(Math.max(previousClose, 1) / BASE_PRICE);
  const move = 0.15 * lastMove + sigma * shock() + meanPull;
  lastMove = move;
  const close = clampPrice(previousClose + move);
  return buildCandle(previousClose, close, sigma);
};

export type PathPivot = {
  /** Candle index (0 = first candle after the start price) where this swing completes. */
  index: number;
  /** Price the swing reaches: the candle's high for "high", its low for "low", its close for "close". */
  price: number;
  kind: "high" | "low" | "close";
  /** Volatility multiplier for the leg that ends at this pivot (impulses > 1, consolidation < 1). */
  volScale?: number;
};

export type PathOptions = {
  sigma: number;
  /** Pattern boundaries for a candle; closes reflect off them and wicks stop at them. */
  bounds?: (index: number) => { upper: number; lower: number } | null;
  /** Extra volatility multiplier per candle (e.g. contracting inside a triangle). */
  volScale?: (index: number) => number;
};

const reflect = (value: number, lower: number, upper: number) => {
  const span = upper - lower;
  if (span <= 0) {
    return (lower + upper) / 2;
  }
  const period = span * 2;
  const offset = (((value - lower) % period) + period) % period;
  return lower + (offset > span ? period - offset : offset);
};

/**
 * Render candles that travel through a list of swing pivots. Each leg is a Brownian bridge
 * around an eased path: it wanders like real price but is pinned to land exactly on the
 * pivot, never overshoots the leg's own extremes (so every pivot is a true swing high/low)
 * and stays inside any pattern bounds. Pivot candles put their wick on the level and close
 * back inside, which is what a touch of a trendline looks like on a real chart.
 */
export const renderPath = (startClose: number, pivots: PathPivot[], options: PathOptions): Candle[] => {
  const candles: Candle[] = [];
  let legStartClose = startClose;
  let legStartExtreme = startClose;
  let previousIndex = -1;
  const baseRegime = logRegime;

  for (const pivot of pivots) {
    const bars = pivot.index - previousIndex;
    if (bars <= 0) {
      continue;
    }
    const legSigma = options.sigma * (pivot.volScale ?? 1);
    const legHigh = Math.max(legStartExtreme, pivot.price);
    const legLow = Math.min(legStartExtreme, pivot.price);
    const rejection = range(0.12, 0.8) * legSigma;
    const rawTargetClose = pivot.kind === "high" ? pivot.price - rejection : pivot.kind === "low" ? pivot.price + rejection : pivot.price;
    const targetClose = Math.min(legHigh, Math.max(legLow, rawTargetClose));

    // Brownian bridge: a random walk with its endpoint drift removed, so it returns to 0.
    const walk = new Array<number>(bars);
    let accumulated = 0;
    for (let step = 0; step < bars; step += 1) {
      const index = previousIndex + step + 1;
      stepRegime();
      const regime = Math.exp(logRegime - baseRegime);
      accumulated += shock() * legSigma * regime * (options.volScale?.(index) ?? 1);
      walk[step] = accumulated;
    }
    const shape = range(0.25, 0.9);

    let open = legStartClose;
    for (let step = 1; step <= bars; step += 1) {
      const index = previousIndex + step;
      const isPivotCandle = step === bars;
      const progress = step / bars;
      const eased = progress + (progress * progress * (3 - 2 * progress) - progress) * shape;
      const bridge = walk[step - 1] - progress * walk[bars - 1];
      let close = isPivotCandle ? targetClose : legStartClose + (targetClose - legStartClose) * eased + bridge;

      // Non-pivot candles keep a hair inside the leg so the pivot stays the extreme.
      const inset = isPivotCandle ? 0 : legSigma * 0.05;
      let ceiling = legHigh - inset;
      let floor = legLow + inset;
      const bound = options.bounds?.(index);
      if (bound) {
        ceiling = Math.min(ceiling, isPivotCandle && pivot.kind === "high" ? Math.max(bound.upper, pivot.price) : bound.upper);
        floor = Math.max(floor, isPivotCandle && pivot.kind === "low" ? Math.min(bound.lower, pivot.price) : bound.lower);
      }
      if (ceiling < floor) {
        ceiling = floor = (ceiling + floor) / 2;
      }
      close = reflect(close, floor, ceiling);

      const candle = buildCandle(open, close, legSigma, ceiling, floor);
      if (isPivotCandle && pivot.kind === "high") {
        candle.high = clampPrice(Math.max(pivot.price, candle.open, candle.close));
      } else if (isPivotCandle && pivot.kind === "low") {
        candle.low = clampPrice(Math.min(pivot.price, candle.open, candle.close));
      }
      candle.close = clampPrice(candle.close);
      candles.push(candle);
      lastMove = candle.close - open;
      open = candle.close;
    }

    legStartClose = open;
    legStartExtreme = pivot.kind === "close" ? open : pivot.price;
    previousIndex = pivot.index;
  }
  return candles;
};
