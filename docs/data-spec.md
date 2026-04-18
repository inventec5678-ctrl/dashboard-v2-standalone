# Data Specification — OHLCVUTC Schema

> 14 欄位統一 Schema，Index 為 UTC DatetimeIndex

---

## API 接入指南

### Server 啟動

```bash
cd /Users/changrunlin/.openclaw/workspace-luka/dashboard-v2-standalone
uvicorn server:app --host 0.0.0.0 --port 5006
```

### API Endpoints

| Method | Endpoint | 說明 | 必填參數 | 範例 |
|--------|----------|------|----------|------|
| GET | `/api/crypto/klines` | Crypto K線 | `symbol`, `interval` | `?symbol=BTCUSDT&interval=1d&limit=100` |
| GET | `/api/crypto/quote` | Crypto 即時報價 | `symbol` | `?symbol=BTCUSDT` |
| GET | `/api/twse/klines` | TWSE K線 | `stock`（代碼） | `?stock=2330&interval=1d` |
| GET | `/api/twse/intraday` | TWSE 即時分線 | `stock` | `?stock=2330` |
| GET | `/api/us/klines/{symbol}` | US K線 | path: `symbol` | `?interval=1d&limit=100` |
| GET | `/api/us/quote/{symbol}` | US 即時報價 | path: `symbol` | |

> **注意：** TWSE endpoint 參數名為 `stock`（股票代碼），其餘市場用 `symbol`。

### interval_key_map（server.py 解析邏輯）

| 前端傳入 | Parquet 檔案 key |
|----------|-----------------|
| `1d`, `D` | `1d` |
| `1h` | `1h` |
| `4h` | `4h` |
| `1wk`, `W` | `1wk` |
| `1mo`, `M` | `1mo` |
| `15m` | `15m` |

### Response Format（統一）

所有 K線 endpoint 回傳格式一致：

```json
{
  "symbol": "BTCUSDT",
  "interval": "1d",
  "data": [
    {
      "time": 1704067200,
      "open": 42000.5,
      "high": 42500.0,
      "low": 41800.0,
      "close": 42300.0,
      "volume": 1234567.89
    }
  ]
}
```

- `time`：Unix timestamp（秒），可直接餵入 LightCharts / Chart.js
- `volume`：float64，與調整後收盤價 `adj_close` 皆為浮點數
- TWSE/US parquet 1wk/1mo 資料從 local parquet 讀取；1d 另有 JSON fallback
- Binance 當前不支援 `1mo`（server.py 對 `1mo` 會 fallback 回空陣列）

### 前端呼叫方式（JavaScript）

```javascript
// 抓取 Crypto K線
const resp = await fetch(`/api/crypto/klines?symbol=BTCUSDT&interval=1h&limit=100`);
const json = await resp.json();
const klines = json.data; // array of OHLCV bars

// 餵入 LightCharts 或 Chart.js
klines.forEach(bar => ({
  time: bar.time,      // Unix timestamp（秒）
  open:  bar.open,
  high:  bar.high,
  low:   bar.low,
  close: bar.close,
  volume: bar.volume,
}));

// TWSE 股票
const twseResp = await fetch(`/api/twse/klines?stock=2330&interval=1d&limit=100`);
const twseJson = await twseResp.json();
twseJson.data.forEach(bar => { /* ... */ });

// US 股票
const usResp = await fetch(`/api/us/klines/AAPL?interval=1d&limit=100`);
const usJson = await usResp.json();
```

### 資料更新頻率

| 市場 | Timeframe | 更新時機（UTC+8） | 備註 |
|------|-----------|-------------------|------|
| Crypto | `1d` / `1w` / `1mo` | 每日 03:00 | 日結算後 |
| Crypto | `1h` / `4h` | 每小時 | — |
| Crypto | `15m` | 每15分鐘 | — |
| TWSE | `1d` / `1w` / `1mo` | 每日 04:00 | TWSE 13:30 收盤後 |
| TWSE | `intraday` | 盤中每分鐘 | TWSE `MI_5MINS` API |
| US | `1d` / `1w` / `1mo` | 每日 04:30 | 美股 16:00 收盤後 |

> 即時報價（`/api/crypto/quote`、`/api/us/quote/{symbol}`）：輪詢 Binance/US，無 WebSocket。

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
