# Alpha Radar V1.8 — LEAN Engine Edition

一个面向美股与美式挂牌期权的“先筛选、再验证、后计划”交易雷达。首页始终保留交易热度 TOP10；导入单个标的不再覆盖原来的十个标的，并提供“恢复 TOP10”按钮。

## 已完成

- 成交额排序的 TOP10 雷达，MA20/50/200、RSI14、MACD、Volume/RVOL、ATR14
- PreTrade 20 分技术评分、CALL/PUT 入场条件、行权价/到期日/报价/价差检查
- 0DTE 优先，7–45 DTE 备选；单张权利金默认不超过 $100
- K 线截图上传与入场前核对
- Trade Plan、Journal、Risk；账户默认 $4,700、最多 2 个计划
- QuantConnect LEAN 源码以固定 Git 子模块接入，并提供 Alpha Radar Python 算法
- 自动下单关闭，先回测与 IBKR Paper

## 为什么选择 LEAN

这里的“最强”指最适合本项目，不代表任何系统能保证盈利。

| 引擎 | 优势 | 不作为本项目主引擎的原因 |
|---|---|---|
| **QuantConnect LEAN** | 美股/期权、Python/C#、回测/优化/实盘同一事件引擎、官方 IBKR 集成、Apache-2.0 | 本机运行需要依赖，实时数据仍需订阅 |
| Microsoft Qlib | AI 因子研究和机器学习流程强 | 不是面向 IBKR 美式期权实时执行的直接方案 |
| NautilusTrader | Rust 低延迟与事件驱动架构强 | 对当前账户和网页目标复杂度偏高 |
| vectorbt | 参数扫描与向量化回测快 | 不适合承担完整的 IBKR 实盘/风控后端 |
| Freqtrade | 社区大、自动化成熟 | 主要面向加密货币，不符合美股期权目标 |

LEAN 的价值是让历史回测、模拟盘和实盘使用相同的证券、订单、费用、滑点和风控模型。真正的交易模型仍必须通过样本外回测、模拟盘和最大回撤约束，不能用 GitHub 星数代替验证。

## 运行网页

```bash
npm run check
npm start
```

浏览器打开 `http://localhost:4173`。

## 下载并编译 LEAN

Windows：

```powershell
git clone --recurse-submodules https://github.com/gavin723/guo.git
cd guo
powershell -ExecutionPolicy Bypass -File .\quant-engine\install.ps1
```

macOS/Linux：

```bash
git clone --recurse-submodules https://github.com/gavin723/guo.git
cd guo
bash quant-engine/install.sh
```

详细说明见 [quant-engine/README.md](quant-engine/README.md)。

## 数据真实性

当前静态网页标注为 **IBKR 快照模式**，不会把历史价格伪装成实时价格。ChatGPT 中连接的 IBKR 插件不会自动授权一个外部网页读取账户。要启用实时 TOP10 与期权链，需要在受控后端运行 LEAN，并配置 IBKR Pro、行情订阅及只读/模拟权限；凭据不得提交到 GitHub。
