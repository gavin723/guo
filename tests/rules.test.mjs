import test from "node:test";
import assert from "node:assert/strict";

test("100-point Alpha preserves the original 17/20 A+ threshold", () => {
  const grade = value => value >= 85 ? "A+" : value >= 75 ? "A" : "WATCH";
  assert.equal(grade(85), "A+");
  assert.equal(grade(75), "A");
  assert.equal(grade(74), "WATCH");
});

test("risk sizing respects both risk budget and 50 percent capital cap", () => {
  const account = 4700, riskPct = 1, entry = 100, stop = 95;
  const riskShares = Math.floor((account * riskPct / 100) / (entry - stop));
  const budgetShares = Math.floor((account * 0.5) / entry);
  assert.equal(Math.min(riskShares, budgetShares), 9);
});

test("options premium hard limit accepts 100 and rejects 101", () => {
  const allowed = premium => premium <= 100;
  assert.equal(allowed(100), true);
  assert.equal(allowed(101), false);
});

test("chart confirmation needs at least four of six rules including a stop", () => {
  const passed = checked => checked.length >= 4 && checked.includes("stop");
  assert.equal(passed(["trend", "macd", "rsi", "stop"]), true);
  assert.equal(passed(["trend", "macd", "rsi", "volume"]), false);
  assert.equal(passed(["trend", "volume", "stop"]), false);
});

test("Alpha signal stays incomplete while any core source is missing", () => {
  const values = [7, null, null, 16, null];
  const complete = values.every(value => Number.isFinite(value));
  const coverage = values.filter(value => Number.isFinite(value)).length * 20;
  assert.equal(complete, false);
  assert.equal(coverage, 40);
});

test("option hard rules include cost, spread, OI, volume and DTE", () => {
  const option = { bid: 2.94, ask: 2.99, openInterest: 26681, volume: null, dte: 33 };
  const spread = (option.ask - option.bid) / ((option.ask + option.bid) / 2) * 100;
  assert.ok(option.ask * 100 > 100);
  assert.ok(spread <= 15);
  assert.ok(option.openInterest >= 500);
  assert.equal(Number.isFinite(option.volume), false);
  assert.ok(option.dte >= 21 && option.dte <= 45);
});

test("PUT risk and reward use inverted price direction", () => {
  const entry = 157.56, stop = 171.49, target = 122.74;
  const risk = stop - entry;
  const reward = entry - target;
  assert.ok(risk > 0);
  assert.ok(reward > 0);
  assert.ok(reward / risk >= 2.49);
});
