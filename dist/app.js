(function () {
  "use strict";

  const SNAPSHOT = window.ALPHA_SNAPSHOT || { marketScore: 0, rows: [], asof: null, source: "未连接" };
  const STORAGE = {
    watchlist: "alpha-v16-watchlist-v1",
    plans: "alpha-v16-plans-v1",
    notes: "alpha-v16-notes-v1",
    otcCases: "alpha-v16-otc-cases-v1",
    regime: "alpha-v16-regime"
  };
  const componentNames = { market: "市场", institution: "机构", capital: "资金", technical: "结构", catalyst: "催化" };
  const defaultRows = SNAPSHOT.rows.map(row => structuredClone(row));
  let watchlist = load(STORAGE.watchlist, defaultRows);
  let plans = load(STORAGE.plans, []);
  let notes = load(STORAGE.notes, []);
  let otcCases = load(STORAGE.otcCases, []);
  let lastOtcReview = null;
  let regime = localStorage.getItem(STORAGE.regime) || "neutral";
  let selected = watchlist.find(item => item.ticker === "NVDA")?.ticker || watchlist[0]?.ticker || "NVDA";
  let chartState = { ticker: selected, uploaded: false, passed: false };

  const $ = id => document.getElementById(id);
  const els = {
    radarRows: $("radarRows"), marketDecision: $("marketDecision"), marketScore: $("marketScore"),
    scanStatus: $("scanStatus"), metricCount: $("metricCount"), metricQualified: $("metricQualified"),
    metricFlow: $("metricFlow"), metricPlans: $("metricPlans"), selectedTicker: $("selectedTicker"),
    detailSymbol: $("detailSymbol"), scoreBreakdown: $("scoreBreakdown"), detailVerdict: $("detailVerdict"),
    indicatorDashboard: $("indicatorDashboard"), entryTiming: $("entryTiming"),
    institutionValue: $("institutionValue"), capitalValue: $("capitalValue"), structureValue: $("structureValue"),
    contractValue: $("contractValue"), catalystValue: $("catalystValue"), optionContract: $("optionContract"),
    sharesOut: $("sharesOut"), riskOut: $("riskOut"), rrOut: $("rrOut"), riskMessage: $("riskMessage"),
    savedPlans: $("savedPlans"), flowAlerts: $("flowAlerts"), noteList: $("noteList"),
    otcResult: $("otcResult"), otcSaved: $("otcSaved"),
    dialog: $("importDialog"), importText: $("importText"), importFeedback: $("importFeedback"), toast: $("toast")
  };

  function load(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : structuredClone(fallback);
    } catch {
      return structuredClone(fallback);
    }
  }
  function finite(value) { return value !== null && value !== "" && Number.isFinite(Number(value)); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value))); }
  function marketComponent() { return { "risk-off": 4, neutral: Number(SNAPSHOT.marketScore) || 0, "risk-on": 12 }[regime]; }
  function components(item) {
    return {
      market: marketComponent(),
      institution: finite(item.institution) ? clamp(item.institution, 0, 20) : null,
      capital: finite(item.capital) ? clamp(item.capital, 0, 20) : null,
      technical: finite(item.technical) ? clamp(item.technical, 0, 20) : null,
      catalyst: finite(item.catalyst) ? clamp(item.catalyst, 0, 20) : null
    };
  }
  function alpha(item) {
    const values = components(item);
    const available = Object.values(values).filter(finite);
    return {
      values,
      complete: available.length === 5,
      total: available.length === 5 ? available.reduce((a, b) => a + Number(b), 0) : null,
      verified: available.reduce((a, b) => a + Number(b), 0),
      coverage: available.length * 20
    };
  }
  function grade(value, complete = true) {
    if (!complete) return { label: "待数据", cls: "watch" };
    return value >= 85 ? { label: "A+", cls: "aplus" } : value >= 75 ? { label: "A", cls: "a" } : { label: "观察", cls: "watch" };
  }
  function currentItem() { return watchlist.find(item => item.ticker === selected) || watchlist[0]; }
  function money(value, digits = 2) {
    return finite(value) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits }).format(Number(value)) : "--";
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  }
  function compactMoney(value) {
    return finite(value) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(Number(value)) : "--";
  }
  function pct(value) { return finite(value) ? `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}%` : "--"; }
  function number(value, digits = 2) { return finite(value) ? Number(value).toFixed(digits) : "--"; }
  function formatVolume(value) { return finite(value) ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value)) : "--"; }
  function shortDate(value) {
    if (!value) return "--";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(date);
  }

  function renderAll({ resetForm = false } = {}) {
    renderMarket();
    renderRadar();
    renderDetail(resetForm);
    renderPlans();
    renderAlerts();
    renderNotes();
    renderOtcCases();
    updateRegimeButtons();
    calculateRisk();
  }
  function renderMarket() {
    els.marketScore.textContent = marketComponent();
    els.marketDecision.textContent = marketComponent() >= 14 ? "进攻但不追高" : marketComponent() >= 9 ? "中性，等待确认" : "中性偏防守";
  }
  function renderRadar() {
    const sorted = [...watchlist].sort((a, b) => (alpha(b).total ?? alpha(b).verified) - (alpha(a).total ?? alpha(a).verified));
    els.radarRows.innerHTML = sorted.map((item, index) => {
      const result = alpha(item);
      const g = grade(result.total, result.complete);
      const entry = item.entryPlan;
      const macdBullish = Number(item.macd) > Number(item.macdSignal);
      return `<tr class="${item.ticker === selected ? "selected" : ""}">
        <td>${String(index + 1).padStart(2, "0")}</td>
        <td class="ticker-cell"><strong>${escapeHtml(item.ticker)}</strong><small>${escapeHtml(item.name)}</small></td>
        <td>${money(item.price)}<small class="cell-note">${pct(item.change)} · ${shortDate(item.asof)}</small></td>
        <td>${number(item.ma20)} / ${number(item.ma50)} / ${number(item.ma200)}</td>
        <td><span class="indicator-value ${Number(item.rsi14) > 72 || Number(item.rsi14) < 28 ? "negative" : ""}">${number(item.rsi14, 1)}</span></td>
        <td><span class="indicator-value ${macdBullish ? "positive" : "negative"}">${number(item.macd, 2)} / ${number(item.macdSignal, 2)}</span><small class="cell-note">柱 ${number(item.macdHist, 2)}</small></td>
        <td>${formatVolume(item.volume)}<small class="cell-note">RVOL ${number(item.relVolume, 2)}×</small></td>
        <td><span class="score-pill ${Number(item.technical) >= 15 ? "a" : "watch"}">${finite(item.technical) ? `${item.technical}/20` : "待数据"}</span></td>
        <td><span class="entry-pill ${entry?.status === "READY" ? "ready" : "wait"}">${entry?.status === "READY" ? "READY" : "WAIT"}</span><small class="cell-note">${entry ? `${entry.direction} @ ${number(entry.entry)}` : "无共振"}</small></td>
        <td><button class="row-btn" data-select="${escapeHtml(item.ticker)}">验证 →</button></td>
      </tr>`;
    }).join("");
    els.metricCount.textContent = watchlist.length;
    els.metricQualified.textContent = watchlist.filter(item => Number(item.technical) >= 15).length;
    els.metricFlow.textContent = watchlist.filter(item => alpha(item).complete).length;
    els.metricPlans.textContent = `${plans.length} / 2`;
  }
  function renderDetail(resetForm = true) {
    const item = currentItem();
    if (!item) return;
    const result = alpha(item);
    const missing = Object.entries(result.values).filter(([, value]) => !finite(value)).map(([key]) => componentNames[key]);
    els.selectedTicker.textContent = item.ticker;
    els.detailSymbol.textContent = item.ticker;
    els.scoreBreakdown.innerHTML = Object.entries(result.values).map(([key, value]) =>
      `<div class="score-factor"><span>${componentNames[key]}</span><b>${finite(value) ? `${value} / 20` : "待接入"}</b><i style="--meter:${finite(value) ? Number(value) * 5 : 0}%"></i></div>`
    ).join("");
    renderIndicators(item);
    renderEntryTiming(item);
    let title;
    let body;
    if (!result.complete) {
      title = `WAIT · 数据完整度 ${result.coverage}%`;
      body = `缺少${missing.join("、")}数据，不能生成买入/卖出信号。已验证部分为 ${result.verified} 分。`;
    } else if (result.total >= 85) {
      title = `${result.total} 分 · A+`;
      body = "进入价格确认；仍需通过 K 线、期权流动性与仓位规则。";
    } else if (result.total >= 75) {
      title = `${result.total} 分 · A`;
      body = "加入候选，等待突破或回踩确认。";
    } else {
      title = `${result.total} 分 · 观察`;
      body = "不创建新仓，等待综合条件改善。";
    }
    els.detailVerdict.innerHTML = `<b>${title}</b><p>${body}</p>`;
    els.institutionValue.textContent = finite(item.institution) ? `${item.institution}/20` : "待接入 13F";
    els.capitalValue.textContent = finite(item.capital) ? `${item.capital}/20` : "待接入暗池/期权流";
    els.structureValue.textContent = `${item.technical}/20 · RSI ${number(item.rsi14, 1)} · RVOL ${number(item.relVolume, 2)}×`;
    els.catalystValue.textContent = finite(item.catalyst) ? `${item.catalyst}/20` : "待接入新闻";
    els.contractValue.textContent = item.option ? `${item.option.qualified ? "合格" : "未通过"} · ${item.option.expiration} ${item.option.strike} ${item.option.type}` : "无已验证盘口";
    renderOption(item);
    if (chartState.ticker !== item.ticker) {
      chartState = { ticker: item.ticker, uploaded: false, passed: false };
      $("chartUpload").value = "";
      $("chartPreview").removeAttribute("src");
      $("uploadZone").classList.remove("has-image");
      document.querySelectorAll("[data-chart-rule]").forEach(input => { input.checked = false; });
    }
    $("technicalSummary").textContent = `MA ${item.trendDirection || "NONE"} · RSI ${number(item.rsi14, 1)} · MACD柱 ${number(item.macdHist, 2)} · RVOL ${number(item.relVolume, 2)}×`;
    const auto = {
      trend: item.trendDirection === "CALL" ? item.price > item.ma20 && item.ma20 > item.ma50 : item.trendDirection === "PUT" ? item.price < item.ma20 && item.ma20 < item.ma50 : false,
      macd: item.trendDirection === "CALL" ? item.macd > item.macdSignal && item.macdHist > item.macdHistPrev : item.trendDirection === "PUT" ? item.macd < item.macdSignal && item.macdHist > item.macdHistPrev : false,
      rsi: item.trendDirection === "CALL" ? item.rsi14 >= 48 && item.rsi14 <= 72 : item.trendDirection === "PUT" ? item.rsi14 >= 28 && item.rsi14 <= 52 : false,
      volume: item.relVolume >= 1.2,
      breakout: item.entryPlan?.status === "READY"
    };
    document.querySelectorAll("[data-chart-rule]").forEach(input => {
      if (input.dataset.chartRule !== "stop") input.checked = Boolean(auto[input.dataset.chartRule]);
    });
    $("chartEvaluation").className = `chart-result ${chartState.passed ? "pass" : ""}`;
    $("chartEvaluation").textContent = chartState.passed ? "已通过当前标的 K 线验证" : chartState.uploaded ? "走势图已上传；请确认止损并生成评估" : "请先上传当前标的走势图";
    if (resetForm) {
      $("entryDate").value = new Date().toISOString().slice(0, 10);
      $("entryPrice").value = Number(item.entryPlan?.entry ?? item.price).toFixed(2);
      $("stopPrice").value = Number(item.entryPlan?.stop ?? item.low20).toFixed(2);
      $("targetPrice").value = Number(item.entryPlan?.target ?? item.high20 * 1.05).toFixed(2);
      $("optionPremium").value = item.option?.ask ? Number(item.option.ask * 100).toFixed(0) : "";
      $("contractExpiry").value = item.option?.expiration || "";
      $("contractStrike").value = item.option?.strike || "";
      $("contractSide").value = item.option?.type || (item.entryPlan?.direction || "STOCK");
    }
  }
  function renderIndicators(item) {
    const macdUp = Number(item.macd) > Number(item.macdSignal);
    const histImproving = Number(item.macdHist) > Number(item.macdHistPrev);
    const maAligned = item.trendDirection === "CALL" || item.trendDirection === "PUT";
    const rsiState = item.rsi14 > 72 ? "过热" : item.rsi14 < 28 ? "超卖" : item.rsi14 >= 48 && item.rsi14 <= 68 ? "顺势区" : "中性";
    const cards = [
      ["MA 20 / 50 / 200", `${number(item.ma20)} / ${number(item.ma50)} / ${number(item.ma200)}`, maAligned ? item.trendDirection : "未对齐"],
      ["RSI 14", number(item.rsi14, 1), rsiState],
      ["MACD 12/26/9", `${number(item.macd, 2)} / ${number(item.macdSignal, 2)}`, `${macdUp ? "线上" : "线下"} · 柱${histImproving ? "改善" : "走弱"}`],
      ["成交量", `${formatVolume(item.volume)} / ${formatVolume(item.avgVolume20)}`, `RVOL ${number(item.relVolume, 2)}×`],
      ["ATR 14", `${money(item.atr14)} · ${number(item.atrPct, 1)}%`, "波动止损基准"],
      ["PreTrade 技术分", `${item.technical} / 20`, item.technical >= 15 ? "技术候选" : "继续等待"]
    ];
    els.indicatorDashboard.innerHTML = cards.map(([label, value, note]) =>
      `<div class="indicator-card"><small>${label}</small><b>${value}</b><span>${note}</span></div>`
    ).join("");
  }
  function renderEntryTiming(item) {
    const plan = item.entryPlan;
    if (!plan) {
      els.entryTiming.className = "entry-timing wait";
      els.entryTiming.innerHTML = `<div><small>ENTRY TIMING</small><b>WAIT · 当前没有方向共振</b><p>均线、MACD 与 RSI 尚未形成同向结构，不选择期权行权价。</p></div>`;
      return;
    }
    const ready = plan.status === "READY" && Number(item.technical) >= 15;
    els.entryTiming.className = `entry-timing ${ready ? "ready" : "wait"}`;
    els.entryTiming.innerHTML = `<div class="timing-head"><div><small>ENTRY TIMING · ${escapeHtml(plan.direction)}</small><b>${ready ? "READY" : "WAIT"} · ${escapeHtml(plan.triggerType)}</b></div><span>${plan.rr.toFixed(1)}R 计划</span></div>
      <div class="timing-levels"><div><small>触发价</small><b>${money(plan.entry)}</b></div><div><small>失效 / 止损</small><b>${money(plan.stop)}</b></div><div><small>目标价</small><b>${money(plan.target)}</b></div></div>
      <p>${escapeHtml(plan.timing)}</p>`;
  }
  function renderOption(item) {
    const option = item.option;
    if (!option) {
      els.optionContract.className = "option-contract empty";
      els.optionContract.innerHTML = "当前没有与技术方向匹配的已验证 IBKR 期权盘口；不凭空给出行权价或到期日。";
      return;
    }
    const midpoint = (option.bid + option.ask) / 2;
    const spread = (option.ask - option.bid) / midpoint * 100;
    const cost = option.ask * 100;
    const rejects = option.rejectReasons || [];
    els.optionContract.className = `option-contract ${option.qualified ? "qualified" : "rejected"}`;
    els.optionContract.innerHTML = `<div class="contract-main"><small>${option.qualified ? "当前最优合格合约" : "当前无合格合约 · 仅观察盘口"}</small><b>${item.ticker} ${option.expiration} ${option.strike} ${option.type}</b><span>${escapeHtml(option.selection || "IBKR 已验证")}</span></div><div><small>BID / ASK</small><b>${option.bid.toFixed(2)} / ${option.ask.toFixed(2)}</b></div><div><small>成本 / 价差</small><b>${money(cost, 0)} / ${spread.toFixed(1)}%</b></div><div><small>DTE / OI</small><b>${option.dte ?? "--"} / ${Number(option.openInterest).toLocaleString()}</b></div><div><small>到期保守盈亏比</small><b>${finite(option.expiryRR) ? `${Number(option.expiryRR).toFixed(2)} : 1` : "无入场目标"}</b></div><div><small>执行结论</small><b>${option.qualified ? "PASS" : "BLOCK"}</b><span>${option.qualified ? "等待价格触发" : escapeHtml(rejects.join("；"))}</span></div>`;
  }
  function renderAlerts() {
    const alerts = watchlist.filter(item => finite(item.optionsRatio) && Number(item.optionsRatio) >= 3).sort((a, b) => b.optionsRatio - a.optionsRatio);
    els.flowAlerts.innerHTML = alerts.length ? alerts.map(item =>
      `<button class="flow-alert" data-select="${escapeHtml(item.ticker)}" type="button"><span class="pulse"></span><span><b>${item.ticker} · ${escapeHtml(item.option?.expiration || "合约待验证")}</b><small>期权成交/持仓量比 ${Number(item.optionsRatio).toFixed(1)}× · ${compactMoney(item.optionPremiumFlow)}</small></span><strong>${Number(item.optionsRatio) >= 5 ? "强异动" : "关注"}</strong></button>`
    ).join("") : `<div class="hard-rule"><b>当前不生成异常大单</b><p>IBKR 已返回部分合约报价和 OI，但没有全市场逐笔期权流与稳定 Volume。仅凭 OI 不能判断主动买入或卖出，因此 TOP10 与买卖信号保持关闭。</p></div>`;
  }
  function calculateRisk() {
    const item = currentItem();
    const result = item ? alpha(item) : null;
    const account = Number($("accountSize").value);
    const riskPct = Number($("riskPct").value);
    const entry = Number($("entryPrice").value);
    const stop = Number($("stopPrice").value);
    const target = Number($("targetPrice").value);
    const premium = Number($("optionPremium").value || 0);
    const side = $("contractSide").value;
    if (![account, riskPct, entry, stop, target].every(value => value > 0)) return resetRisk("请输入完整且大于 0 的价格。", true);
    const bearish = side === "PUT";
    const perShare = bearish ? stop - entry : entry - stop;
    const rewardPerShare = bearish ? entry - target : target - entry;
    if (perShare <= 0) return resetRisk(bearish ? "PUT 计划的止损必须高于入场价。" : "多头计划的止损必须低于入场价。", true);
    if (rewardPerShare <= 0) return resetRisk(bearish ? "PUT 计划的目标价必须低于入场价。" : "第一目标价必须高于入场价。", true);
    const riskBudget = account * riskPct / 100;
    const riskShares = Math.floor(riskBudget / perShare);
    const budgetShares = Math.floor(account * 0.5 / entry);
    const shares = Math.max(0, Math.min(riskShares, budgetShares));
    const actualRisk = shares * perShare;
    const rr = rewardPerShare / perShare;
    els.sharesOut.textContent = side === "STOCK" ? String(shares) : "1 合约";
    els.riskOut.textContent = side === "STOCK" ? money(actualRisk) : money(premium);
    els.rrOut.textContent = `${rr.toFixed(2)} : 1`;
    const problems = [];
    if (side === "STOCK" && shares < 1) problems.push("账户规模与止损距离不匹配");
    if (rr < 2) problems.push("盈亏比低于 2:1");
    if (side !== "STOCK" && premium <= 0) problems.push("缺少期权成本");
    if (premium > 100) problems.push("期权成本超过 100 美元");
    if (side !== "STOCK" && premium > riskBudget) problems.push(`期权最大亏损超过 ${riskPct}% 风险预算`);
    if (Number(item?.technical) < 15) problems.push("PreTrade 技术评分低于 15/20");
    if (!item?.entryPlan || item.entryPlan.status !== "READY") problems.push("入场触发尚未成立");
    if (chartState.ticker !== selected || !chartState.passed) problems.push("K 线截图尚未上传并通过验证");
    if (!result?.complete) problems.push("Alpha 数据不完整");
    else if (result.total < 75) problems.push("Alpha 评分低于 A 级");
    const option = item?.option;
    if (side !== "STOCK" && option) {
      const chosenExpiry = $("contractExpiry").value;
      const chosenStrike = Number($("contractStrike").value);
      if (chosenExpiry !== option.expiration || chosenStrike !== Number(option.strike) || side !== option.type) problems.push("所选期权没有已验证盘口");
      const spread = (option.ask - option.bid) / ((option.ask + option.bid) / 2) * 100;
      if (spread > 15) problems.push("Bid/Ask 价差超过 15%");
      if (option.openInterest < 500) problems.push("持仓量低于 500");
      if (!finite(option.volume)) problems.push("期权 Volume 未返回");
      const entryDate = new Date(`${$("entryDate").value}T00:00:00Z`);
      const expiryDate = new Date(`${chosenExpiry}T00:00:00Z`);
      const dte = Math.round((expiryDate - entryDate) / 86400000);
      if (!Number.isFinite(dte) || dte < 21 || dte > 45) problems.push("到期日不在入场后 21–45 天");
      if (finite(option.expiryRR) && Number(option.expiryRR) < 2) problems.push("到期保守盈亏比低于 2:1");
    } else if (side !== "STOCK") {
      problems.push("缺少已验证期权盘口");
    }
    els.riskMessage.textContent = problems.length ? problems.join("；") + "。" : "通过：综合数据、流动性、成本与仓位规则均符合要求。";
    els.riskMessage.className = problems.length ? "warning" : "ready";
    return { account, riskPct, entryDate: $("entryDate").value, entry, stop, target, premium, side, shares, actualRisk, rr, valid: !problems.length };
  }
  function resetRisk(message, warning = false) {
    els.sharesOut.textContent = "--";
    els.riskOut.textContent = "--";
    els.rrOut.textContent = "--";
    els.riskMessage.textContent = message;
    els.riskMessage.className = warning ? "warning" : "";
    return null;
  }
  function renderPlans() {
    els.savedPlans.innerHTML = plans.length ? plans.map((plan, index) =>
      `<div class="plan-card"><div><b>${escapeHtml(plan.ticker)} · ${escapeHtml(plan.side)} · ${escapeHtml(plan.entryDate || "日期待定")}</b><p>入场 ${money(plan.entry)} / 止损 ${money(plan.stop)} / 目标 ${money(plan.target)} · 最大风险 ${money(plan.side === "STOCK" ? plan.actualRisk : plan.premium)}${plan.side !== "STOCK" ? ` · ${escapeHtml(plan.expiry)} ${number(plan.strike)}` : ""}</p></div><button data-remove-plan="${index}" aria-label="删除 ${escapeHtml(plan.ticker)} 计划">×</button></div>`
    ).join("") : `<p class="source-note">尚无通过全部硬规则的执行计划。最多同时保存 2 个标的。</p>`;
    els.metricPlans.textContent = `${plans.length} / 2`;
  }
  function renderNotes() {
    const list = notes.slice().reverse();
    els.noteList.innerHTML = list.map(note => `<div class="note-item"><small>${escapeHtml(note.date)} · ${escapeHtml(note.ticker)}</small><p>${escapeHtml(note.text)}</p></div>`).join("");
  }
  function evaluateOtc() {
    const underlying = $("otcUnderlying").value.trim().toUpperCase();
    const product = $("otcProductType").value;
    const position = $("otcPosition").value;
    const notional = Number($("otcNotional").value);
    const spot = Number($("otcSpot").value);
    const strike = Number($("otcStrike").value);
    const premium = Number($("otcPremium").value);
    const expiry = $("otcExpiry").value;
    const counterparty = $("otcCounterparty").value.trim();
    const quoteSource = $("otcQuoteSource").value.trim();
    const terms = $("otcTerms").value.trim();
    const checked = [...document.querySelectorAll("[data-otc-check]:checked")].map(input => input.dataset.otcCheck);
    const score = checked.length * 4;
    const blockers = [];
    if (!underlying) blockers.push("缺少标的");
    if (![notional, spot, strike, premium].every(value => value > 0)) blockers.push("名义本金、现价、行权价或权利金无效");
    if (!expiry || new Date(`${expiry}T00:00:00Z`) <= new Date()) blockers.push("到期日无效或已经到期");
    if (!counterparty) blockers.push("交易对手法律实体不明");
    if (terms.length < 30) blockers.push("关键条款不足，无法重建支付结构");
    if (!checked.includes("docs")) blockers.push("没有完整 term sheet 与支付公式");
    if (!checked.includes("counterparty")) blockers.push("交易对手、担保或抵押安排未审查");
    if (!checked.includes("loss")) blockers.push("最大损失或路径条件未确认");
    if (position === "SELL") blockers.push("卖方尾部损失需要独立保证金与专业适当性审查");
    const complex = !["CALL", "PUT"].includes(product);
    const gaps = {
      docs: "完整条款",
      pricing: "独立估值/第二报价",
      counterparty: "交易对手与抵押",
      exit: "提前终止与退出报价",
      loss: "最大损失与路径"
    };
    const missing = Object.entries(gaps).filter(([key]) => !checked.includes(key)).map(([, label]) => label);
    const decision = blockers.length ? "BLOCK" : score >= 18 && !complex ? "MANUAL REVIEW" : "NEEDS REVIEW";
    const breakeven = product === "CALL" ? strike + premium : product === "PUT" ? strike - premium : null;
    const scenarios = [0.8, 0.9, 1, 1.1, 1.2].map(factor => {
      const terminal = spot * factor;
      let net = null;
      if (product === "CALL") net = Math.max(terminal - strike, 0) - premium;
      if (product === "PUT") net = Math.max(strike - terminal, 0) - premium;
      if (position === "SELL" && net !== null) net = -net;
      return { terminal, net };
    });
    const review = { underlying, product, position, notional, spot, strike, premium, expiry, counterparty, quoteSource, terms, score, decision, blockers, missing, breakeven, scenarios, createdAt: new Date().toISOString() };
    lastOtcReview = review;
    $("saveOtcReview").disabled = false;
    const scenarioHtml = complex ? `<div class="otc-complex-note">该产品含路径或非标准条款，不能套用普通欧式期权公式。必须逐观察日建模。</div>` : `<div class="otc-scenarios">${scenarios.map(row => `<div><small>到期标的 ${money(row.terminal)}</small><b class="${row.net >= 0 ? "positive" : "negative"}">${row.net >= 0 ? "+" : ""}${money(row.net)} / 单位</b></div>`).join("")}</div>`;
    els.otcResult.className = `otc-result ${decision === "BLOCK" ? "blocked" : decision === "MANUAL REVIEW" ? "manual" : "review"}`;
    els.otcResult.innerHTML = `<div class="otc-result-head"><div><small>OTC 20 分审查</small><b>${decision} · ${score}/20</b></div><span>${escapeHtml(product)} · ${escapeHtml(position)}</span></div>
      <div class="otc-summary"><div><small>名义本金</small><b>${money(notional, 0)}</b></div><div><small>到期日</small><b>${escapeHtml(expiry || "--")}</b></div><div><small>盈亏平衡</small><b>${finite(breakeven) ? money(breakeven) : "需条款模型"}</b></div><div><small>交易对手</small><b>${escapeHtml(counterparty || "未提供")}</b></div></div>
      ${scenarioHtml}
      <div class="otc-findings"><b>阻断项</b><p>${blockers.length ? escapeHtml(blockers.join("；")) : "无绝对阻断项，但仍须人工、法律与适当性复核。"}</p><b>待补证据</b><p>${missing.length ? escapeHtml(missing.join("、")) : "五项证据已勾选；请确认文件内容确实支持。"}</p><small>计算仅为每单位到期静态损益，未包含乘数、数量、费用、提前退出、信用违约或路径依赖。</small></div>`;
    return review;
  }
  function renderOtcCases() {
    els.otcSaved.innerHTML = otcCases.length ? `<h3>已保存审查</h3>${otcCases.slice().reverse().map((item, reverseIndex) => {
      const index = otcCases.length - 1 - reverseIndex;
      return `<div class="otc-case"><div><b>${escapeHtml(item.underlying)} · ${escapeHtml(item.product)} · ${item.score}/20</b><small>${escapeHtml(item.decision)} · ${escapeHtml(item.expiry)} · ${escapeHtml(new Date(item.createdAt).toLocaleString("zh-CN", { hour12: false }))}</small></div><button data-remove-otc="${index}" aria-label="删除 ${escapeHtml(item.underlying)} 场外审查">×</button></div>`;
    }).join("")}` : "";
  }
  function runScan() {
    const complete = watchlist.filter(item => alpha(item).complete).sort((a, b) => alpha(b).total - alpha(a).total);
    const technical = [...watchlist].sort((a, b) => Number(b.technical) - Number(a.technical))[0];
    if (complete.length) {
      const best = complete[0];
      showToast(`综合评估完成：${best.ticker} ${alpha(best).total} 分`);
    } else {
      showToast(`数据不完整：仅技术候选 ${technical.ticker}，不生成买入信号`);
    }
    const asof = SNAPSHOT.asof ? new Date(SNAPSHOT.asof).toLocaleString("zh-CN", { hour12: false, timeZone: "UTC" }) : "未知";
    els.scanStatus.textContent = `本地评估 ${new Date().toLocaleString("zh-CN", { hour12: false })} · IBKR 行情截至 ${asof} UTC · ${SNAPSHOT.marketStatus === "CLOSED" ? "市场休市" : "市场交易中"}`;
    renderAll({ resetForm: false });
  }
  function updateRegimeButtons() {
    document.querySelectorAll("[data-regime]").forEach(button => button.classList.toggle("active", button.dataset.regime === regime));
  }
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 3000);
  }
  function parseImport(raw) {
    const clean = raw.trim();
    if (!clean) throw new Error("请粘贴 CSV 或 JSON 数据。");
    let rows;
    if (clean.startsWith("[") || clean.startsWith("{")) {
      const parsed = JSON.parse(clean);
      rows = Array.isArray(parsed) ? parsed : (parsed.watchlist || []);
    } else {
      const lines = clean.split(/\r?\n/).filter(Boolean);
      const headers = lines.shift().split(",").map(value => value.trim());
      rows = lines.map(line => {
        const values = line.split(",").map(value => value.trim());
        return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
      });
    }
    if (!Array.isArray(rows) || !rows.length) throw new Error("没有识别到标的数据。");
    return rows.slice(0, 50).map(row => {
      const ticker = String(row.ticker || "").trim().toUpperCase();
      if (!/^[A-Z.]{1,8}$/.test(ticker)) throw new Error(`无效代码：${ticker || "空值"}`);
      const base = watchlist.find(item => item.ticker === ticker) || {};
      const nullable = key => row[key] === undefined || row[key] === "" || row[key] === null ? null : clamp(row[key], 0, 20);
      const option = row.option || ((row.optionExpiration || row.optionStrike) ? {
        expiration: row.optionExpiration,
        strike: Number(row.optionStrike),
        type: String(row.optionType || "CALL").toUpperCase(),
        bid: Number(row.bid),
        ask: Number(row.ask),
        iv: row.iv === "" ? null : Number(row.iv),
        volume: row.optionVolume === "" ? null : Number(row.optionVolume),
        openInterest: Number(row.openInterest || 0),
        source: "导入"
      } : base.option || null);
      return {
        ...base, ...row, ticker,
        name: String(row.name || base.name || ticker),
        price: Number(row.price || base.price),
        change: Number(row.change || 0),
        institution: nullable("institution"),
        capital: nullable("capital"),
        technical: nullable("technical") ?? base.technical,
        catalyst: nullable("catalyst"),
        optionsRatio: row.optionsRatio === "" || row.optionsRatio === undefined ? null : Number(row.optionsRatio),
        option
      };
    });
  }

  $("runScan").addEventListener("click", runScan);
  $("findSymbol").addEventListener("click", findSymbol);
  $("symbolSearch").addEventListener("keydown", event => { if (event.key === "Enter") findSymbol(); });
  function findSymbol() {
    const symbol = $("symbolSearch").value.trim().toUpperCase();
    const found = watchlist.find(item => item.ticker === symbol);
    if (!found) {
      showToast(`${symbol || "该代码"} 不在当前 IBKR 快照中，请先导入真实数据`);
      return;
    }
    selected = symbol;
    renderAll({ resetForm: true });
    $("cockpit").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  document.querySelectorAll("[data-regime]").forEach(button => button.addEventListener("click", () => {
    regime = button.dataset.regime;
    localStorage.setItem(STORAGE.regime, regime);
    renderAll({ resetForm: false });
  }));
  document.addEventListener("click", event => {
    const select = event.target.closest("[data-select]");
    if (select) {
      selected = select.dataset.select;
      renderAll({ resetForm: true });
      $("cockpit").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const remove = event.target.closest("[data-remove-plan]");
    if (remove) {
      plans.splice(Number(remove.dataset.removePlan), 1);
      localStorage.setItem(STORAGE.plans, JSON.stringify(plans));
      renderPlans();
      renderRadar();
      showToast("执行计划已删除");
    }
    const removeOtc = event.target.closest("[data-remove-otc]");
    if (removeOtc) {
      otcCases.splice(Number(removeOtc.dataset.removeOtc), 1);
      localStorage.setItem(STORAGE.otcCases, JSON.stringify(otcCases));
      renderOtcCases();
      showToast("场外审查已删除");
    }
  });
  ["accountSize","riskPct","entryDate","entryPrice","stopPrice","targetPrice","optionPremium","contractExpiry","contractStrike","contractSide"].forEach(id => $(id).addEventListener("input", calculateRisk));
  $("tradeForm").addEventListener("submit", event => {
    event.preventDefault();
    const result = calculateRisk();
    if (!result?.valid) { showToast("计划未通过硬规则"); return; }
    if (plans.length >= 2) { showToast("最多保存 2 个标的，请先删除旧计划"); return; }
    if (plans.some(plan => plan.ticker === selected)) { showToast(`${selected} 已有执行计划`); return; }
    plans.push({ ...result, ticker: selected, expiry: $("contractExpiry").value, strike: Number($("contractStrike").value || 0), createdAt: new Date().toISOString() });
    localStorage.setItem(STORAGE.plans, JSON.stringify(plans));
    renderPlans();
    renderRadar();
    showToast(`${selected} 执行计划已保存`);
  });
  $("openImport").addEventListener("click", () => {
    els.importFeedback.textContent = "";
    els.importText.value = JSON.stringify({ watchlist: [currentItem()] }, null, 2);
    els.dialog.showModal();
  });
  $("applyImport").addEventListener("click", () => {
    try {
      watchlist = parseImport(els.importText.value);
      selected = watchlist[0].ticker;
      localStorage.setItem(STORAGE.watchlist, JSON.stringify(watchlist));
      els.dialog.close();
      renderAll({ resetForm: true });
      showToast("真实数据已导入，Alpha 评分已重算");
    } catch (error) {
      els.importFeedback.className = "import-feedback error";
      els.importFeedback.textContent = error.message;
    }
  });
  $("chartUpload").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { showToast("仅支持 PNG、JPG 或 WEBP 图片"); event.target.value = ""; return; }
    if (file.size > 8 * 1024 * 1024) { showToast("图片超过 8MB"); event.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => {
      chartState = { ticker: selected, uploaded: true, passed: false };
      $("chartPreview").src = reader.result;
      $("uploadZone").classList.add("has-image");
      $("chartEvaluation").className = "chart-result";
      $("chartEvaluation").textContent = "走势图已上传；请确认止损并生成评估";
      calculateRisk();
      showToast("走势图已载入，仅在本机预览");
    };
    reader.readAsDataURL(file);
  });
  $("evaluateChart").addEventListener("click", () => {
    const checked = [...document.querySelectorAll("[data-chart-rule]:checked")].map(input => input.dataset.chartRule);
    const result = $("chartEvaluation");
    const passed = chartState.ticker === selected && chartState.uploaded && checked.length >= 4 && checked.includes("stop");
    chartState.passed = passed;
    result.className = `chart-result ${passed ? "pass" : "fail"}`;
    result.textContent = passed ? `通过 · ${checked.length}/6 项；继续检查入场触发、Alpha 数据与期权流动性。` : !chartState.uploaded ? "不通过 · 请先上传当前标的走势图。" : `不通过 · ${checked.length}/6 项；止损为必选，且至少满足 4 项。`;
    calculateRisk();
    showToast(`${selected} 趋势验证：${passed ? "通过" : "不通过"}`);
  });
  document.querySelectorAll("[data-chart-rule]").forEach(input => input.addEventListener("change", () => {
    if (!chartState.passed) return;
    chartState.passed = false;
    $("chartEvaluation").className = "chart-result";
    $("chartEvaluation").textContent = "规则已变更，请重新生成 K 线评估";
    calculateRisk();
  }));
  $("saveNote").addEventListener("click", () => {
    const text = $("journalNote").value.trim();
    if (!text) { showToast("请先填写复盘内容"); return; }
    notes.push({ ticker: selected, text, date: new Date().toLocaleString("zh-CN", { hour12: false }) });
    localStorage.setItem(STORAGE.notes, JSON.stringify(notes));
    $("journalNote").value = "";
    renderNotes();
    showToast("复盘笔记已保存");
  });
  $("clearJournal").addEventListener("click", () => {
    if (!confirm("确定清空当前浏览器中的全部复盘笔记吗？")) return;
    notes = [];
    localStorage.removeItem(STORAGE.notes);
    renderNotes();
    showToast("本地复盘记录已清空");
  });
  $("evaluateOtc").addEventListener("click", () => {
    const review = evaluateOtc();
    showToast(`${review.underlying || "场外合约"}：${review.decision}`);
  });
  $("saveOtcReview").addEventListener("click", () => {
    if (!lastOtcReview) { showToast("请先生成场外审查"); return; }
    otcCases.push({ ...lastOtcReview, createdAt: new Date().toISOString() });
    localStorage.setItem(STORAGE.otcCases, JSON.stringify(otcCases));
    renderOtcCases();
    showToast("场外审查已保存在当前浏览器");
  });

  renderAll({ resetForm: true });
})();
