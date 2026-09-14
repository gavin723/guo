import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const algorithm = readFileSync(new URL("../quant-engine/AlphaRadarAlgorithm.py", import.meta.url), "utf8");
const gitmodules = readFileSync(new URL("../.gitmodules", import.meta.url), "utf8");

test("LEAN is pinned as a reproducible upstream engine", () => {
  assert.match(gitmodules, /QuantConnect\/Lean\.git/);
  assert.match(gitmodules, /quant-engine\/Lean/);
});

test("Alpha Radar engine keeps the requested controls", () => {
  for (const token of [
    "TOP_COUNT = 10", "MAX_OPTION_ASK = 1.00", "MAX_OPEN_POSITIONS = 2",
    "self.sma(", "self.rsi(", "self.macd(", "self.atr(",
    "include_weeklys()", "expiration(0, 45)", "OptionRight.CALL", "OptionRight.PUT",
    "object_store.save", "automatic_order_submission = False"
  ]) {
    assert.ok(algorithm.includes(token), token);
  }
});

test("engine is alert-only until paper validation is completed", () => {
  assert.doesNotMatch(algorithm, /\bmarket_order\s*\(/i);
  assert.doesNotMatch(algorithm, /\blimit_order\s*\(/i);
  assert.match(algorithm, /A\+ alert only; no order submitted/);
});
