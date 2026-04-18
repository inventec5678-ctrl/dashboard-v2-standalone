# Dashboard v2 Standalone

一個獨立的 FastAPI 服務，用於托管加密貨幣、 TWSE 和 US 股票 Dashboard。

## 目錄結構

```
dashboard_v2_standalone/
├── server.py              # FastAPI 服務主檔
├── dashboard_v2.html      # Dashboard 前端頁面
├── requirements.txt       # Python 依賴
├── run.sh                # 啟動腳本
├── scripts/              # 資料攝取腳本
│   ├── ingest_crypto.py  # Binance Futures OHLCV
│   ├── ingest_twse.py    # TWSE 個股日線
│   └── ingest_us.py      # US 股票（yfinance）
├── data/                 # Parquet 資料檔（進 Git）
│   └── ohlcvutc/
│       ├── crypto/       # 20 symbols × 6 timeframes
│       ├── twse/         # 59 stocks × 3 timeframes
│       └── us/           # 48 stocks × 3 timeframes
├── docs/                 # 文件
│   ├── data-pipeline.md  # 資料管線說明
│   └── data-spec.md      # Schema 規格
└── README.md
```

## 快速開始

### 1. 安裝依賴

```bash
pip install -r requirements.txt
```

### 2. 啟動服務

```bash
./run.sh
# 或手動啟動
python3 -m uvicorn server:app --host 0.0.0.0 --port 5006
```

### 3. 訪問 Dashboard

開啟瀏覽器：http://localhost:5006/dashboard_v2

## 資料管線

### 資料覆蓋

| 市場 | Symbols | Timeframes | 歷史起點 |
|------|---------|------------|---------|
| Crypto | 20 | 1d, 1w, 1mo（15m/1h/4h 待補） | 2020-01 |
| TWSE | 59 | 1d, 1w, 1mo | 2016-01 |
| US | 48 | 1d, 1w, 1mo | 2016-01 |

### 每日更新 Cron（UTC+8）

```crontab
# Crypto — 03:00
0 3 * * * cd /Users/changrunlin/.openclaw/workspace/dashboard_v2_standalone && python3 scripts/ingest_crypto.py >> logs/ingest_crypto.log 2>&1
# TWSE — 04:00
0 4 * * * cd /Users/changrunlin/.openclaw/workspace/dashboard_v2_standalone && python3 scripts/ingest_twse.py >> logs/ingest_twse.log 2>&1
# US — 04:30
30 4 * * * cd /Users/changrunlin/.openclaw/workspace/dashboard_v2_standalone && python3 scripts/ingest_us.py >> logs/ingest_us.log 2>&1
```

詳見 [docs/data-pipeline.md](docs/data-pipeline.md) 和 [docs/data-spec.md](docs/data-spec.md)。

## API 端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `/` | GET | 重定向到 `/dashboard_v2` |
| `/dashboard_v2` | GET | 返回 Dashboard HTML 頁面 |
| `/api/klines` | GET | 取得 Binance K 線資料 |
| `/api/strategies/all` | GET | 取得所有策略 |
| `/api/strategies/live` | GET | 取得活躍策略 |
| `/api/dashboard/anomalies` | GET | 取得異常資料 |

### `/api/klines` 參數

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| symbol | string | 是 | 交易對，如 `BTCUSDT` |
| interval | string | 是 | K 線週期，如 `1m`, `5m`, `1h`, `1d` |
| limit | int | 否 | 資料條數，預設 300 |

## 技術棧

- **後端**：FastAPI + Uvicorn
- **前端**：原生 HTML/CSS/JavaScript
- **資料源**：Binance API、TWSE Open API、yfinance

## 設定

預設埠號：`5006`

如需修改，編輯 `run.sh` 或使用命令列參數：

```bash
python3 -m uvicorn server:app --host 0.0.0.0 --port 8000
```
