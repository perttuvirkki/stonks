export type Candle = {
  id: string;
  open: number;
  close: number;
  high: number;
  low: number;
  index?: number;
};

export type PatternBias = "bullish" | "bearish" | "neutral";

export type PatternDefinition = {
  id: string;
  label: string;
  bias: PatternBias;
  /** Typical formation length in candles (each generation varies). */
  length: number;
  generate: (startPrice: number) => PatternResult;
};

export type PatternResult = {
  /** The formation itself. */
  candles: Candle[];
  /** Breakout, optional retest and the move to the measured target. Plays right after `candles`. */
  runout: Candle[];
  targetPrice: number;
  breakoutPrice: number;
  lines: PatternLine[];
};

export type PatternLineKind = "support" | "resistance" | "neckline" | "target" | "guide";

/** `offset` counts candles from the first formation candle (runout candles continue the count). */
export type PatternLinePoint = { offset: number; price: number };

export type PatternLine = {
  id: string;
  type: PatternLineKind;
  /** Two or more anchor points, sorted by offset. */
  points: PatternLinePoint[];
  /** The line appears once this candle has printed (usually its second touch). */
  revealOffset: number;
  /** How many candles past the last anchor the line keeps extending (straight projection). */
  extendBy: number;
};
