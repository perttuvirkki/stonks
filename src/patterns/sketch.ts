import { candleSigma, renderPath, type PathPivot } from "../market/engine";
import { chance, gaussian, range, rangeInt } from "../market/random";
import type { PatternDefinition, PatternLine, PatternLineKind, PatternResult } from "../types";

// A Sketch describes a chart pattern as swing pivots and trendlines, then hands it to the
// market engine to turn into candles. Patterns are written once in a "bullish" orientation;
// `dir = -1` mirrors the whole thing vertically, which is how every bearish twin is made.

export type Line = { i0: number; p0: number; i1: number; p1: number };

export const lineAt = (line: Line, index: number) =>
  line.i1 === line.i0 ? line.p0 : line.p0 + ((line.p1 - line.p0) * (index - line.i0)) / (line.i1 - line.i0);

/** "top" is the side the pattern breaks out toward in its bullish orientation. */
export type Side = "top" | "bottom";

type Channel = { from: number; to: number; ceiling?: Line; floor?: Line; contract: boolean };

type ZigzagOptions = {
  ceiling: Line;
  floor: Line;
  /** Candle index of the final pivot. */
  end: number;
  swings: number;
  first: Side;
  /** <1 makes each swing shorter than the last (converging shapes), >1 longer (broadening). */
  squeeze?: number;
  /** Chance that a non-essential swing stops short of its line. */
  missChance?: number;
  volScale?: number;
  /** Scale candle volatility with the channel's width (quiet near a triangle's apex). */
  contract?: boolean;
};

type LineSpec = { line: Line } | { points: Array<{ index: number; price: number }> };

type FinishOptions = {
  target: number;
  /** The line price breaks through. Its extension is also where a retest comes back to. */
  breakout: Line;
  retestChance?: number;
  /** <1 resolves faster. */
  speed?: number;
};

export class Sketch {
  readonly start: number;
  readonly dir: 1 | -1;
  readonly sigma: number;
  readonly height: number;
  private readonly pivots: PathPivot[] = [];
  private readonly channels: Channel[] = [];
  private readonly lines: Array<Omit<PatternLine, "extendBy"> & { extendBy: number | null }> = [];

  constructor(startPrice: number, dir: 1 | -1, heightInSigmas: [number, number]) {
    this.start = startPrice;
    this.dir = dir;
    this.sigma = candleSigma(startPrice);
    this.height = this.sigma * range(heightInSigmas[0], heightInSigmas[1]);
  }

  /** Price `units` pattern-heights above the start, in the pattern's own orientation. */
  at(units: number) {
    return this.start + this.dir * units * this.height;
  }

  /** Shift a price by `units` heights in the pattern's orientation. */
  shift(price: number, units: number) {
    return price + this.dir * units * this.height;
  }

  get index() {
    return this.pivots.length ? this.pivots[this.pivots.length - 1].index : -1;
  }

  get last() {
    return this.pivots.length ? this.pivots[this.pivots.length - 1].price : this.start;
  }

  line(i0: number, p0: number, i1: number, p1: number): Line {
    return { i0, p0, i1, p1 };
  }

  private kindOf(side: Side): "high" | "low" {
    return (side === "top") === (this.dir > 0) ? "high" : "low";
  }

  /** Add a swing that completes `bars` candles after the previous one. Returns its candle index. */
  swing(bars: number, price: number, side: Side | "close", volScale?: number) {
    const index = this.index + Math.max(1, Math.round(bars));
    this.pivots.push({ index, price, kind: side === "close" ? "close" : this.kindOf(side), volScale });
    return index;
  }

  /**
   * Bounce between two lines until `end`. Swing durations vary like real swings do, essential
   * touches (the first two and last two on each line) land on the line, and other swings
   * sometimes stop short. Returns the candle indices that touched each line.
   */
  zigzag(options: ZigzagOptions) {
    const { ceiling, floor, end, swings, first, squeeze = 1, missChance = 0.3, volScale, contract = false } = options;
    const from = this.index;
    const weights: number[] = [];
    let total = 0;
    for (let k = 0; k < swings; k += 1) {
      const weight = Math.pow(squeeze, k) * range(0.75, 1.25);
      weights.push(weight);
      total += weight;
    }
    const touches = { top: [] as number[], bottom: [] as number[] };
    let side = first;
    let cumulative = 0;
    for (let k = 0; k < swings; k += 1) {
      cumulative += weights[k];
      const target = k === swings - 1 ? end : Math.round(from + ((end - from) * cumulative) / total);
      const index = Math.max(this.index + 2, target);
      const onLine = lineAt(side === "top" ? ceiling : floor, index);
      const width = Math.abs(lineAt(ceiling, index) - lineAt(floor, index));
      const essential = touches[side].length < 2 || k >= swings - 2;
      const miss = !essential && chance(missChance) ? range(0.1, 0.3) * width : 0;
      const inward = side === "top" ? -this.dir : this.dir;
      const price = onLine + inward * miss + gaussian() * 0.05 * this.sigma;
      this.swing(index - this.index, price, side, volScale);
      if (miss === 0) {
        touches[side].push(index);
      }
      side = side === "top" ? "bottom" : "top";
    }
    this.channels.push({ from, to: this.index, ceiling, floor, contract });
    return touches;
  }

  /**
   * Draw a line on the chart. It appears after its second touch, starts at its first touch,
   * and keeps extending past the formation so the breakout is seen crossing it.
   */
  draw(id: string, kind: "ceiling" | "floor" | "neckline" | "guide", spec: LineSpec, touches: number[], extendBy?: number) {
    const type: PatternLineKind =
      kind === "ceiling" ? (this.dir > 0 ? "resistance" : "support") : kind === "floor" ? (this.dir > 0 ? "support" : "resistance") : kind;
    const sorted = [...touches].sort((a, b) => a - b);
    const startIndex = sorted[0] ?? 0;
    const points =
      "line" in spec
        ? [
            { offset: startIndex, price: lineAt(spec.line, startIndex) },
            { offset: Math.max(startIndex + 1, this.index), price: lineAt(spec.line, Math.max(startIndex + 1, this.index)) },
          ]
        : spec.points.map((point) => ({ offset: point.index, price: point.price }));
    this.lines.push({ id, type, points, revealOffset: sorted[1] ?? sorted[0] ?? 0, extendBy: extendBy ?? null });
  }

  /** Keep candles in (from, to] on the inner side of the given lines without adding swings. */
  fence(from: number, to: number, lines: { ceiling?: Line; floor?: Line }) {
    this.channels.push({ from, to, ...lines, contract: false });
  }

  private bounds = (index: number) => {
    let upper = Infinity;
    let lower = -Infinity;
    let found = false;
    for (const channel of this.channels) {
      if (index <= channel.from || index > channel.to) {
        continue;
      }
      found = true;
      const top = channel.ceiling ? lineAt(channel.ceiling, index) : null;
      const bottom = channel.floor ? lineAt(channel.floor, index) : null;
      const high = this.dir > 0 ? top : bottom;
      const low = this.dir > 0 ? bottom : top;
      if (high !== null) upper = Math.min(upper, high);
      if (low !== null) lower = Math.max(lower, low);
    }
    return found ? { upper, lower } : null;
  };

  private volScale = (index: number) => {
    for (const channel of this.channels) {
      if (channel.contract && channel.ceiling && channel.floor && index > channel.from && index <= channel.to) {
        const { ceiling, floor } = channel;
        const width = (i: number) => Math.abs(lineAt(ceiling, i) - lineAt(floor, i));
        // Relative to the channel's widest point, so broadening shapes start quiet instead of going wild.
        const widest = Math.max(width(channel.from + 1), width(channel.to));
        return Math.max(0.45, Math.sqrt(width(index) / Math.max(1e-9, widest)));
      }
    }
    return 1;
  };

  /** Move `distance` (an absolute price amount) further in the pattern's breakout direction. */
  beyond(price: number, distance: number) {
    return price + this.dir * Math.abs(distance);
  }

  /** Add the breakout, an optional retest and the move to target, then render everything. */
  finish(id: string, options: FinishOptions): PatternResult {
    const { target, breakout, retestChance = 0.45, speed = 1 } = options;
    const end = this.index;
    const level = (index: number) => lineAt(breakout, index);
    const out = target >= level(end) ? 1 : -1;
    const kind = (up: boolean): "high" | "low" => (up ? "high" : "low");
    const push = (bars: number, price: number, pivotKind: PathPivot["kind"], volScale?: number) => {
      this.pivots.push({ index: this.index + Math.max(1, Math.round(bars)), price, kind: pivotKind, volScale });
    };

    // 1. Breakout: a fast, wide-bodied thrust through the line.
    const thrust = level(end) + out * Math.abs(target - level(end)) * range(0.35, 0.6);
    push((Math.abs(thrust - this.last) / (this.sigma * range(1.1, 1.7))) * speed, thrust, kind(out > 0), 1.35);
    const breakoutIndex = this.index;

    // 2. Throwback to the broken line (a textbook retest) or a shallow pullback.
    if (chance(retestChance)) {
      const bars = rangeInt(3, 6) * speed;
      const retestIndex = this.index + Math.max(1, Math.round(bars));
      push(bars, level(retestIndex) + out * range(-0.05, 0.35) * this.sigma, kind(out < 0), 0.8);
    } else {
      push(rangeInt(2, 5) * speed, thrust - out * Math.abs(thrust - level(end)) * range(0.2, 0.4), kind(out < 0), 0.85);
    }

    // 3. Continuation to the measured move. Long runs pause once on the way.
    const distance = Math.abs(target - this.last);
    const bars = Math.max(3, (distance / (this.sigma * range(0.7, 1.1))) * speed);
    if (bars > 10) {
      const midway = this.last + out * distance * range(0.55, 0.7);
      push(bars * 0.55, midway, kind(out > 0), 1.1);
      push(rangeInt(2, 4), midway - out * distance * range(0.1, 0.18), kind(out < 0), 0.9);
      push(bars * 0.4, target + out * range(0, 0.3) * this.sigma, kind(out > 0), 1.1);
    } else {
      push(bars, target + out * range(0, 0.3) * this.sigma, kind(out > 0), 1.1);
    }

    const all = renderPath(this.start, this.pivots, { sigma: this.sigma, bounds: this.bounds, volScale: this.volScale });
    const formationCount = end + 1;
    const lastOffset = all.length - 1;
    const lines: PatternLine[] = this.lines.map((line) => ({
      ...line,
      extendBy: line.extendBy ?? breakoutIndex - line.points[line.points.length - 1].offset + 3,
    }));
    lines.push({
      id: `${id}-target`,
      type: "target",
      points: [
        { offset: end, price: target },
        { offset: lastOffset, price: target },
      ],
      revealOffset: end,
      extendBy: 8,
    });

    return {
      candles: all.slice(0, formationCount),
      runout: all.slice(formationCount),
      targetPrice: target,
      breakoutPrice: level(end),
      lines,
    };
  }
}

type PatternName = { id: string; label: string };

/**
 * Define a bullish pattern and its mirror-image bearish twin from one build function.
 * `heights` is the pattern height range in candle sigmas (how big it is next to the noise).
 */
export const definePair = (
  bull: PatternName,
  bear: PatternName,
  length: number,
  heights: [number, number],
  build: (sketch: Sketch, id: string) => PatternResult,
): [PatternDefinition, PatternDefinition] => [
  { ...bull, bias: "bullish", length, generate: (startPrice) => build(new Sketch(startPrice, 1, heights), bull.id) },
  { ...bear, bias: "bearish", length, generate: (startPrice) => build(new Sketch(startPrice, -1, heights), bear.id) },
];
