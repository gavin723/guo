# 场外合约审查框架

## 1. 最小条款集

提取并核对：

- 产品类型、标的、方向、名义本金、数量与合约乘数；
- 交易日、生效日、观察日、到期日与结算日；
- 行权价、参与率、上限、下限、障碍、缓冲、敲入/敲出和自动赎回条件；
- 美式/欧式/百慕大式行权、现金/实物结算、币种和汇率处理；
- 权利金、费用、融资成本、股息假设和税费口径；
- 发行人、交易对手、担保人、抵押品、净额结算和违约/提前终止条款；
- 估值代理、争议估值、报价频率、二级退出与买卖价差。

缺少会改变损益的字段时，不补猜默认值。

## 2. 收益重建

先用自然语言写出支付顺序，再写公式。对每个公式标注观察时间、币种、单位和费用是否计入。

普通欧式多头期权的到期净损益基线：

- Call：`max(S_T - K, 0) × multiplier × quantity - total_premium - fees`
- Put：`max(K - S_T, 0) × multiplier × quantity - total_premium - fees`

障碍、自动赎回、平均价、数字式或路径依赖产品必须逐观察日处理，不得套用普通欧式公式。

至少给出严重下跌、温和下跌、横盘、温和上涨和严重上涨五种情景，并单列发行人违约与提前退出情景。说明结果是到期静态估算还是包含路径条件。

## 3. 20 分审查

每类 0–4 分：

1. 条款完整度：关键日期、支付公式和结算均可核对。
2. 定价透明度：有独立估值、波动率/利率/股息假设和全部费用。
3. 交易对手：主体、信用、担保、抵押品及净额结算安排明确。
4. 流动性与退出：有可执行的提前退出机制、报价责任和价差说明。
5. 适配与损失：最大损失、资金占用、期限和压力情景符合已知预算。

评级：

- `18–20`：可进入人工复核，不等于可以买入；
- `14–17`：需要补件或重新报价；
- `<14`：阻断；
- 任一“必须阻断”条件成立时，无论总分均为 `BLOCK`。

## 4. 输出模板

按以下顺序输出：

1. `结论：BLOCK / NEEDS REVIEW / MANUAL REVIEW`
2. 合约条款表
3. 支付公式与假设
4. 情景损益表
5. 五项评分
6. 阻断项与证据缺口
7. 给交易对手的补件问题
8. 数据时间、来源和适用辖区

## 5. 权威资料入口

- SEC/Investor.gov Structured Notes Investor Bulletin：<https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-76>
- FINRA Structured Notes 风险说明：<https://www.finra.org/investors/insights/structured-notes-principal-protection>
- ISDA 2002 Master Agreement 资料：<https://www.isda.org/book/2002-isda-master-agreement-mylibrary/>
- CFTC Uncleared Swaps Margin 规则入口：<https://www.cftc.gov/LawRegulation/FederalRegister/finalrules/2020-27508.html>

