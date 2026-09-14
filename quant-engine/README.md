# Alpha Radar × QuantConnect LEAN

本目录把 Alpha Radar 的网页界面与开源量化引擎 [QuantConnect LEAN](https://github.com/QuantConnect/Lean) 分开：网页负责观察、评分、计划和复盘；LEAN 负责动态市场筛选、指标、期权链、回测与模拟执行。

## 当前安装状态

- `quant-engine/Lean` 是固定到具体提交的 Git 子模块，避免上游更新导致结果突然变化。
- `AlphaRadarAlgorithm.py` 已包含成交额 TOP10、SMA20/50/200、RSI14、MACD、ATR、RVOL、0DTE 优先、7–45 DTE 备选、美式挂牌期权流动性过滤与 A+ 提醒。
- 权利金上限默认为 $1.00/股，即单张合约不超过 $100；最多同时考虑 2 个计划。
- 自动下单关闭。先回测、再 IBKR 模拟账户，最后才由账户本人决定是否实盘。

## Windows 安装

以 PowerShell 打开项目目录：

```powershell
git clone --recurse-submodules https://github.com/gavin723/guo.git
cd guo
powershell -ExecutionPolicy Bypass -File .\quant-engine\install.ps1
```

脚本需要 Git 与 .NET 10 SDK。若使用官方 LEAN CLI，本机还需要 Docker；QuantConnect 官方文档目前说明 CLI 组织工作区需要付费层级：

```powershell
python -m pip install --upgrade lean
lean --version
```

## 数据与 IBKR

GitHub Pages/Sites 这类静态网页不能安全持有 IBKR 凭据，也不能直接继承 ChatGPT 内的 IBKR 连接。实时运行需要后端 LEAN 进程、IBKR Pro、相应美股/期权行情订阅和账户授权。LEAN 将结果写入 Object Store 键 `alpha-radar/top10.json`，后续适配器再把它推给网页。

IBKR Lite API 不受官方 LEAN IBKR 集成支持；建议先用 IBKR Paper 账户验证至少 20–30 个交易日。

## 0DTE 规则

0DTE 被优先扫描，但不是被优先交易。合约必须同时满足：

- 技术分至少 17/20 且方向共振；
- Ask ≤ $1.00、价差 ≤ 10%；
- OI ≥ 100、当日期权 Volume ≥ 20；
- CALL 目标 Delta 约 0.40；PUT 使用绝对 Delta 约 0.40；
- 不满足时退回 7–45 DTE swing 候选或 WAIT。

这些阈值是风险闸门，不是胜率承诺。0DTE 的 Gamma 与时间价值衰减都更极端，必须使用限价和硬止损。
