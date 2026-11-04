import assert from "node:assert/strict";
import test from "node:test";
import { BASE_PRICE, MAX_PRICE, MIN_PRICE } from "../src/constants";
import { createCandle } from "../src/market/engine";
import { allPatterns, choosePattern } from "../src/patterns";
import type { Candle } from "../src/types";

const makeRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const assertValidCandle = (candle: Candle, label: string) => {
  for (const price of [candle.open, candle.close, candle.low, candle.high]) {
    assert.ok(Number.isFinite(price), `${label} price is finite`);
    assert.ok(price >= MIN_PRICE && price <= MAX_PRICE, `${label} price is in range`);
  }
  assert.ok(candle.low <= Math.min(candle.open, candle.close), `${label} low contains body`);
  assert.ok(candle.high >= Math.max(candle.open, candle.close), `${label} high contains body`);
};

test("an explicit empty enabled list disables pattern generation", () => {
  assert.equal(choosePattern(BASE_PRICE, []), null);
});

test("neutral patterns remain selectable", () => {
  const selected = choosePattern(BASE_PRICE, ["ascending-triangle", "range"], () => 0.75);
  assert.equal(selected?.id, "range");
});

test("every pattern has a bias", () => {
  for (const pattern of allPatterns) {
    assert.ok(["bullish", "bearish", "neutral"].includes(pattern.bias), `${pattern.id} bias`);
  }
});

test("directional weighting pulls prices back toward the playable range", () => {
  const sample = (price: number, seed: number) => {
    const random = makeRandom(seed);
    const counts = { bullish: 0, bearish: 0, neutral: 0 };
    for (let index = 0; index < 10_000; index += 1) {
      const pattern = choosePattern(price, undefined, random);
      assert.ok(pattern, "expected a pattern");
      counts[pattern.bias] += 1;
    }
    return counts;
  };

  const nearBottom = sample(MIN_PRICE, 1);
  const nearTop = sample(MAX_PRICE, 2);
  assert.ok(nearBottom.bullish > nearBottom.bearish * 5);
  assert.ok(nearTop.bearish > nearTop.bullish * 5);
  assert.equal(nearTop.bullish, 0, "no bullish patterns near the ceiling");
  assert.ok(nearBottom.neutral > 0);
  assert.ok(nearTop.neutral > 0);
});

test("every pattern produces finite, valid OHLC data, runout and chart lines", () => {
  const starts = [Number.NaN, Number.NEGATIVE_INFINITY, -100, MIN_PRICE, BASE_PRICE, MAX_PRICE, 10_000, Number.POSITIVE_INFINITY];

  for (const pattern of allPatterns) {
    for (const start of starts) {
      const result = pattern.generate(start);
      assert.ok(result.candles.length > 0, `${pattern.id} has a formation`);
      assert.ok(result.runout.length > 0, `${pattern.id} has a runout`);
      assert.ok(Number.isFinite(result.targetPrice), `${pattern.id} target is finite`);
      assert.ok(result.targetPrice >= MIN_PRICE && result.targetPrice <= MAX_PRICE, `${pattern.id} target is in range`);

      for (const candle of [...result.candles, ...result.runout]) {
        assertValidCandle(candle, pattern.id);
      }

      const totalCandles = result.candles.length + result.runout.length;
      for (const line of result.lines) {
        assert.ok(line.points.length >= 2, `${pattern.id} line has two anchors`);
        for (const point of line.points) {
          assert.ok(point.offset >= 0 && point.offset < totalCandles + line.extendBy, `${pattern.id} line point offset is valid`);
          assert.ok(point.price >= MIN_PRICE && point.price <= MAX_PRICE, `${pattern.id} line price is valid`);
        }
        assert.ok(line.revealOffset >= 0, `${pattern.id} line reveal is valid`);
      }
    }
  }
});

test("runouts head toward the measured-move target", () => {
  for (const pattern of allPatterns) {
    const result = pattern.generate(BASE_PRICE);
    const formationEnd = result.candles.at(-1)!.close;
    const runoutEnd = result.runout.at(-1)!.close;
    const toTarget = result.targetPrice - formationEnd;
    if (Math.abs(toTarget) < 1) continue;
    assert.ok(Math.abs(runoutEnd - result.targetPrice) < Math.abs(toTarget), `${pattern.id} runout moves toward target`);
  }
});

test("each pattern keeps stochastic variation between runs", () => {
  for (const pattern of allPatterns) {
    const first = pattern.generate(BASE_PRICE).candles.map((candle) => candle.close);
    const second = pattern.generate(BASE_PRICE).candles.map((candle) => candle.close);
    assert.notDeepEqual(first, second, `${pattern.id} remains random`);
  }
});

test("ambient candles stay valid and continuous", () => {
  let close = BASE_PRICE;
  for (let index = 0; index < 5_000; index += 1) {
    const candle = createCandle(close);
    assertValidCandle(candle, "ambient");
    assert.equal(candle.open, close, "ambient candles open at the previous close");
    close = candle.close;
  }
});
