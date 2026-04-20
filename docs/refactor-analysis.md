# Dashboard 重構評估報告
> 分析時間：2026-04-20

## 一、整體架構評分（1-10）

| 維度 | 分數 | 說明 |
|------|------|------|
| 結構清晰度 | 2/10 | 1,475 行 JS 集中在 6 個檔案，chart_market.js 達 400 行 |
| 程式碼品質 | 3/10 | 到處可見 `var`（chart_market.js 72 處），hybrid 架構 |
| 可維護性 | 2/10 | 53 個 HTML inline id，大量 window 全域變數 |
| 效能 | 5/10 | Cache 機制有做好，但切換市場時全部摧毀重建 |
| 擴展性 | 2/10 | 要加 MA/RSI/WebSocket，需要大改 |
| **總分** | **14/30** | |

---

## 二、是否應該重構？

**建議：方案 B（中重構）。**

分數 14/30 偏低，但不代表要全部重寫。核心原因是「架構模式本身還算合理」（ES Module + 分散模組 + backend API 分離），只是實作細節充滿修補痕跡。

- **不建議方案 C（全重寫）：** 功能基本正常，server.py 複雜，重寫風險高
- **不建議持續修補：** 繼續修補會讓技術債務指數成長
- **建議方案 B：** 保留 server.py，重新組織前端模組結構

---

## 三、現有問題清單

### 🔴 高優先

#### 1. HTML inline script vs ES Module 衝突
`dashboard_v2.html:320–394` 的 `clearPriceLines()`/`togglePriceLine()` 使用未宣告的 `candleSeries` 和 `chart`，與 `modal_strategy.js` 中的版本衝突。當用戶從策略 modal 點 MA/RSI，按鈕綁定 HTML inline 版，會指向錯誤的市場 chart instance。

#### 2. 全域命名空間污染 — 約 50+ window.* 變數
`window.currentCRYPTOTStock`、`window._chartCache`、`window._currentPriceLine` 等到處可見，沒有任何封裝。

#### 3. 變數命名不一致
- `currentCRYPTOTStock`（CamelCase，大寫 T：CRYPTO 的 T？）
- `currentTWSStock`（TWS 三字母 vs TWSE 四字母）
- `currentUSStock`（US 簡寫 vs CRYPTO 非簡寫）

#### 4. `switchMarket()` 是 God Function
整個 `market_switch.js` 是一個 490 行的 God Function，違反 SRP。tab 切換 + chart destroy + quote load + strategy load + sentiment reset + title update 全塞在一起。

#### 5. `chart_market.js` 是 400 行 God Module
職責：cache + quote + chart + render + symbol + switch 全混在一起，應該拆分為起碼 4 個模組。

---

### 🟡 中優先

- API response normalize 混亂（三層嵌套三元表達式）
- `api.js` 定義了但幾乎沒被使用
- `var` 泛濫（ES6+ 時代的技術債務）
- TWSE/US 分支邏輯幾乎完全重複
- 沒有任何測試覆蓋

---

## 四、重構方案

### 方案 A：微重構（只修技術債務，1-2天）
- `var` → `const`/`let`
- 刪除 HTML inline script 中的 `clearPriceLines`/`togglePriceLine`
- 統一 `window.*` 命名
- 抽取 TWSE/US 重複區塊成 helper

### 方案 B：中重構（拆分模組，5-7天）✅ 建議

目標架構：
```
static/js/
├── app.js              # 單一 entry point
├── state/store.js      # 單一狀態管理（取代 50+ window 變數）
├── services/
│   ├── cache.js       # 從 chart_market.js 抽出
│   └── api.js         # 統一 fetch 層（重寫）
├── charts/
│   ├── ChartManager.js # chart lifecycle
│   ├── QuoteRenderer.js # 報價/倒數更新
│   └── PriceLineLayer.js # MA/RSI/NOW 線（統一解決衝突）
├── markets/
│   ├── MarketSwitcher.js # 只做 tab 切換
│   ├── CryptoMarket.js
│   ├── TWSEMarket.js
│   └── USMarket.js
└── strategies/
    ├── StrategyService.js
    └── StrategyModal.js
```

### 方案 C：全重寫（2-3週）
React/Vue + TypeScript + Zustand/Pinia — 過度工程，風險極高，不建議。

---

## 五、重點建議

### Phase 1（立即，1天）：止血
1. 刪除 HTML inline `<script>` 中的 `clearPriceLines`/`togglePriceLine`，統一到 `modal_strategy.js`
2. 把 `switchMarket()` 中的 TWSE/US 重複區塊抽取成 `resetMarketUI(market)` helper

### Phase 2（短期，2-3天）：提升可測試性
1. 把 `chart_market.js` 的 cache 邏輯抽出成獨立的 `cache.js`
2. 把 `var` → `const`/`let`（chart_market.js 先處理）

### Phase 3（中期，5-7天）：架構重構
1. 建立 `Store` 類別，統一狀態管理
2. `chart_market.js` 拆分為 `ChartManager` + `QuoteRenderer` + `PriceLineLayer`
3. 重構 `switchMarket()` 只做 tab 切換
4. api.js 重寫為統一 fetch 層

---

## 六、詳細問題清單

| # | 嚴重性 | 檔案:行號 | 問題 |
|---|--------|-----------|------|
| 1 | 🔴 | `dashboard_v2.html:320–394` | HTML inline script 使用未宣告的全域變數，與 ES Module 衝突 |
| 2 | 🔴 | `dashboard.js:380–390` | 50+ window 全域變數，無封裝 |
| 3 | 🔴 | `dashboard.js:380–386` | 變數命名不一致 |
| 4 | 🔴 | `market_switch.js:1–490` | God Function `switchMarket()` |
| 5 | 🔴 | `chart_market.js:1–400` | 400 行 God Module |
| 6 | 🟡 | `chart_market.js` 全域 | API response normalize 混亂 |
| 7 | 🟡 | `api.js` | 定義了但沒被使用 |
| 8 | 🟡 | `strategies.js` + `chart_market.js` | `var` 泛濫 |
| 9 | 🟡 | `market_switch.js:295–370` | TWSE/US 分支重複 |
| 10 | 🟡 | 全域 | 零測試覆蓋 |
