import { pick, rangeInt } from "../market/random";
import type { PatternDefinition } from "../types";
import { definePair, lineAt, Sketch } from "./sketch";

// Triangles and wedges: price coils between two trendlines, swings shorten (and volatility
// fades) toward the apex, then it breaks out with a burst. Written bullish; the bearish twin
// is the mirror image.

export const [ascendingTrianglePattern, descendingTrianglePattern] = definePair(
  { id: "ascending-triangle", label: "Ascending Triangle" },
  { id: "descending-triangle", label: "Descending Triangle" },
  60,
  [8, 12],
  (s, id) => {
    const end = rangeInt(50, 70);
    const top = s.at(0.7);
    // Flat ceiling, rising floor: buyers step in higher each time.
    const ceiling = s.line(0, top, end, top);
    const floor = s.line(0, s.at(-0.3), end, s.at(0.55));
    const touches = s.zigzag({ ceiling, floor, end, swings: pick([6, 8]), first: "top", squeeze: 0.88, contract: true });
    s.draw(`${id}-flat`, "ceiling", { line: ceiling }, touches.top);
    s.draw(`${id}-rising`, "floor", { line: floor }, touches.bottom);
    const height = Math.abs(top - lineAt(floor, touches.bottom[0] ?? 0));
    return s.finish(id, { target: s.beyond(top, height), breakout: ceiling });
  },
);

export const [descendingWedgePattern, ascendingWedgePattern] = definePair(
  { id: "descending-wedge", label: "Descending Wedge" },
  { id: "ascending-wedge", label: "Ascending Wedge" },
  60,
  [8, 12],
  (s, id) => {
    const end = rangeInt(50, 70);
    // Both lines fall, the upper one faster: sellers are running out of steam.
    const ceiling = s.line(0, s.at(0.45), end, s.at(-0.75));
    const floor = s.line(0, s.at(-0.45), end, s.at(-0.95));
    const touches = s.zigzag({ ceiling, floor, end, swings: pick([6, 8]), first: "top", squeeze: 0.88, contract: true });
    s.draw(`${id}-upper`, "ceiling", { line: ceiling }, touches.top);
    s.draw(`${id}-lower`, "floor", { line: floor }, touches.bottom);
    // Textbook target: back to where the wedge started.
    return s.finish(id, { target: lineAt(ceiling, touches.top[0] ?? 0), breakout: ceiling });
  },
);

export const [descendingBroadeningWedgePattern, ascendingBroadeningWedgePattern] = definePair(
  { id: "descending-broadening-wedge", label: "Descending Broadening Wedge" },
  { id: "ascending-broadening-wedge", label: "Ascending Broadening Wedge" },
  62,
  [7, 10],
  (s, id) => {
    const end = rangeInt(52, 72);
    // Both lines fall but diverge: each swing is wider and wilder than the last.
    const ceiling = s.line(0, s.at(0.25), end, s.at(-0.15));
    const floor = s.line(0, s.at(-0.25), end, s.at(-1.05));
    const touches = s.zigzag({ ceiling, floor, end, swings: pick([6, 8]), first: "top", squeeze: 1.12, contract: true });
    s.draw(`${id}-upper`, "ceiling", { line: ceiling }, touches.top);
    s.draw(`${id}-lower`, "floor", { line: floor }, touches.bottom);
    const breakout = lineAt(ceiling, end);
    const widest = Math.abs(breakout - lineAt(floor, end));
    return s.finish(id, { target: s.beyond(breakout, widest * 0.8), breakout: ceiling });
  },
);

// Neutral: both lines converge evenly, so only the breakout tells you which way it goes.
export const symmetricalTrianglePattern: PatternDefinition = {
  id: "symmetrical-triangle",
  label: "Symmetrical Triangle",
  bias: "neutral",
  length: 60,
  generate: (startPrice) => {
    const id = "symmetrical-triangle";
    const s = new Sketch(startPrice, pick([1, -1] as const), [8, 12]);
    const end = rangeInt(50, 70);
    const ceiling = s.line(0, s.at(0.6), end, s.at(0.1));
    const floor = s.line(0, s.at(-0.4), end, s.at(0));
    const touches = s.zigzag({ ceiling, floor, end, swings: pick([6, 8]), first: "top", squeeze: 0.88, contract: true });
    s.draw(`${id}-upper`, "ceiling", { line: ceiling }, touches.top);
    s.draw(`${id}-lower`, "floor", { line: floor }, touches.bottom);
    const widest = Math.abs(lineAt(ceiling, touches.top[0] ?? 0) - lineAt(floor, touches.top[0] ?? 0));
    return s.finish(id, { target: s.beyond(lineAt(ceiling, end), widest), breakout: ceiling });
  },
};
