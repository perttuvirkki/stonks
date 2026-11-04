import assert from "node:assert/strict";
import test from "node:test";
import { BASE_PRICE, MAX_PRICE, MIN_PRICE } from "../src/constants";
import { allPatterns, choosePattern } from "../src/patterns";
import { enhancePatternCandles } from "../src/patterns/realism";
import { createTargetRunout } from "../src/utils";

const makeRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

test("an explicit empty enabled list disables pattern generation", () => {
  assert.equal(choosePattern(BASE_PRICE, []), null);
});

test("neutral patterns remain selectable", () => {
  const selected = choosePattern(BASE_PRICE, ["ascending-triangle", "range"], () => 0.75);
  assert.equal(selected?.id, "range");
});

test("directional weighting pulls prices back toward the playable range", () => {
  const sample = (price: number, seed: number) => {
    const random = makeRandom(seed);
    const counts = { bullish: 0, bearish: 0, neutral: 0 };
    for (let index = 0; index < 10_000; index += 1) {
      const pattern = choosePattern(price, undefined, random);
      if (!pattern?.direction) assert.fail("expected a directed pattern");
      counts[pattern.direction] += 1;
    }
    return counts;
  };

  const nearBottom = sample(MIN_PRICE, 1);
  const nearTop = sample(MAX_PRICE, 2);
  assert.ok(nearBottom.bullish > nearBottom.bearish * 5);
  assert.ok(nearTop.bearish > nearTop.bullish * 5);
  assert.ok(nearBottom.neutral > 0);
  assert.ok(nearTop.neutral > 0);
});

test("every pattern produces finite, valid OHLC data and chart lines", () => {
  const starts = [Number.NaN, Number.NEGATIVE_INFINITY, -100, MIN_PRICE, BASE_PRICE, MAX_PRICE, 10_000, Number.POSITIVE_INFINITY];

  for (const pattern of allPatterns) {
    for (const start of starts) {
      const result = pattern.generate(start);
      assert.equal(result.candles.length, pattern.length, `${pattern.id} candle count`);
      assert.ok(Number.isFinite(result.targetPrice), `${pattern.id} target is finite`);
      assert.ok(result.targetPrice >= MIN_PRICE && result.targetPrice <= MAX_PRICE, `${pattern.id} target is in range`);

      for (const candle of result.candles) {
        for (const price of [candle.open, candle.close, candle.low, candle.high]) {
          assert.ok(Number.isFinite(price), `${pattern.id} candle price is finite`);
          assert.ok(price >= MIN_PRICE && price <= MAX_PRICE, `${pattern.id} candle price is in range`);
        }
        assert.ok(candle.low <= Math.min(candle.open, candle.close), `${pattern.id} low contains body`);
        assert.ok(candle.high >= Math.max(candle.open, candle.close), `${pattern.id} high contains body`);
      }

      for (const line of result.lines ?? []) {
        assert.ok(line.startOffset >= 0 && line.startOffset < result.candles.length, `${pattern.id} line start is valid`);
        assert.ok(line.endOffset >= line.startOffset && line.endOffset < result.candles.length, `${pattern.id} line end is valid`);
        assert.ok(line.startPrice >= MIN_PRICE && line.startPrice <= MAX_PRICE, `${pattern.id} line start price is valid`);
        assert.ok(line.endPrice >= MIN_PRICE && line.endPrice <= MAX_PRICE, `${pattern.id} line end price is valid`);
      }
    }
  }
});

test("microstructure stays anchored to the pattern while remaining random", () => {
  const rawCandles = Array.from({ length: 80 }, (_, index) => {
    const open = BASE_PRICE + index * 0.45 + Math.sin(index / 6) * 2;
    const close = BASE_PRICE + (index + 1) * 0.45 + Math.sin((index + 1) / 6) * 2;
    return {
      id: `raw-${index}`,
      open,
      close,
      high: Math.max(open, close) + 2,
      low: Math.min(open, close) - 2,
    };
  });

  const first = enhancePatternCandles(rawCandles, BASE_PRICE, makeRandom(100));
  const second = enhancePatternCandles(rawCandles, BASE_PRICE, makeRandom(200));
  assert.equal(first.length, rawCandles.length);
  assert.notDeepEqual(
    first.map((candle) => candle.close),
    second.map((candle) => candle.close),
  );

  const maxCloseDisplacement = Math.max(...first.map((candle, index) => Math.abs(candle.close - rawCandles[index].close)));
  assert.ok(maxCloseDisplacement < 1.5, "enhancement preserves the source geometry");

  const gaps = first.slice(1).map((candle, index) => Math.abs(candle.open - first[index].close));
  assert.ok(Math.max(...gaps) < 1, "opens stay nearly continuous");
  assert.ok(first.at(-1)!.close > first[0].close, "the source trend remains recognizable");
});

test("each pattern keeps stochastic variation between runs", () => {
  for (const pattern of allPatterns) {
    const first = pattern.generate(BASE_PRICE).candles.map((candle) => candle.close);
    const second = pattern.generate(BASE_PRICE).candles.map((candle) => candle.close);
    assert.notDeepEqual(first, second, `${pattern.id} remains random`);
  }
});

test("target runouts sanitize invalid inputs and always finish on target", () => {
  assert.deepEqual(createTargetRunout(Number.NaN, Number.POSITIVE_INFINITY), []);

  const runout = createTargetRunout(BASE_PRICE, MAX_PRICE + 500, { minSteps: 4, maxSteps: 4 });
  assert.equal(runout.length, 4);
  assert.equal(runout.at(-1)?.close, MAX_PRICE);
  for (const candle of runout) {
    assert.ok(candle.low >= MIN_PRICE);
    assert.ok(candle.high <= MAX_PRICE);
    assert.ok(candle.low <= Math.min(candle.open, candle.close));
    assert.ok(candle.high >= Math.max(candle.open, candle.close));
  }
});

test("long breakouts can impulse, retest, and then continue", () => {
  const runout = createTargetRunout(BASE_PRICE, BASE_PRICE + 100, {
    minSteps: 12,
    maxSteps: 12,
    retestChance: 1,
    counterChanceMultiplier: 0,
    overshootMultiplier: 0,
    random: makeRandom(42),
  });

  assert.equal(runout.length, 12);
  const impulsePeak = Math.max(...runout.slice(0, 4).map((candle) => candle.close));
  const retestLow = Math.min(...runout.slice(4, 7).map((candle) => candle.close));
  assert.ok(retestLow < impulsePeak - 5, "breakout includes a meaningful retest");
  assert.equal(runout.at(-1)?.close, BASE_PRICE + 100);
});

test("runout step limits include the final target candle", () => {
  const runout = createTargetRunout(BASE_PRICE, BASE_PRICE + 10, {
    minSteps: 1,
    maxSteps: 1,
    random: makeRandom(7),
  });
  assert.equal(runout.length, 1);
  assert.equal(runout[0].close, BASE_PRICE + 10);
});
