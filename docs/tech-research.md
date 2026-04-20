# Dashboard 重構技術研究報告
> 分析時間：2026-04-20

## 一、TradingView 架構分析

### 1.1 使用的技術
- TradingView 前端是**完全自研框架**，不是 React/Vue/Angular
- 圖表引擎使用 **HTML5 Canvas** 直接渲染，繞過 virtual DOM
- lightweight-charts 是 TradingView 將內部圖表引擎**開源簡化版**，同樣使用 Canvas

### 1.2 即時資料流
- Diff 演算法：只更新變化的蠟燭，不重繪整個 K線
- Canvas 直接操作：不經 DOM/Virtual DOM
- 訂閱制的資料流：組件只訂閱自己需要的資料 slice

### 1.3 效能優化
- TradingView 主站：Canvas 直繪 + 自研框架
- lightweight-charts：Canvas 直繪，體積極小（壓縮後約 45KB）
- `series.update()` 只更新最後一根 K線，O(1) 複雜度

---

## 二、技術選型矩陣

| 維度 | Vanilla JS | React 18 | Vue 3 | Svelte | SolidJS |
|------|------------|----------|-------|--------|---------|
| 學習曲線 | 低 | 中 | 中低 | 低 | 中 |
| 執行期效能 | 高 | 中(vDOM) | 中(vDOM) | 高 | **最高** |
| 可維護性 | 低 | **高** | 高 | 中 | 高 |
| 與 light-charts 整合 | 完美 | 好 | 好 | 好 | 好 |
| 生態系 | N/A | **豐富** | 豐富 | 中 | 小 |
| 適合的交易 Dashboard | ❌ | ✅ | ✅ | ✅ | **✅✅** |
| 最終分數 | 4/10 | 7/10 | 7/10 | 8/10 | **9/10** |

---

## 三、最終推薦方案

### 推薦棧：**SolidJS + Vite + Zustand**

```
Framework:  SolidJS (Runes API / Signals)
Build:      Vite 5
State:      Zustand
Charts:     lightweight-charts v4 (保留，npm 管理)
Backend:    server.py (不變)
WebSocket:  Phase 2 加入
UI:         Tailwind CSS + Radix UI Primitives
```

### 理由

1. **效能第一優先**：Dashboard 最核心的瓶頸是 K線即時更新。SolidJS 的顆粒度更新（編譯到精確的 DOM 操作）比 React 的 vDOM diffing 快 20-30%。

2. **學習曲線可接受**：SolidJS 語法類似 Vue 3 Composition API，Gino 熟悉 JS 很快能上手。

3. **lightweight-charts 無縫整合**：chart 實例直接操作 DOM，SolidJS 不干預。

4. **Zustand 通用性**：日後要換 React 可以直接移植。

### 不推薦的棧

- **React + Redux Toolkit**：過度設計，boilerplate 多
- **Vue 3 + Pinia**：放棄了最大的效能優勢
- **純 Vanilla JS 重構**：無法解決根本問題
- **Angular**：完全不考慮

---

## 四、遷移策略

### 三階段遷移

```
Phase 1（3週）：架構重構基礎建設
  ├─ 初始化 Vite + SolidJS 專案
  ├─ 建立 Zustand store（marketStore、strategyStore、uiStore）
  ├─ 遷移 lightweight-charts 整合
  ├─ server.py 不變、HTML/CSS 不變
  → 產出：可以運行的 MVP，功能與現在相同

Phase 2（2-3週）：新功能 + 清理
  ├─ 策略排行自動刷新（每 15 秒）
  ├─ WebSocket 即時 K線（crypto，Binance WebSocket SDK）
  ├─ shadcn/ui 替換自製 UI 元件
  └─ 消滅所有 window.* 全域狀態

Phase 3（1-2週）：打磨
  ├─ ResizeObserver 改進 chart 自適應
  ├─ 策略 modal 重構
  └─ 文件與命名規範
```

### 可保留的組件
- ✅ server.py — 完全不動
- ✅ lightweight-charts — CDN → npm
- ✅ dashboard.css — Tailwind 遷移後可逐步替換
- ✅ API 接口格式 — REST 保持不變

### 需要重寫的
- dashboard.js + 7 個 ES Module → SolidJS components + Zustand stores
- HTML 中的 onclick → SolidJS event handlers

---

## 五、與 TradingView 的差距

| 維度 | 現有 Dashboard | TradingView |
|------|--------------|-------------|
| 圖表引擎 | lightweight-charts（開源版）| 自研閉源（Canvas 直繪）|
| 即時更新 | 60秒 polling | WebSocket 毫秒級 |
| 技術指標 | 無 | 100+ 內建 |
| 繪圖工具 | 無 | 50+ |
| Screener | 無 | 完整 |
| Backtest | 無 | 完整 |
| Pine Script | 不支援 | 自研語言 |