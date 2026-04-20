# Dashboard 功能藍圖 — 成為下一個 TradingView
> 分析時間：2026-04-20

## 一、願景與定位

### 目標用戶
- 加密貨幣短線交易者（CRYPTO 市場、即時指標）
- 台股投資人（TWSE、在地化策略排行）
- 美股投資人（US 市場、機構級圖表）
- 進階交易者（指標、回測、繪圖工具）

### 核心價值主張
> 「三市場（Crypto/TWSE/US）一站式專業圖表平台，結合在地化策略排行與情緒指標」

---

## 二、功能缺口分析

### 已實現 ✅
- K線圖（三市場、6 TF）
- 多市場 Tab 切換
- 策略排行（5 排序維度）
- 情緒晶片（8 種指標）
- 價格/漲跌%/成交量顯示
- 倒數計時器 + 上次更新時間
- NOW 價格線
- 圖表快取（60秒）
- 策略詳情 Modal

### 缺失的核心功能 🔴

| 功能 | 優先順序 | 實現難度 | 價值 |
|------|---------|---------|------|
| 技術指標（MA/RSI/MACD）| P0 | 🟡 中 | 🔴🔴🔴 極高 |
| WebSocket 即時更新 | P0 | 🔴 高 | 🔴🔴🔴 極高 |
| 價格警報（Price Alert）| P0 | 🟡 中 | 🔴🔴🔴 極高 |

### 缺失的高階功能

| 功能 | 優先順序 | 實現難度 | 價值 |
|------|---------|---------|------|
| MACD + Bollinger Bands | P1 | 🟡 中 | 🔴🔴 高 |
| 繪圖工具（趨勢線/支撐壓力）| P1 | 🔴 高 | 🔴🔴 高 |
| Screener（市場掃描器）| P1 | 🟡 中 | 🔴🔴 高 |
| 觀察列表（Watchlist）| P1 | 🟡 中 | 🔴🔴 高 |
| 策略回測（Backtest）| P1 | 🔴 高 | 🔴🔴 高 |
| 資料匯出（CSV）| P2 | 🟢 低 | 🔴 中 |
| News Feed 整合 | P2 | 🟡 中 | 🔴 中 |
| Pine Script 指標腳本 | P2 | 🔴 極高 | 🔴🔴 高 |

---

## 三、功能優先順序

### P0 — 立即實作（1-2週）
1. **技術指標**（MA5/20/60 + RSI）— chart_market.js 已有 UI 入口，低垂果實
2. **價格警報** — localStorage 儲存，報價時比對
3. **WebSocket 即時更新** — Binance WebSocket 直接拉，60秒 → 毫秒級

### P1 — 短期目標（1個月）
4. MACD + Bollinger Bands
5. 繪圖工具（先做 Horizontal Line）
6. Screener（Server-side 計算 + 前端呈現）
7. 觀察列表（Watchlist + Sparkline）

### P2 — 中期目標（2-3個月）
8. 策略回測（Python Backend）
9. 自訂時間範圍
10. 資料匯出（CSV/Excel）
11. News Feed 整合

### P3 — 長期願景
12. 社群分享（Public Chart 連結）
13. 行動 App（iOS/Android）
14. API 開放平台

---

## 四、重點功能詳細說明

### 技術指標系統
- 計算方式：**Client-side**（MA/RSI/MACD 簡單，即時）
- 架構：Overlay series（MA/Bollinger 共享 K線 pane）+ 獨立 pane（RSI/MACD）
- lightweight-charts v5.0+ 原生支援 Pane API

### 即時更新架構
```
目前：60秒輪詢
目標：
├── CRYPTO → Binance WebSocket 直接拉（wss://stream.binance.com:9443/ws）
├── TWSE/US → Server-side WebSocket proxy（server.py）
└── Fallback：60秒 HTTP polling（斷線時）
```

### 策略回測系統
```
Python Backend：
├── 載入歷史 K線（3年）
├── 策略邏輯（MA Cross / RSI Mean Reversion）
└── 計算 equity curve + trade log + Win Rate/Sharpe/Max DD

API：GET /api/backtest?symbol=BTCUSDT&strategy=MA_CROSS&from=2023-01-01
```

---

## 五、技術需求對照

### 現有能力 ✅
- lightweight-charts ✅
- 三年完整歷史資料 ✅
- 三市場覆蓋 ✅
- server.py API ✅

### 需要建設
- WebSocket 代理（Binance/TWSE/US）
- 指標計算引擎（Client-side JS）
- 回測引擎（Python）
- Screener 查詢引擎

---

## 六、推薦開發順序

1. **MA5/20/60 + RSI** → 最基礎指標，UI 已有入口，1-2週完成
2. **Binance WebSocket** → 60秒 → 毫秒級，CRYPTO 直接受益
3. **價格警報** → localStorage + 每次報價比對
4. **MACD + Bollinger** → 指標系統完整化
5. **Screener** → Server-side 過濾，前端呈現
6. **Backtest Engine** → Python Backend