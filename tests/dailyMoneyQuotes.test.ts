import assert from "node:assert/strict";
import test from "node:test";
import { DAILY_MONEY_QUOTES, getDailyMoneyQuote } from "../src/data/dailyMoneyQuotes";

test("daily money includes a full month of unique sourced quotes", () => {
  assert.ok(DAILY_MONEY_QUOTES.length >= 31);
  assert.equal(new Set(DAILY_MONEY_QUOTES.map((quote) => quote.text)).size, DAILY_MONEY_QUOTES.length);

  for (const quote of DAILY_MONEY_QUOTES) {
    assert.ok(quote.text.trim().length > 0);
    assert.ok(quote.author.trim().length > 0);
    assert.ok(quote.source.trim().length > 0);
  }
});

test("daily money rotation is stable per day and covers the library", () => {
  const start = new Date(2026, 0, 1, 12);
  const selected = new Set<string>();

  for (let offset = 0; offset < DAILY_MONEY_QUOTES.length; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const first = getDailyMoneyQuote(date);
    const laterSameDay = getDailyMoneyQuote(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59));
    assert.equal(first.text, laterSameDay.text);
    selected.add(first.text);
  }

  assert.equal(selected.size, DAILY_MONEY_QUOTES.length);
});
