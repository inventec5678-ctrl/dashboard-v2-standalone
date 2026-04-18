# Data Specification — OHLCVUTC Schema

> 14 欄位統一 Schema，Index 為 UTC DatetimeIndex

---

## 1. 完整 Schema（14 欄）

```python
SCHEMA = {
    "open":          "float64",   # 開盤價
    "high":          "float64",   # 最高價
    "low":           "float64",   # 最低價
    "close":         "float64",   # 收盤價
    "volume":        "float64",   # 成交量（統一 float64）
    "adj_close":     "float64",   # 調整後收盤價
    "dividends":     "float64",   # 股息
    "stock_splits":  "float64",   # 股票分割
    "market":        "string",    # "crypto" | "twse" | "us"
    "symbol":        "string",    # 交易代碼
    "currency":      "string",    # "USDT" | "TWD" | "USD"
    "timeframe":     "string",    # "1d" | "1h" | "4h" | "1w" | "1mo" | "15m"
    "source":        "string",    # "binance" | "twse" | "yfinance"
    "fetched_at":    "datetime64[us, UTC]",  # 資料抓取時間
}
# Index: DatetimeIndex (name="timestamp", tz=UTC)
```

---

## 2. 各市場欄位差異對照

| 欄位 | Crypto | TWSE | US | 備註 |
|------|--------|------|-----|------|
| `open/high/low/close` | float64 ✅ | float64 ✅ | float64 ✅ | 一致 |
| `volume` | **float64** | **int64** ⚠️ | **int64** ⚠️ | 需統一 |
| `adj_close` | float64 | float64 | float64 | 一致 |
| `dividends` | 0.0 | 0.0 | float64 | US 有真實值 |
| `stock_splits` | 0.0 | 0.0 | float64 | US 有真實值 |
| Index (tz) | UTC ✅ | UTC ✅ | UTC ✅ | 一致 |

---

## 3. 檔案命名規範

**格式：** `{SYMBOL}__{TIMEFRAME}.parquet`（雙底線 `__`）

| 市場 | Symbol 範例 | Timeframe 選項 |
|------|------------|----------------|
| Crypto | `BTCUSDT`, `ETHUSDT` | `15m`, `1h`, `4h`, `1d`, `1w`, `1mo` |
| TWSE | `2330`, `0050` | `1d`, `1w`, `1mo` |
| US | `AAPL`, `MSFT` | `1d`, `1w`, `1mo` |

Example：`BTCUSDT__1d.parquet`、`2330__1w.parquet`、`AAPL__1mo.parquet`

---

## 4. API Endpoint 對照

| 市場 | 抓取方式 | Endpoint/工具 |
|------|---------|--------------|
| Crypto | ccxt → Binance Futures | `ccxt.binance().fetch_ohlcv()` |
| TWSE | TWSE Open API | `https://openapi.twse.com.tw/v1/exchangeReport/MI_5MINS_H` |
| US | yfinance | `yf.Ticker(symbol).history()` |

---

## 5. 已知問題與待處理

- [ ] Crypto `1h`/`4h`/`15m` 尚未下載完整歷史（目前為垃圾資料）
- [ ] TWSE/US `volume` 型別為 `int64`，應統一為 `float64`
- [ ] TWSE/US `dividends`/`stock_splits` 均為 0.0（非即時更新）
- [ ] 尚未建立每日 cron 自動更新機制
- [ ] Crypto 無真正 real-time（建議接 Binance WebSocket）
