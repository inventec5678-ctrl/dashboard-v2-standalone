# Dashboard V2 Standalone

一個獨立的 FastAPI 服務，托管加密貨幣（Crypto）、台灣證券交易所（TWSE）及美股（US）行情 Dashboard。透過統一的 14 欄 Parquet 資料格式，提供 K 線查詢、策略管理與異常檢測功能。

---

## 概述

本專案從多個資料源（Binance Futures、TWSE Open API、yfinance）攝取 OHLCV 資料，儲存為 UTC 時區的 Parquet 檔案，並透過 FastAPI 提供 REST API 供前端取用。所有資料以 `data/ohlcvutc/{market}/{SYMBOL}__{TIMEFRAME}.parquet` 格式組織。

- **後端**：FastAPI + Uvicorn（port 5006）
- **前端**：純 HTML/CSS/JavaScript（無框架依賴）
- **資料格式**：14 欄 Parquet（UTC DatetimeIndex）
- **支援市場**：Crypto（20 symbols）、TWSE（59 stocks）、US（48 stocks）

---

## 🚀 快速接入

### 1. 啟動 Server

```bash
cd /Users/changrunlin/.openclaw/workspace-luka/dashboard-v2-standalone
uvicorn server:app --host 0.0.0.0 --port 5006
```

### 2. 開啟 Dashboard

```
http://localhost:5006/dashboard_v2
```

### 3. 替換 / 新增 Symbol

編輯 `static/js/modules/chart_market.js` 中的以下常數：

```javascript
const TOP20_CRYPTO = ["BTCUSDT", "ETHUSDT", ...];   // Crypto symbols
const TWSE_SYMBOLS = ["2330", "0050", ...];         // TWSE 股票代碼
const US_SYMBOLS   = ["AAPL", "MSFT", ...];          // US stock tickers
```

> TWSE 代碼可在 [`data/symbols.py`](data/symbols.py) 找到完整清單。

### 4. 確認 timeframe 支援

`server.py` 的 `interval_key_map` 已支援以下 timeframe：

| 輸入 | Parquet key | 說明 |
|------|-------------|------|
| `1d`, `D` | `1d` | 日線 ✅ |
| `1h` | `1h` | 小時線 ✅ |
| `4h` | `4h` | 4小時線 ✅ |
| `1wk`, `W` | `1wk` | 週線 ✅ |
| `1mo`, `M` | `1mo` | 月線 ⚠️（Binance 不支援） |
| `15m` | `15m` | 15分線（需先下載歷史） |

若需新增 timeframe，需同步更新 `server.py` 的 `interval_key_map` 並執行對應的 ingestion script。

### 5. 自訂資料路徑

```python
# server.py 頂部，預設值：
DATA_DIR = "/Users/changrunlin/.openclaw/workspace/crypto-agent-platform/data"
```

直接修改 `DATA_DIR` 或透過環境變數覆寫即可使用不同資料目錄。

---

## 快速開始

### 1. 安裝依賴

```bash
cd dashboard-v2-standalone
pip install -r requirements.txt
```

`requirements.txt` 內容：
```
fastapi
uvicorn
httpx
pandas
```

### 2. 啟動服務

```bash
./run.sh
```

或手動啟動：

```bash
uvicorn server:app --host 0.0.0.0 --port 5006
```

### 3. 開啟瀏覽器

```
http://localhost:5006/dashboard_v2
```

---

## 專案結構

```
dashboard_v2_standalone/
├── server.py                    # FastAPI 主應用（port 5006）
├── dashboard_v2.html            # Dashboard 前端頁面（單一 HTML 檔）
├── requirements.txt             # Python 依賴
├── run.sh                       # 啟動腳本（一鍵安裝 + 啟動）
├── download_crypto_15m.py       # 一次性 15m 歷史資料下載工具
├── data/                        # Parquet 資料檔（進 Git）
│   ├── symbols.py               # Symbol 清單（TOP20_CRYPTO, TOP50_TWSE）
│   └── ohlcvutc/
│       ├── crypto/              # 20 symbols × 7 timeframes（15m/1h/4h/1d/1w/1mo）
│       ├── twse/                # 59 stocks × 3 timeframes（1d/1w/1mo）
│       └── us/                  # 48 stocks × 3 timeframes（1d/1w/1mo）
├── scripts/                     # 每日資料攝取腳本
│   ├── ingest_crypto.py         # Binance Futures OHLCV 攝取
│   ├── ingest_twse.py           # TWSE 個股日線攝取
│   ├── ingest_us.py             # US 股票（yfinance）攝取
│   └── data_quality_check.py    # 資料品質檢測與自動修復
├── docs/                        # 文件
│   ├── data-pipeline.md         # 資料管線詳細說明
│   └── data-spec.md             # Schema 規格與已知問題
└── static/                      # 靜態資源
    ├── css/
    │   └── dashboard.css        # Dashboard 樣式
    └── js/
        ├── dashboard.js         # Dashboard 主邏輯
        ├── api.js               # （已棄用，見 modules/api.js）
        ├── main.js              # （已棄用）
        └── modules/
            ├── api.js           # API 呼叫封裝
            ├── chart_market.js  # 圖表與市場模組
            ├── market_switch.js # 市場切換邏輯
            ├── modal_strategy.js # 策略彈窗
            ├── sentiment.js     # 情緒指標
            └── strategies.js    # 策略相關邏輯
        └── utils/
            ├── formatters.js    # 數字/日期格式化工具
            └── dom-helpers.js   # DOM 操作輔助函式
```

### 主要檔案說明

| 檔案 | 用途 |
|------|------|
| `server.py` | FastAPI 應用，處理所有 API 路由與靜態檔案服務 |
| `dashboard_v2.html` | Dashboard 前端（18KB，單一 HTML，含全部 JS/CSS） |
| `requirements.txt` | Python 依賴（fastapi, uvicorn, httpx, pandas） |
| `run.sh` | 啟動腳本，自動安裝依賴後啟動 uvicorn |
| `download_crypto_15m.py` | 一次性腳本，下載 Binance 15m 完整歷史資料 |
| `data/symbols.py` | 各市場 symbol 清單（TOP20_CRYPTO, TOP50_TWSE, US stocks） |
| `scripts/data_quality_check.py` | 檢測並修復 Parquet 檔案的資料品質問題 |

---

## 資料說明

### 支援市場

| 市場 | Symbols | Timeframes | 資料來源 | 歷史起點 |
|------|---------|------------|---------|---------|
| **Crypto** | 20（BTC, ETH, SOL, BNB 等） | 15m, 1h, 4h, 1d, 1w, 1mo | Binance Futures（ccxt） | 2020-01（1d 以上） |
| **TWSE** | 59（2330, 0050 等台股） | 1d, 1w, 1mo | TWSE Open API | 2016-01 |
| **US** | 48（AAPL, MSFT 等） | 1d, 1w, 1mo | yfinance | 2016-01 |

> ⚠️ Crypto 的 15m / 1h / 4h 目前尚未下載完整歷史，請見 `docs/data-spec.md`。

**Crypto Symbols（20個）：**
ADAUSDT, APTUSDT, ARBUSDT, ATOMUSDT, AVAXUSDT, BNBUSDT, BTCUSDT, DOGEUSDT, DOTUSDT, ETCUSDT, ETHUSDT, LINKUSDT, LTCUSDT, MATICUSDT, NEARUSDT, OPUSDT, SOLUSDT, UNIUSDT, XLMUSDT, XRPUSDT

### 資料儲存位置

```
data/ohlcvutc/{market}/{SYMBOL}__{TIMEFRAME}.parquet
```

Example：
- `data/ohlcvutc/crypto/BTCUSDT__1d.parquet`
- `data/ohlcvutc/twse/2330__1w.parquet`
- `data/ohlcvutc/us/AAPL__1mo.parquet`

> 📝 檔案命名使用雙底線 `__` 區隔 symbol 與 timeframe。server.py 已相容舊格式單底線 `_`。

### Schema（14欄）

所有 Parquet 檔案皆使用統一的 14 欄 Schema，Index 為 UTC DatetimeIndex（name=`timestamp`）：

| 欄位 | 類型 | 說明 |
|------|------|------|
| `open` | float64 | 開盤價 |
| `high` | float64 | 最高價 |
| `low` | float64 | 最低價 |
| `close` | float64 | 收盤價 |
| `volume` | float64 | 成交量（各市場已統一為 float64） |
| `adj_close` | float64 | 調整後收盤價 |
| `dividends` | float64 | 股息（TWSE/Crypto 為 0.0） |
| `stock_splits` | float64 | 股票分割（TWSE/Crypto 為 0.0） |
| `market` | string | 市場別：`"crypto"` / `"twse"` / `"us"` |
| `symbol` | string | 交易代碼 |
| `currency` | string | 計價幣別：`"USDT"` / `"TWD"` / `"USD"` |
| `timeframe` | string | 週期：`"15m"` / `"1h"` / `"4h"` / `"1d"` / `"1w"` / `"1mo"` |
| `source` | string | 來源：`"binance"` / `"twse"` / `"yfinance"` |
| `fetched_at` | datetime64[us, UTC] | 資料抓取時間 |

詳見 [`docs/data-spec.md`](docs/data-spec.md)。

---

## API Endpoints

### 主頁

| Endpoint | 方法 | 說明 |
|----------|------|------|
| `/` | GET | 301 重定向到 `/dashboard_v2` |
| `/dashboard_v2` | GET | 返回 Dashboard HTML 頁面 |

### Symbol 查詢

| Endpoint | 方法 | 說明 |
|----------|------|------|
| `/api/symbols/crypto` | GET | 回傳 20 個 Crypto symbols（含 display name） |
| `/api/symbols/twse` | GET | 回傳 59 個 TWSE 股票（code + name） |

### Crypto K線

| Endpoint | 方法 | 說明 |
|----------|------|------|
| `/api/crypto/list` | GET | 回傳 20 個 symbol 清單（純字串列表） |
| `/api/crypto/klines` | GET | 取得 Crypto K 線資料（見下方參數） |

**`/api/crypto/klines` 參數：**

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `symbol` | string | 是 | 交易對，如 `BTCUSDT` |
| `interval` | string | 是 | 週期，如 `1m`, `5m`, `15m`, `1h`, `4h`, `1d`, `1w`, `1mo` |
| `limit` | int | 否 | 資料筆數上限，預設 300 |

### TWSE K線

| Endpoint | 方法 | 說明 |
|----------|------|------|
| `/api/twse/klines` | GET | 取得 TWSE K 線資料 |

**`/api/twse/klines` 參數：**

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `symbol` | string | 是 | 股票代碼，如 `2330` |
| `interval` | string | 否 | 週期，預設 `1d`（支援 `1d`, `1w`, `1mo`） |
| `limit` | int | 否 | 資料筆數上限，預設 300 |

### US K線

| Endpoint | 方法 | 說明 |
|----------|------|------|
| `/api/us/klines/{symbol}` | GET | 取得 US 股票 K 線資料 |

**路徑參數：** `symbol` — 如 `AAPL`

**Query 參數：**

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `interval` | string | 否 | 週期，預設 `1d`（支援 `1d`, `1w`, `1mo`） |
| `limit` | int | 否 | 資料筆數上限，預設 300 |

### 策略相關

| Endpoint | 方法 | 說明 |
|----------|------|------|
| `/api/strategies/all` | GET | 回傳所有策略 |
| `/api/strategies/live` | GET | 回傳活躍策略 |

### 異常檢測

| Endpoint | 方法 | 說明 |
|----------|------|------|
| `/api/dashboard/anomalies` | GET | 回傳異常資料清單 |

---

## 開發

### 安裝依賴

```bash
pip install -r requirements.txt
```

如需額外依賴（如 `ccxt` 用於 Crypto 攝取、`yfinance` 用於 US 資料）：

```bash
pip install ccxt yfinance pyarrow
```

### 每日資料更新

```bash
# Crypto — 每日 03:00 UTC+8（建議 cron 自動化）
python scripts/ingest_crypto.py

# TWSE — 每日 04:00 UTC+8（TWSE 13:30 收盤後）
python scripts/ingest_twse.py

# US — 每日 04:30 UTC+8（美股 16:00 收盤後）
python scripts/ingest_us.py
```

支援一次性全量回補（`--full`）或指定日期（`--date YYYY-MM-DD`）：

```bash
# 全量回補（2020-01 起）
python scripts/ingest_crypto.py --full

# 指定日期
python scripts/ingest_twse.py --date 2026-04-15
```

### 資料品質檢測

```bash
# 檢查所有市場
python scripts/data_quality_check.py --market all

# 自動修復發現的問題
python scripts/data_quality_check.py --market all --fix

# 只檢查特定市場
python scripts/data_quality_check.py --market crypto
python scripts/data_quality_check.py --market twse
python scripts/data_quality_check.py --market us
```

### 一次性下載 Crypto 15m 歷史

```bash
python download_crypto_15m.py
```

> ⚠️ 此腳本用於一次性補完 15m 資料，執行時間較長。

### 設定自訂資料目錄

server.py 預設使用：
```python
DATA_DIR = "/Users/changrunlin/.openclaw/workspace/crypto-agent-platform/data"
```

如需變更，可在環境變數或直接修改 `server.py` 頂部的 `DATA_DIR` 常數。

---

## Cron 每日自動更新設定（UTC+8）

```crontab
# Crypto — 每日 03:00 UTC+8
0 3 * * * cd /Users/changrunlin/.openclaw/workspace/dashboard_v2_standalone && python3 scripts/ingest_crypto.py >> logs/ingest_crypto.log 2>&1

# TWSE — 每日 04:00 UTC+8（TWSE 13:30 收盤後）
0 4 * * * cd /Users/changrunlin/.openclaw/workspace/dashboard_v2_standalone && python3 scripts/ingest_twse.py >> logs/ingest_twse.log 2>&1

# US — 每日 04:30 UTC+8（美股 16:00 收盤後）
30 4 * * * cd /Users/changrunlin/.openclaw/workspace/dashboard_v2_standalone && python3 scripts/ingest_us.py >> logs/ingest_us.log 2>&1
```

Logs 目錄：`dashboard_v2_standalone/logs/`（需手動建立）

---

## 文件

- [資料管線](docs/data-pipeline.md) — 詳細攝取流程、資料覆蓋範圍、cron 設定
- [資料規格](docs/data-spec.md) — 14 欄 Schema、各市場欄位差異、已知問題

---

## 貢獻方式

1. Fork 本專案
2. 建立功能分支 `git checkout -b feature/your-feature`
3. 提交變更 `git commit -m 'Add some feature'`
4. Push 到分支 `git push origin feature/your-feature`
5. 開啟 Pull Request

若有問題或建議，歡迎開 GitHub Issue。

---

## 技術棧

- **後端**：FastAPI + Uvicorn
- **前端**：原生 HTML / CSS / JavaScript（無框架）
- **資料源**：Binance API（ccxt）、TWSE Open API、yfinance
- **資料格式**：Parquet（pyarrow）