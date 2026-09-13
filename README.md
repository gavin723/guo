# Alpha Radar V1.7

美股、挂牌期权与场外期权风险审查系统。

- IBKR 日线快照与明确的数据时间
- MA20 / MA50 / MA200、RSI14、MACD 12/26/9、Volume/RVOL、ATR14
- PreTrade 20 分技术评分与 CALL/PUT 入场触发
- 挂牌期权的行权价、到期日、DTE、Bid/Ask、OI、成本与保守盈亏比
- K 线截图入场验证、Trade Plan、Risk 与 Journal
- `SKILL/changwai-qiuzhu-cn` 场外期权条款、估值、交易对手与退出风险审查
- 场外合约五类证据 20 分评分、情景损益与强制 BLOCK

## 本地运行

```bash
npm start
```

打开 http://localhost:4173 。

## 数据说明

当前仓库是静态页面，展示最后一次经 IBKR 验证的快照；GitHub 页面不会继承 ChatGPT 内的 IBKR 登录，也不会把收盘快照伪装成实时流。缺少关键数据或场外条款证据时，系统保持 WAIT/BLOCK。

本项目仅用于研究和交易纪律管理，不构成投资、法律或税务建议。
