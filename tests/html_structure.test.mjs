import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");

test("required Alpha workflow controls are present exactly once", () => {
  const ids = [
    "symbolSearch", "findSymbol", "marketScore", "radarRows", "scoreBreakdown",
    "optionContract", "tradeForm", "optionPremium", "contractExpiry",
    "contractStrike", "contractSide", "entryDate", "indicatorDashboard", "entryTiming",
    "chartValidation", "chartUpload", "evaluateChart"
  ];
  for (const id of ids) {
    assert.equal((html.match(new RegExp(`id=[\"']${id}[\"']`, "g")) || []).length, 1, id);
  }
});

test("chart gate is visible before the trade plan", () => {
  assert.ok(html.indexOf('id="chartValidation"') < html.indexOf('id="tradeForm"'));
  assert.match(html, /保存计划前必做/);
});

test("verified snapshot loads before application logic", () => {
  assert.ok(html.indexOf('src="data.js"') < html.indexOf('src="app.js"'));
  assert.doesNotMatch(html, /手动 \/ 演示数据/);
});

test("technical and option decision fields are visible", () => {
  assert.match(html, /MA20 \/ 50 \/ 200/);
  assert.match(html, /RSI 14/);
  assert.match(html, /MACD \/ 信号/);
  assert.match(html, /Volume \/ RVOL/);
  assert.match(html, /计划入场日期/);
});
