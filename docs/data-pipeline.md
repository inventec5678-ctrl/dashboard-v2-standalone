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

---

## 每日維護

### 手動更新

若需立即更新最新資料，執行對應的 ingestion script：

```bash
# Crypto — 每日 03:00 UTC+8（建議 cron 自動化）
python3 scripts/ingest_crypto.py

# TWSE — 每日 04:00 UTC+8（TWSE 13:30 收盤後）
python3 scripts/ingest_twse.py

# US — 每日 04:30 UTC+8（美股 16:00 收盤後）
python3 scripts/ingest_us.py
```

支援 `--full`（全量回補）或 `--date YYYY-MM-DD`（指定日期）：

```bash
# 全量回補（2020-01 起）
python3 scripts/ingest_crypto.py --full

# 指定日期
python3 scripts/ingest_twse.py --date 2026-04-15
python3 scripts/ingest_us.py --date 2026-04-15
```

### 自動 Cron 設定

在 macOS/Linux 上編輯 crontab：

```bash
crontab -e
```

```cron
# Crypto — 每日 03:00 UTC+8
0 3 * * * cd /Users/changrunlin/.openclaw/workspace-luka/dashboard-v2-standalone && python3 scripts/ingest_crypto.py >> logs/ingest_crypto.log 2>&1

# TWSE — 每日 04:00 UTC+8（TWSE 13:30 收盤後）
0 4 * * * cd /Users/changrunlin/.openclaw/workspace-luka/dashboard-v2-standalone && python3 scripts/ingest_twse.py >> logs/ingest_twse.log 2>&1

# US — 每日 04:30 UTC+8（美股 16:00 收盤後）
30 4 * * * cd /Users/changrunlin/.openclaw/workspace-luka/dashboard-v2-standalone && python3 scripts/ingest_us.py >> logs/ingest_us.log 2>&1
```

> **確保 logs/ 目錄存在：** `mkdir -p /Users/changrunlin/.openclaw/workspace-luka/dashboard-v2-standalone/logs`

### 資料品質檢測

```bash
# 檢查所有市場
python3 scripts/data_quality_check.py --market all

# 檢查並自動修復發現的問題
python3 scripts/data_quality_check.py --market all --fix

# 只檢查特定市場
python3 scripts/data_quality_check.py --market crypto
python3 scripts/data_quality_check.py --market twse
python3 scripts/data_quality_check.py --market us
```

### 常見問題

**Q: K線不顯示怎麼辦？**
A: 先檢查 API 是否正常：
```bash
curl "http://localhost:5006/api/crypto/klines?symbol=BTCUSDT&interval=1d&limit=2"
curl "http://localhost:5006/api/twse/klines?stock=2330&interval=1d&limit=2"
curl "http://localhost:5006/api/us/klines/AAPL?interval=1d&limit=2"
```
若 API 回傳空陣列或錯誤，表示 parquet 資料尚未生成，需執行對應的 ingestion script。

**Q: 資料落後怎麼辦？**
A: 執行當日 ingestion script 更新資料：
```bash
python3 scripts/ingest_crypto.py
python3 scripts/ingest_twse.py
python3 scripts/ingest_us.py
```

**Q: Crypto 1mo 沒有資料？**
A: Binance Futures API 不支援月線，server.py 對 `1mo` 會回傳空陣列。建議使用 `1d` 資料在前端自己做月線聚合。

**Q: TWSE 即時行情（intraday）無效？**
A: TWSE `MI_5MINS` API 只在盤中（09:00–13:30）有效，盤後與週末無資料。

**Q: US 資料延遲？**
A: yfinance 延遲 15~20 分鐘，屬正常現象。若需真正即時，可評估 Alpaca API 取代。
