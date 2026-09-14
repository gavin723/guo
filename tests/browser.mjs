import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));

await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
assert.equal(await page.locator("#radarRows tr").count(), 10);
await page.locator("#runScan").click();
assert.notEqual(await page.locator("#marketDecision").textContent(), "等待扫描");

await page.locator('[data-select="MRVL"]').first().click();
assert.equal(await page.locator("#selectedTicker").textContent(), "MRVL");
await page.locator("#chartUpload").setInputFiles({
  name: "chart.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")
});
await page.locator('[data-chart-rule="trend"]').check();
await page.locator('[data-chart-rule="macd"]').check();
await page.locator('[data-chart-rule="volume"]').check();
await page.locator('[data-chart-rule="stop"]').check();
await page.locator("#evaluateChart").click();
assert.match(await page.locator("#chartEvaluation").textContent(), /通过/);
await page.locator("#tradeForm button[type=submit]").click();
assert.equal(await page.locator(".plan-card").count(), 0);
assert.match(await page.locator("#riskMessage").textContent(), /Alpha 数据不完整/);

await page.locator("#optionPremium").fill("101");
assert.match(await page.locator("#riskMessage").textContent(), /超过 100 美元/);
await page.locator("#optionPremium").fill("");

await page.locator("#openImport").click();
await page.locator("#importText").fill(JSON.stringify({ watchlist: [{
  ticker: "TEST", name: "Imported Test", price: 100, change: 1.2,
  ma20: 98, ma50: 95, ma200: 90, rsi14: 60,
  macd: 2, macdSignal: 1, macdHist: 1, macdHistPrev: 0.5,
  volume: 2000000, avgVolume20: 1000000, relVolume: 2, atr14: 3,
  high20: 100, low20: 95, return20: 8, technical: 18,
  institution: 18, capital: 18, catalyst: 18,
  trendDirection: "CALL", setup: "BREAKOUT",
  entryPlan: { status: "READY", direction: "CALL", triggerType: "突破确认", entry: 101, stop: 98, target: 107, rr: 2, timing: "测试触发" }
}] }));
await page.locator("#applyImport").click();
assert.equal(await page.locator("#radarRows tr").count(), 11);

await page.locator("#contractSide").selectOption("STOCK");
await page.locator("#optionPremium").fill("");
await page.locator("#chartUpload").setInputFiles({
  name: "nvda-chart.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")
});
await page.locator('[data-chart-rule="trend"]').check();
await page.locator('[data-chart-rule="macd"]').check();
await page.locator('[data-chart-rule="volume"]').check();
await page.locator('[data-chart-rule="stop"]').check();
await page.locator("#evaluateChart").click();
await page.locator("#tradeForm button[type=submit]").click();
assert.equal(await page.locator(".plan-card").count(), 1);

await page.screenshot({ path: "artifacts/alpha-radar-desktop.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: "networkidle" });
assert.equal(await page.locator("#radarRows tr").count(), 11);
await page.locator("#restoreTop10").click();
assert.equal(await page.locator("#radarRows tr").count(), 10);
await page.screenshot({ path: "artifacts/alpha-radar-mobile.png", fullPage: true });

assert.deepEqual(errors, []);
console.log("Browser QA passed: TOP10 invariant and restore, scan, risk guard, plan save, import persistence, desktop and mobile rendering.");
await browser.close();
