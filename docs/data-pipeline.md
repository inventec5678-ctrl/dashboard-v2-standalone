# Dashboard Data Pipeline

> 統一資料管線文件 — 維護者：luka agent

---

## 1. 目錄結構

```
dashboard_v2_standalone/
├── data/
│   └── ohlcvutc/
│       ├── crypto/          # 20 symbols × 6 timeframes
│       ├── twse/            # 59 stocks × 3 timeframes
│       └── us/              # 48 stocks × 3 timeframes
├── scripts/
│   ├── ingest_crypto.py     # Binance Futures OHLCV
│   ├── ingest_twse.py       # TWSE daily OHLCV
│   └── ingest_us.py        # US stocks via yfinance
├── docs/
│   ├── data-pipeline.md     # 本文件
│   └── data-spec.md         # Schema 規格文件
├── server.py               # FastAPI server（讀取 data/）
└── dashboard_v2.html       # Dashboard 前端
```

---

## 2. 資料覆蓋

### Crypto（20 symbols × 6 timeframes）

| Timeframe | 來源 | 歷史起點 | 更新頻率 |
|-----------|------|---------|---------|
| `15m` | Binance Futures | 待下載 | — |
| `1h`  | Binance Futures | 待下載 | — |
| `4h`  | Binance Futures | 待下載 | — |
| `1d`  | Binance Futures | 2020-01-01 | 每日 |
| `1w`  | Binance Futures | 2020-01-01 | 每日 |
| `1mo` | Binance Futures | 2020-01-01 | 每日 |

**Symbols：** ADAUSDT, APTUSDT, ARBUSDT, ATOMUSDT, AVAXUSDT, BNBUSDT, BTCUSDT, DOGEUSDT, DOTUSDT, ETCUSDT, ETHUSDT, LINKUSDT, LTCUSDT, MATICUSDT, NEARUSDT, OPUSDT, SOLUSDT, UNIUSDT, XLMUSDT, XRPUSDT

### TWSE（59 stocks × 3 timeframes）

| Timeframe | 來源 | 歷史起點 | 更新頻率 |
|-----------|------|---------|---------|
| `1d`  | TWSE API | 2016-01 | 每日（交易日） |
| `1w`  | TWSE API | 2016-01 | 每日（交易日） |
| `1mo` | TWSE API | 2016-01 | 每日（交易日） |

### US（48 stocks × 3 timeframes）

| Timeframe | 來源 | 歷史起點 | 更新頻率 |
|-----------|------|---------|---------|
| `1d`  | yfinance | 2016-01 | 每日（交易日） |
| `1w`  | yfinance | 2016-01 | 每日（交易日） |
| `1mo` | yfinance | 2016-01 | 每日（交易日） |

---

## 3. Ingestion Scripts 使用方式

### Crypto

```bash
# 增量更新（昨日資料）
python3 scripts/ingest_crypto.py

# 全量回補（2020-01 起）
python3 scripts/ingest_crypto.py --full

# 指定日期
python3 scripts/ingest_crypto.py --date 2026-04-15
```

### TWSE

```bash
# 增量更新（最新交易日）
python3 scripts/ingest_twse.py

# 全量回補（2010 起）
python3 scripts/ingest_twse.py --full

# 指定日期
python3 scripts/ingest_twse.py --date 2026-04-15
```

### US

```bash
# 增量更新（最近交易日）
python3 scripts/ingest_us.py

# 全量回補（2010 起）
python3 scripts/ingest_us.py --full

# 指定日期
python3 scripts/ingest_us.py --date 2026-04-15
```

---

## 4. 每日 Cron 設定（UTC+8）

```crontab
# Crypto — 每日 03:00 UTC+8
0 3 * * * cd /Users/changrunlin/.openclaw/workspace/dashboard_v2_standalone && python3 scripts/ingest_crypto.py >> logs/ingest_crypto.log 2>&1

# TWSE — 每日 04:00 UTC+8（TWSE 13:30 收盤後）
0 4 * * * cd /Users/changrunlin/.openclaw/workspace/dashboard_v2_standalone && python3 scripts/ingest_twse.py >> logs/ingest_twse.log 2>&1

# US — 每日 04:30 UTC+8（美股 16:00 收盤後）
30 4 * * * cd /Users/changrunlin/.openclaw/workspace/dashboard_v2_standalone && python3 scripts/ingest_us.py >> logs/ingest_us.log 2>&1
```

Logs 目錄：`dashboard_v2_standalone/logs/`

---

## 5. Real-time 資料方案

### Crypto
- **建議：** Binance WebSocket（`wss://stream.binance.com:9443/ws/{symbol}@kline_{interval}`）+ 本地 parquet 每 5min flush
- **替代：** REST polling 每 60s（非真正 real-time）

### TWSE
- 現有 `/api/twse/intraday` 串接 TWSE `MI_5MINS` 即時 API（盤中有效）
- 日終寫入 parquet 1d

### US
- yfinance 延遲 15~20 分鐘
- 建議評估 Alpaca（免費，支援美股 WebSocket）取代

---

## 6. 檔案命名規範

`{SYMBOL}__{TIMEFRAME}.parquet`（雙底線 `__` 區隔）

Example：
- `BTCUSDT__1d.parquet`
- `2330__1w.parquet`
- `AAPL__1mo.parquet`

> ⚠️ 目前資料庫中仍有舊命名格式 `{SYMBOL}_{TIMEFRAME}.parquet`（單底線），server.py 已相容兩種格式。
