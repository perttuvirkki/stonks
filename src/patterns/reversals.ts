import { chance, range, rangeInt } from "../market/random";
import { definePair, lineAt, type Sketch } from "./sketch";

// Reversal patterns: the trend runs into a floor (or ceiling) it can't break, then turns.
// Each is written as its bullish (bottoming) form; the bearish twin is the mirror image.

/** Swing to `price`, sometimes with a small counter-bounce on the way so legs aren't one stroke. */
const leg = (s: Sketch, bars: number, price: number, side: "top" | "bottom", volScale?: number) => {
  if (bars >= 10 && chance(0.55)) {
    const from = s.last;
    const first = Math.round(bars * range(0.45, 0.6));
    const pause = from + (price - from) * range(0.5, 0.65);
    s.swing(first, pause, side, volScale);
    s.swing(rangeInt(2, 3), pause - (price - from) * range(0.12, 0.2), side === "top" ? "bottom" : "top", 0.9);
    return s.swing(bars - first - 2, price, side, volScale);
  }
  return s.swing(bars, price, side, volScale);
};

export const [reverseHeadAndShouldersPattern, headAndShouldersPattern] = definePair(
  { id: "reverse-head-and-shoulders", label: "Reverse Head & Shoulders" },
  { id: "head-and-shoulders", label: "Head & Shoulders" },
  70,
  [9, 13],
  (s, id) => {
    const leftShoulder = leg(s, rangeInt(12, 18), s.at(-0.55 + range(-0.06, 0.06)), "bottom");
    const firstNeckIndex = leftShoulder + rangeInt(8, 12);
    const neckline = s.line(firstNeckIndex, s.at(range(-0.05, 0.08)), firstNeckIndex + 30, s.at(range(-0.1, 0.12)));
    s.swing(firstNeckIndex - s.index, lineAt(neckline, firstNeckIndex), "top");
    const head = leg(s, rangeInt(12, 17), s.at(-1), "bottom", 1.1);
    const secondNeckIndex = head + rangeInt(10, 14);
    s.swing(secondNeckIndex - s.index, lineAt(neckline, secondNeckIndex), "top");
    s.swing(rangeInt(9, 13), s.at(-0.55 + range(-0.06, 0.06)), "bottom");
    // Price stays under the neckline until it finally breaks.
    s.fence(firstNeckIndex, s.index, { ceiling: neckline });
    s.draw(`${id}-neckline`, "neckline", { line: neckline }, [firstNeckIndex, secondNeckIndex]);
    const depth = Math.abs(lineAt(neckline, head) - s.at(-1));
    return s.finish(id, { target: s.beyond(lineAt(neckline, s.index), depth), breakout: neckline, retestChance: 0.5, speed: 0.75 });
  },
);

export const [doubleBottomPattern, doubleTopPattern] = definePair(
  { id: "double-bottom", label: "Double Bottom" },
  { id: "double-top", label: "Double Top" },
  44,
  [8, 12],
  (s, id) => {
    const low = s.at(-1);
    const first = leg(s, rangeInt(12, 18), low, "bottom", 1.1);
    const peakPrice = s.at(range(-0.18, -0.02));
    const peak = leg(s, rangeInt(10, 15), peakPrice, "top");
    const second = leg(s, rangeInt(10, 15), s.at(-1 + range(-0.03, 0.05)), "bottom");
    const neckline = s.line(peak, peakPrice, peak + 1, peakPrice);
    s.fence(peak, second, { ceiling: neckline });
    s.draw(`${id}-floor`, "floor", { line: s.line(first, low, second, low) }, [first, second]);
    s.draw(`${id}-neckline`, "neckline", { line: neckline }, [peak, second]);
    return s.finish(id, { target: s.beyond(peakPrice, Math.abs(peakPrice - low)), breakout: neckline, retestChance: 0.55, speed: 0.75 });
  },
);

export const [cupAndHandlePattern, inverseCupAndHandlePattern] = definePair(
  { id: "cup-and-handle", label: "Cup & Handle" },
  { id: "inverse-cup-and-handle", label: "Inverse Cup & Handle" },
  70,
  [8, 12],
  (s, id) => {
    const rim = s.at(range(0.05, 0.1));
    const lip = s.swing(rangeInt(3, 5), rim, "top");
    const cupLength = rangeInt(38, 52);
    // A rounded U: depth follows 1 - |2x - 1|^2.2, with small swings riding along it.
    const curve = (x: number) => s.shift(rim, -(1 - Math.pow(Math.abs(2 * x - 1), 2.2)));
    const steps = 2 * rangeInt(4, 5);
    let side: "top" | "bottom" = "bottom";
    let previous = rim;
    for (let step = 1; step < steps; step += 1) {
      const x = step / steps;
      const wobble = s.height * range(0.05, 0.1);
      const minSwing = s.height * 0.06;
      const towardTop = side === "top" ? s.dir : -s.dir;
      let price = curve(x) + towardTop * wobble;
      // Keep alternation honest on the steep walls: each top above the last bottom and vice versa.
      if ((price - previous) * towardTop < minSwing) {
        price = previous + towardTop * minSwing;
      }
      s.swing(lip + Math.round(cupLength * x) - s.index, price, side, 0.85);
      previous = price;
      side = side === "top" ? "bottom" : "top";
    }
    const rightLip = s.swing(lip + cupLength - s.index, rim + s.dir * range(-0.02, 0.01) * s.height, "top");
    // The handle: a short, quiet drift down that shakes out weak hands.
    s.swing(rangeInt(3, 5), s.shift(rim, -range(0.26, 0.34)), "bottom", 0.75);
    s.swing(rangeInt(2, 4), s.shift(rim, -range(0.1, 0.16)), "top", 0.7);
    s.swing(rangeInt(3, 5), s.shift(rim, -range(0.3, 0.4)), "bottom", 0.75);
    const rimLine = s.line(lip, rim, rightLip, rim);
    s.fence(lip, s.index, { ceiling: rimLine });
    s.draw(`${id}-rim`, "ceiling", { line: rimLine }, [lip, rightLip]);
    const arc: Array<{ index: number; price: number }> = [];
    for (let k = 0; k <= 12; k += 1) {
      arc.push({ index: lip + Math.round((cupLength * k) / 12), price: curve(k / 12) });
    }
    s.draw(`${id}-cup`, "guide", { points: arc }, [lip, lip + Math.round(cupLength / 2)], 0);
    return s.finish(id, { target: s.beyond(rim, s.height), breakout: rimLine });
  },
);

export const [diamondBottomPattern, diamondTopPattern] = definePair(
  { id: "diamond-bottom", label: "Diamond Bottom" },
  { id: "diamond-top", label: "Diamond Top" },
  64,
  [9, 13],
  (s, id) => {
    const leadBars = rangeInt(6, 9);
    const start = s.index + leadBars;
    const mid = start + rangeInt(24, 32);
    const end = mid + rangeInt(22, 30);
    // First the swings widen (a broadening top half), then they narrow back to a point.
    const upperLeft = s.line(start, s.at(-0.05), mid, s.at(0.4));
    const lowerLeft = s.line(start, s.at(-0.3), mid, s.at(-0.75));
    s.swing(leadBars, lineAt(lowerLeft, start), "bottom");
    const left = s.zigzag({ ceiling: upperLeft, floor: lowerLeft, end: mid, swings: 4, first: "top", squeeze: 1.15, contract: true });
    s.draw(`${id}-upper-left`, "ceiling", { line: upperLeft }, left.top, 0);
    s.draw(`${id}-lower-left`, "floor", { line: lowerLeft }, [start, ...left.bottom], 0);
    const upperRight = s.line(mid, lineAt(upperLeft, mid), end, s.at(-0.05));
    const lowerRight = s.line(mid, lineAt(lowerLeft, mid), end, s.at(-0.35));
    const right = s.zigzag({ ceiling: upperRight, floor: lowerRight, end, swings: 4, first: "top", squeeze: 0.85, contract: true });
    s.draw(`${id}-upper-right`, "ceiling", { line: upperRight }, [mid, ...right.top]);
    s.draw(`${id}-lower-right`, "floor", { line: lowerRight }, [mid, ...right.bottom]);
    const widest = Math.abs(lineAt(upperLeft, mid) - lineAt(lowerLeft, mid));
    return s.finish(id, { target: s.beyond(lineAt(upperRight, end), widest), breakout: upperRight });
  },
);
