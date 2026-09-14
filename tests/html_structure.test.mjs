import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");

test("required Alpha workflow controls are present exactly once", () => {
  const ids = [
    "symbolSearch", "findSymbol", "marketScore", "radarRows", "restoreTop10", "scoreBreakdown",
    "optionContract", "tradeForm", "optionPremium", "contractExpiry",
    "contractStrike", "contractSide", "entryDate", "indicatorDashboard", "entryTiming",
    "chartValidation", "chartUpload", "evaluateChart", "otcReview", "otcForm",
    "otcUnderlying", "otcProductType", "otcPosition", "otcNotional", "otcSpot",
    "otcStrike", "otcPremium", "otcExpiry", "otcCounterparty", "otcTerms",
    "evaluateOtc", "saveOtcReview", "otcResult", "otcSaved"
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

test("OTC review exposes the evidence gate and never promises auto execution", () => {
  assert.match(html, /changwai-qiuzhu-cn/);
  assert.equal((html.match(/data-otc-check=/g) || []).length, 5);
  assert.match(html, /BLOCK、NEEDS REVIEW 或 MANUAL REVIEW/);
});


test("V1.8 keeps TOP10 primary and labels data mode honestly", () => {
  assert.match(html, /美股交易热度 TOP10/);
  assert.match(html, /LEAN CORE/);
  assert.match(html, /IBKR 快照模式/);
  assert.doesNotMatch(html, /IBKR 已连接/);
});
