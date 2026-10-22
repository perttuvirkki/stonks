import { pick, rangeInt } from "../market/random";
import { Sketch } from "./sketch";
import type { PatternDefinition } from "../types";

// A sideways range with no edge either way: it breaks out in a random direction.
export const rangePattern: PatternDefinition = {
  id: "range",
  label: "Range",
  bias: "neutral",
  length: 70,
  generate: (startPrice) => {
    const s = new Sketch(startPrice, pick([1, -1] as const), [6, 9]);
    const end = rangeInt(55, 85);
    const ceiling = s.line(0, s.at(0.5), end, s.at(0.5));
    const floor = s.line(0, s.at(-0.5), end, s.at(-0.5));
    const touches = s.zigzag({ ceiling, floor, end, swings: pick([6, 8]), first: "top", missChance: 0.35 });
    s.draw("range-high", "ceiling", { line: ceiling }, touches.top);
    s.draw("range-low", "floor", { line: floor }, touches.bottom);
    return s.finish("range", { target: s.beyond(s.at(0.5), s.height), breakout: ceiling });
  },
};
