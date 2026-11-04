import { chance, pick, range, rangeInt } from "../market/random";
import { definePair, lineAt, type Sketch } from "./sketch";

// Flags, pennants and rectangles: a sharp pole, a quiet low-volatility pause, then the trend
// resumes by about the pole's length (the measured move). Written bullish; bear twins mirror.

/** The pole: one or two fast thrusts covering one pattern height. Returns the pole top index. */
const pole = (s: Sketch, id: string) => {
  const bars = rangeInt(7, 12);
  if (chance(0.4)) {
    s.swing(bars * 0.55, s.at(range(0.55, 0.65)), "top", 1.5);
    s.swing(rangeInt(2, 3), s.at(range(0.42, 0.5)), "bottom", 0.9);
    s.swing(bars * 0.45, s.at(1), "top", 1.5);
  } else {
    s.swing(bars, s.at(1), "top", 1.5);
  }
  const top = s.index;
  s.draw(`${id}-pole`, "guide", { points: [{ index: 0, price: s.start }, { index: top, price: s.at(1) }] }, [top], 0);
  return top;
};

export const [bullFlagPattern, bearFlagPattern] = definePair(
  { id: "bull-flag", label: "Bull Flag" },
  { id: "bear-flag", label: "Bear Flag" },
  32,
  [9, 13],
  (s, id) => {
    const top = pole(s, id);
    const end = top + rangeInt(16, 26);
    const drop = range(0.2, 0.35);
    const width = range(0.28, 0.38);
    // A small channel sloping against the pole.
    const ceiling = s.line(top, s.at(1), end, s.at(1 - drop));
    const floor = s.line(top, s.at(1 - width), end, s.at(1 - width - drop));
    const touches = s.zigzag({ ceiling, floor, end, swings: pick([5, 7]), first: "bottom", volScale: 0.7, missChance: 0.2 });
    s.draw(`${id}-upper`, "ceiling", { line: ceiling }, [top, ...touches.top]);
    s.draw(`${id}-lower`, "floor", { line: floor }, touches.bottom);
    return s.finish(id, { target: s.beyond(lineAt(ceiling, end), s.height), breakout: ceiling });
  },
);

export const [bullPennantPattern, bearPennantPattern] = definePair(
  { id: "bull-pennant", label: "Bull Pennant" },
  { id: "bear-pennant", label: "Bear Pennant" },
  32,
  [9, 13],
  (s, id) => {
    const top = pole(s, id);
    const end = top + rangeInt(16, 24);
    // A small symmetrical triangle right after the pole.
    const ceiling = s.line(top, s.at(1), end, s.at(range(0.7, 0.76)));
    const floor = s.line(top, s.at(range(0.48, 0.56)), end, s.at(range(0.62, 0.66)));
    const touches = s.zigzag({ ceiling, floor, end, swings: pick([5, 7]), first: "bottom", squeeze: 0.85, volScale: 0.75, contract: true });
    s.draw(`${id}-upper`, "ceiling", { line: ceiling }, [top, ...touches.top]);
    s.draw(`${id}-lower`, "floor", { line: floor }, touches.bottom);
    return s.finish(id, { target: s.beyond(lineAt(ceiling, end), s.height), breakout: ceiling });
  },
);

export const [bullRectanglePattern, bearRectanglePattern] = definePair(
  { id: "bull-rectangle", label: "Bull Rectangle" },
  { id: "bear-rectangle", label: "Bear Rectangle" },
  36,
  [9, 13],
  (s, id) => {
    const top = pole(s, id);
    const end = top + rangeInt(20, 30);
    const high = s.at(1);
    const low = s.at(1 - range(0.32, 0.42));
    // A flat box: the same ceiling and floor hold until buyers win.
    const ceiling = s.line(top, high, end, high);
    const floor = s.line(top, low, end, low);
    const touches = s.zigzag({ ceiling, floor, end, swings: pick([5, 7]), first: "bottom", volScale: 0.75 });
    s.draw(`${id}-upper`, "ceiling", { line: ceiling }, [top, ...touches.top]);
    s.draw(`${id}-lower`, "floor", { line: floor }, touches.bottom);
    return s.finish(id, { target: s.beyond(high, s.height), breakout: ceiling });
  },
);
