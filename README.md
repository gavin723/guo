# Alpha Radar V1.6

可操作的美股与期权交易雷达静态前端。

- IBKR 日线快照与明确的时间戳
- MA20 / MA50 / MA200
- RSI 14（Wilder）
- MACD 12 / 26 / 9
- Volume、20 日均量与 RVOL
- ATR 14 风险框架与 PreTrade 20 分技术评分
- 期权行权价、到期日、DTE、Bid/Ask、OI、成本与到期保守盈亏比
- K 线截图入场验证、Trade Plan、Risk 与 Journal

## 本地运行

```bash
npm start
```

打开 http://localhost:4173 。

## 数据说明

当前仓库是静态页面，展示最后一次经 IBKR 验证的快照；GitHub 页面不会继承 ChatGPT 内的 IBKR 登录，也不会把收盘快照伪装成实时流。缺少机构、资金、新闻或期权 Volume 时，系统会保持 WAIT/BLOCK。

本项目仅用于研究与交易纪律管理，不构成投资建议。
