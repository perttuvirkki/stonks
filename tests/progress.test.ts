import assert from "node:assert/strict";
import test from "node:test";
import { allTimeNetProfit, compoundTrainingReturn, progressFor } from "../src/progress";

const boards = (event: Parameters<typeof progressFor>[0]) => progressFor(event).scores.map((score) => score.board);

test("only the 60s sprint feeds the sprint leaderboard", () => {
  const common = { endNetWorth: 250, percent: 150, tradesMade: 5, tradesWon: 5, totalRounds: 3, netProfit: 500 };
  assert.deepEqual(boards({ type: "roundEnded", mode: "sprint60", ...common }).sort(), ["netProfit", "sprint"]);
  assert.deepEqual(boards({ type: "roundEnded", mode: "fiveTrades", ...common }).sort(), ["fiveTrades", "netProfit"]);
});

test("5 Trades submits the end-of-run stack in dollars, like the sprint", () => {
  const run = { type: "roundEnded", mode: "fiveTrades", tradesMade: 5, tradesWon: 3, totalRounds: 1, netProfit: 12 } as const;
  assert.deepEqual(progressFor({ ...run, endNetWorth: 112.84, percent: 12.84 }).scores.find((s) => s.board === "fiveTrades"), { board: "fiveTrades", score: 112 });
  assert.deepEqual(progressFor({ ...run, endNetWorth: 80, percent: -20 }).scores.find((s) => s.board === "fiveTrades"), { board: "fiveTrades", score: 80 });
});

test("5 Trades achievements", () => {
  const run = { type: "roundEnded", mode: "fiveTrades", endNetWorth: 300, totalRounds: 1, netProfit: 0 } as const;
  const perfect = progressFor({ ...run, percent: 120, tradesMade: 5, tradesWon: 5 }).achievements;
  assert.ok(perfect.includes("fiveTradesDone") && perfect.includes("fiveTradesPerfect") && perfect.includes("fiveTradesDouble"));
  const mixed = progressFor({ ...run, percent: 10, tradesMade: 5, tradesWon: 4 }).achievements;
  assert.ok(mixed.includes("fiveTradesDone"));
  assert.ok(!mixed.includes("fiveTradesPerfect"));
});

test("net profit is reported after liquidations too, and can be negative", () => {
  const progress = progressFor({ type: "liquidated", totalRounds: 4, netProfit: -320 });
  assert.deepEqual(progress.scores, [{ board: "netProfit", score: -320 }]);
  assert.ok(progress.achievements.includes("liquidated"));
});

test("net profit milestones and the 100-round achievement", () => {
  const progress = progressFor({ type: "liquidated", totalRounds: 100, netProfit: 12_000 });
  assert.ok(["netProfit1k", "netProfit10k", "rounds100"].every((key) => progress.achievements.includes(key as never)));
});

test("allTimeNetProfit subtracts losing rounds from winning ones", () => {
  assert.equal(allTimeNetProfit({ totalProfit: 1500.4, totalLoss: 600 }), 900);
  assert.equal(allTimeNetProfit({ totalProfit: 0, totalLoss: 250 }), -250);
});

test("pop quiz earns streak achievements on correct calls only, with no leaderboard", () => {
  assert.deepEqual(progressFor({ type: "quizAnswered", correct: false, streak: 0 }), { scores: [], achievements: [] });
  const tenth = progressFor({ type: "quizAnswered", correct: true, streak: 10 });
  assert.deepEqual(tenth.scores, []);
  assert.deepEqual(tenth.achievements, ["quizFirstCorrect", "quizStreak5", "quizStreak10"]);
});

test("training trades earn achievements but report no leaderboard scores", () => {
  const green = progressFor({ type: "tradeClosed", training: true, profit: 5, trainingReturnPercent: 55 });
  assert.deepEqual(green.scores, []);
  assert.deepEqual(green.achievements, ["trainingFirstGreen", "trainingPlus50"]);
  assert.deepEqual(progressFor({ type: "tradeClosed", training: true, profit: -5, trainingReturnPercent: -10 }), { scores: [], achievements: [] });
  assert.deepEqual(progressFor({ type: "tradeOpened", training: true, leverage: 50 }).achievements, []);
  assert.deepEqual(progressFor({ type: "tradeOpened", training: false, leverage: 10 }).achievements, ["leverage10x"]);
});

test("training return compounds on the virtual stack and floors at -100%", () => {
  // +10% of the stack, then +10% again = +21%.
  const afterTwo = compoundTrainingReturn(compoundTrainingReturn(0, 10, 100), 10, 100);
  assert.ok(Math.abs(afterTwo - 21) < 1e-9);
  assert.equal(compoundTrainingReturn(0, -150, 100), -100);
  assert.equal(compoundTrainingReturn(12, 5, 0), 12);
});
