import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const context = { window: {} };
vm.createContext(context);
vm.runInContext(readFileSync(new URL("../dist/data.js", import.meta.url), "utf8"), context);
const snapshot = context.window.ALPHA_SNAPSHOT;

test("IBKR snapshot contains ten rows and the verified close prices", () => {
  assert.equal(snapshot.rows.length, 10);
  assert.equal(snapshot.rows.find(row => row.ticker === "NVDA").price, 218.29);
  assert.equal(snapshot.rows.find(row => row.ticker === "META").price, 648.03);
});

test("every row has the V1.8 technical indicators", () => {
  for (const row of snapshot.rows) {
    for (const field of ["ma20", "ma50", "ma200", "rsi14", "macd", "macdSignal", "macdHist", "volume", "relVolume", "atr14", "technical"]) {
      assert.equal(Number.isFinite(row[field]), true, `${row.ticker}.${field}`);
    }
  }
});

test("observed option contracts are blocked when any hard rule fails", () => {
  const observed = snapshot.rows.filter(row => row.option);
  assert.ok(observed.length >= 3);
  for (const row of observed) {
    assert.equal(row.option.qualified, false);
    assert.ok(row.option.rejectReasons.length > 0);
  }
});
