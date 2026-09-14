from AlgorithmImports import *
from datetime import date
import json


class AlphaRadarAlgorithm(QCAlgorithm):
    """
    Alpha Radar V1.8 research/paper engine.

    Scope:
    - Selects the 10 most active liquid US equities by daily dollar volume.
    - Computes SMA20/50/200, RSI14, MACD(12,26,9), ATR14 and intraday RVOL.
    - Scans US listed equity/ETF option chains, preferring 0DTE before 7-45 DTE.
    - Filters for premium <= $100/contract and tight quoted spreads.
    - Publishes JSON to the LEAN Object Store for the web adapter.
    - Never submits an order. Paper validation must come first.
    """

    TOP_COUNT = 10
    MIN_STOCK_PRICE = 5.0
    MAX_OPTION_ASK = 1.00
    MAX_SPREAD_PCT = 0.10
    MIN_OPEN_INTEREST = 100
    MIN_OPTION_VOLUME = 20
    MAX_OPEN_POSITIONS = 2
    A_PLUS_SCORE = 17

    def initialize(self):
        self.set_start_date(2025, 1, 1)
        self.set_cash(4700)
        self.set_time_zone("America/New_York")
        self.universe_settings.resolution = Resolution.MINUTE
        self.universe_settings.data_normalization_mode = DataNormalizationMode.RAW
        self.universe_settings.minimum_time_in_universe = timedelta(days=1)

        self.automatic_order_submission = False
        self._top10 = []
        self._states = {}
        self._option_roots = {}
        self._latest_option_picks = {}
        self._last_publish_date = None

        self._benchmark = self.add_equity("SPY", Resolution.MINUTE).symbol
        self.set_benchmark(self._benchmark)
        self.add_universe(self._select_top10_by_dollar_volume)
        self.set_warm_up(210, Resolution.DAILY)

        self.schedule.on(
            self.date_rules.every_day(self._benchmark),
            self.time_rules.after_market_open(self._benchmark, 35),
            self._publish_radar
        )

    def _select_top10_by_dollar_volume(self, coarse):
        eligible = [
            item for item in coarse
            if item.has_fundamental_data
            and item.price >= self.MIN_STOCK_PRICE
            and item.dollar_volume > 0
        ]
        ranked = sorted(eligible, key=lambda item: item.dollar_volume, reverse=True)
        self._top10 = [item.symbol for item in ranked[:self.TOP_COUNT]]
        return self._top10

    def on_securities_changed(self, changes):
        for security in changes.added_securities:
            symbol = security.symbol
            if security.type != SecurityType.EQUITY or symbol not in self._top10:
                continue

            if symbol not in self._states:
                self._states[symbol] = {
                    "sma20": self.sma(symbol, 20, Resolution.DAILY),
                    "sma50": self.sma(symbol, 50, Resolution.DAILY),
                    "sma200": self.sma(symbol, 200, Resolution.DAILY),
                    "rsi14": self.rsi(symbol, 14, MovingAverageType.WILDERS, Resolution.DAILY),
                    "macd": self.macd(symbol, 12, 26, 9, MovingAverageType.EXPONENTIAL, Resolution.DAILY),
                    "atr14": self.atr(symbol, 14, MovingAverageType.WILDERS, Resolution.DAILY),
                    "volume_sma20": self.sma(symbol, 20, Resolution.DAILY, Field.VOLUME),
                    "day": None,
                    "day_volume": 0.0
                }

            if symbol not in self._option_roots:
                option = self.add_option(symbol.value, Resolution.MINUTE)
                option.set_filter(
                    lambda universe: universe
                    .include_weeklys()
                    .strikes(-6, 6)
                    .expiration(0, 45)
                )
                self._option_roots[symbol] = option.symbol

    def on_data(self, slice):
        for symbol in self._top10:
            bar = slice.bars.get(symbol)
            state = self._states.get(symbol)
            if bar is None or state is None:
                continue
            if state["day"] != self.time.date():
                state["day"] = self.time.date()
                state["day_volume"] = 0.0
            state["day_volume"] += float(bar.volume)

        for canonical, chain in slice.option_chains.items():
            underlying = getattr(canonical, "underlying", None)
            if underlying not in self._top10:
                continue
            direction = self._direction(underlying)
            if direction is None:
                continue
            pick = self._pick_contract(list(chain), direction)
            if pick is not None:
                self._latest_option_picks[underlying] = pick

    def _indicator_values(self, symbol):
        state = self._states.get(symbol)
        if state is None:
            return None
        indicators = [
            state["sma20"], state["sma50"], state["sma200"],
            state["rsi14"], state["macd"], state["atr14"], state["volume_sma20"]
        ]
        if not all(indicator.is_ready for indicator in indicators):
            return None

        price = float(self.securities[symbol].price)
        average_volume = float(state["volume_sma20"].current.value)
        minutes = max(1, min(390, self.time.hour * 60 + self.time.minute - 570))
        expected_volume = average_volume * minutes / 390.0
        rvol = state["day_volume"] / expected_volume if expected_volume > 0 else 0.0

        return {
            "price": price,
            "sma20": float(state["sma20"].current.value),
            "sma50": float(state["sma50"].current.value),
            "sma200": float(state["sma200"].current.value),
            "rsi14": float(state["rsi14"].current.value),
            "macd": float(state["macd"].current.value),
            "macd_signal": float(state["macd"].signal.current.value),
            "macd_hist": float(state["macd"].histogram.current.value),
            "atr14": float(state["atr14"].current.value),
            "rvol": float(rvol),
            "volume": float(state["day_volume"])
        }

    def _direction(self, symbol):
        values = self._indicator_values(symbol)
        if values is None:
            return None
        bullish = (
            values["price"] > values["sma20"] > values["sma50"]
            and values["macd"] > values["macd_signal"]
            and 52 <= values["rsi14"] <= 70
            and values["rvol"] >= 1.2
        )
        bearish = (
            values["price"] < values["sma20"] < values["sma50"]
            and values["macd"] < values["macd_signal"]
            and 30 <= values["rsi14"] <= 48
            and values["rvol"] >= 1.2
        )
        if bullish:
            return "CALL"
        if bearish:
            return "PUT"
        return None

    def _technical_score(self, values, direction):
        call = direction == "CALL"
        score = 0
        trend_ok = (
            values["price"] > values["sma20"] > values["sma50"] > values["sma200"]
            if call else
            values["price"] < values["sma20"] < values["sma50"] < values["sma200"]
        )
        momentum_ok = values["macd"] > values["macd_signal"] if call else values["macd"] < values["macd_signal"]
        rsi_ok = 52 <= values["rsi14"] <= 70 if call else 30 <= values["rsi14"] <= 48
        atr_pct = values["atr14"] / values["price"] if values["price"] > 0 else 0

        score += 4 if trend_ok else 0
        score += 4 if momentum_ok else 0
        score += 4 if rsi_ok else 0
        score += 4 if values["rvol"] >= 1.5 else 2 if values["rvol"] >= 1.2 else 0
        score += 4 if 0.02 <= atr_pct <= 0.07 else 2 if 0.012 <= atr_pct <= 0.10 else 0
        return score

    def _pick_contract(self, contracts, direction):
        right = OptionRight.CALL if direction == "CALL" else OptionRight.PUT
        today = self.time.date()
        liquid = []

        for contract in contracts:
            dte = (contract.expiry.date() - today).days
            if dte < 0 or dte > 45 or contract.right != right:
                continue

            bid = float(contract.bid_price)
            ask = float(contract.ask_price)
            if bid <= 0 or ask <= 0 or ask > self.MAX_OPTION_ASK:
                continue

            mid = (bid + ask) / 2.0
            spread_pct = (ask - bid) / mid if mid > 0 else 99.0
            volume = float(contract.volume)
            open_interest = float(contract.open_interest)
            if (
                spread_pct > self.MAX_SPREAD_PCT
                or volume < self.MIN_OPTION_VOLUME
                or open_interest < self.MIN_OPEN_INTEREST
            ):
                continue

            delta = abs(float(contract.greeks.delta))
            mode = "0DTE" if dte == 0 else "SWING"
            target_delta = 0.40 if mode == "0DTE" else 0.55
            rank = (
                0 if mode == "0DTE" else 1,
                abs(delta - target_delta),
                spread_pct,
                -volume,
                -open_interest
            )
            liquid.append((rank, contract, dte, spread_pct, delta, mode))

        if not liquid:
            return None

        _, contract, dte, spread_pct, delta, mode = min(liquid, key=lambda item: item[0])
        return {
            "symbol": str(contract.symbol),
            "type": direction,
            "mode": mode,
            "expiration": contract.expiry.strftime("%Y-%m-%d"),
            "dte": dte,
            "strike": float(contract.strike),
            "bid": float(contract.bid_price),
            "ask": float(contract.ask_price),
            "cost": round(float(contract.ask_price) * 100, 2),
            "spread_pct": round(spread_pct * 100, 2),
            "delta": round(delta, 3),
            "volume": float(contract.volume),
            "open_interest": float(contract.open_interest)
        }

    def _publish_radar(self):
        if self.is_warming_up:
            return

        rows = []
        for symbol in self._top10:
            values = self._indicator_values(symbol)
            if values is None:
                continue

            direction = self._direction(symbol)
            score = self._technical_score(values, direction or "CALL")
            atr = values["atr14"]
            entry = stop = target = None
            if direction == "CALL":
                entry = values["price"] + 0.10 * atr
                stop = values["price"] - atr
                target = values["price"] + 2.0 * atr
            elif direction == "PUT":
                entry = values["price"] - 0.10 * atr
                stop = values["price"] + atr
                target = values["price"] - 2.0 * atr

            option = self._latest_option_picks.get(symbol)
            actionable = score >= self.A_PLUS_SCORE and direction is not None and option is not None
            rows.append({
                "ticker": symbol.value,
                "price": round(values["price"], 2),
                "volume": round(values["volume"]),
                "dollar_volume": round(values["price"] * values["volume"], 2),
                "ma20": round(values["sma20"], 2),
                "ma50": round(values["sma50"], 2),
                "ma200": round(values["sma200"], 2),
                "rsi14": round(values["rsi14"], 2),
                "macd": round(values["macd"], 4),
                "macdSignal": round(values["macd_signal"], 4),
                "macdHist": round(values["macd_hist"], 4),
                "atr14": round(values["atr14"], 2),
                "relVolume": round(values["rvol"], 2),
                "technical": score,
                "direction": direction,
                "entry": round(entry, 2) if entry is not None else None,
                "stop": round(stop, 2) if stop is not None else None,
                "target": round(target, 2) if target is not None else None,
                "option": option if actionable else None,
                "status": "A+ ALERT" if actionable else "WAIT"
            })

            if actionable:
                self.debug(f"{symbol.value}: A+ alert only; no order submitted")

        rows.sort(key=lambda row: row["dollar_volume"], reverse=True)
        payload = {
            "version": "1.8.0",
            "engine": "QuantConnect LEAN",
            "mode": "RESEARCH_PAPER_ONLY",
            "asof": self.time.isoformat(),
            "top_count": self.TOP_COUNT,
            "max_open_positions": self.MAX_OPEN_POSITIONS,
            "rows": rows[:self.TOP_COUNT]
        }
        self.object_store.save("alpha-radar/top10.json", json.dumps(payload, ensure_ascii=False))
        self._last_publish_date = date.today()
