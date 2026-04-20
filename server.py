from fastapi import FastAPI, HTTPException, Query, Request
from pathlib import Path
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.staticfiles import StaticFiles
import httpx
import os
from datetime import datetime, timedelta
import json

app = FastAPI()

# Serve static files (CSS, JS)
BASE = os.path.dirname(__file__)
app.mount("/static", StaticFiles(directory=os.path.join(BASE, "static")), name="static")

# Import symbol lists
from data.symbols import TOP20_CRYPTO, TOP50_TWSE

# Backward-compat aliases (list of codes only, for existing endpoints)
TOP20_CRYPTO_CODES = [s.replace("USDT", "") for s in TOP20_CRYPTO]
TOP50_TWSE_CODES = list(TOP50_TWSE.keys())

DATA_DIR = Path(__file__).parent / "data"

# CORS
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TWSE_BASE = "https://openapi.twse.com.tw"

HTML_PATH = os.path.join(os.path.dirname(__file__), "dashboard_v2.html")

@app.get("/")
async def root():
    return RedirectResponse(url="/dashboard_v2")

@app.get("/dashboard_v2")
async def dashboard():
    with open(HTML_PATH, "r") as f:
        return HTMLResponse(content=f.read())

# ══════════════════════════════════════════════════════════════════════════════
# Unified Symbol API (Iteration 3)
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/symbols")
async def get_symbols(market: str = "CRYPTO"):
    if market == "CRYPTO":
        return {
            "data": [
                {"symbol": "BTCUSDT", "display": "BTC", "name": "Bitcoin"},
                {"symbol": "ETHUSDT", "display": "ETH", "name": "Ethereum"},
                {"symbol": "BNBUSDT", "display": "BNB", "name": "BNB"},
                {"symbol": "SOLUSDT", "display": "SOL", "name": "Solana"},
                {"symbol": "XRPUSDT", "display": "XRP", "name": "XRP"},
                {"symbol": "ADAUSDT", "display": "ADA", "name": "Cardano"},
                {"symbol": "DOGEUSDT", "display": "DOGE", "name": "Dogecoin"},
                {"symbol": "AVAXUSDT", "display": "AVAX", "name": "Avalanche"},
                {"symbol": "DOTUSDT", "display": "DOT", "name": "Polkadot"},
                {"symbol": "LINKUSDT", "display": "LINK", "name": "Chainlink"},
            ]
        }
    elif market == "TWSE":
        return {
            "data": [
                {"symbol": "2330", "display": "2330", "name": "台積電"},
                {"symbol": "2317", "display": "2317", "name": "鴻海"},
                {"symbol": "2454", "display": "2454", "name": "聯發科"},
                {"symbol": "3008", "display": "3008", "name": "大立光"},
            ]
        }
    elif market == "US":
        return {
            "data": [
                {"symbol": "AAPL", "display": "AAPL", "name": "Apple"},
                {"symbol": "TSLA", "display": "TSLA", "name": "Tesla"},
                {"symbol": "NVDA", "display": "NVDA", "name": "NVIDIA"},
                {"symbol": "MSFT", "display": "MSFT", "name": "Microsoft"},
            ]
        }
    return {"data": []}


def _generate_mock_klines(num_bars: int = 100, base_price: float = 100.0):
    """Generate mock OHLCV data for TWSE/US when real data is unavailable."""
    import random
    from datetime import datetime, timedelta
    now = datetime.now()
    data = []
    price = base_price
    for i in range(num_bars):
        t = now - timedelta(days=num_bars - i)
        ts = int(t.timestamp())
        change = random.uniform(-0.03, 0.035)
        open_p = price
        close = price * (1 + change)
        high = max(open_p, close) * (1 + random.uniform(0, 0.015))
        low = min(open_p, close) * (1 - random.uniform(0, 0.015))
        volume = random.randint(100000, 5000000)
        data.append({
            "time": ts,
            "open": round(open_p, 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "close": round(close, 2),
            "volume": volume,
        })
        price = close
    return data


# ── Legacy symbol endpoints (backward compat) ─────────────────────────────

@app.get("/api/symbols/crypto")
async def get_symbols_crypto():
    """Returns top 20 crypto symbols with display names"""
    return {
        "symbols": [
            {"symbol": s, "display": s.replace("USDT", "")}
            for s in TOP20_CRYPTO
        ]
    }

@app.get("/api/symbols/twse")
async def get_symbols_twse():
    """Returns top 50 TWSE stocks with code and name"""
    return {
        "symbols": [
            {"code": code, "name": name}
            for code, name in TOP50_TWSE.items()
        ]
    }

# ══════════════════════════════════════════════════════════════════════════════
# Crypto Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/crypto/list")
async def get_crypto_list():
    """Returns top 20 crypto symbols for the selector"""
    return [{"symbol": s, "name": s} for s in TOP20_CRYPTO_CODES]

@app.get("/api/crypto/klines")
async def get_crypto_klines(symbol: str = Query(""), interval: str = Query("4h"), limit: int = 300):
    """Get klines for a specific crypto - try local parquet first, then Binance"""
    import pandas as pd

    # Try local parquet first
    interval_key_map = {"1d": "1d", "1h": "1h", "4h": "4h", "1wk": "1wk", "1mo": "1mo", "15m": "15m", "D": "1d", "W": "1wk", "M": "1mo"}
    interval_key = interval_key_map.get(interval, "1d")  # parquet key
    parquet_path = os.path.join(DATA_DIR, "ohlcvutc", "crypto", f"{symbol.upper()}_{interval_key}.parquet")

    if os.path.exists(parquet_path):
        try:
            df = pd.read_parquet(parquet_path)
            if limit:
                df = df.tail(limit)
            data = [
                {"time": int(pd.Timestamp(t).timestamp()), "open": float(r["open"]), "high": float(r["high"]),
                 "low": float(r["low"]), "close": float(r["close"]), "volume": float(r["volume"])}
                for t, r in df.iterrows()
            ]
            return {"symbol": symbol.upper(), "interval": interval, "data": data}
        except Exception as e:
            pass  # Fall through to Binance

    # Binance fallback (not used for 1mo - Binance doesn't support monthly K-lines)
    if interval == "1mo" or interval_key == "1mo":
        return JSONResponse(
            content={"data": [], "error": "monthly data not available"},
            status_code=200
        )

    # Fall back to Binance for non-monthly intervals
    url = "https://api.binance.com/api/v3/klines"
    binance_symbol = symbol.upper() + "USDT" if not symbol.upper().endswith("USDT") else symbol.upper()
    binance_interval_map = {"1d": "1d", "1h": "1h", "4h": "4h", "1wk": "1w", "1mo": "1M", "15m": "15m", "5m": "5m", "D": "1d", "W": "1w", "M": "1M"}
    binance_interval = binance_interval_map.get(interval, interval)
    params = {"symbol": binance_symbol, "interval": binance_interval, "limit": limit}
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url, params=params)
        raw = r.json()

    # Binance format: [timestamp, open, high, low, close, volume, ...]
    result = []
    for d in raw:
        ts = int(d[0]) // 1000  # ms -> seconds
        result.append({
            "time": ts,
            "open": float(d[1]),
            "high": float(d[2]),
            "low": float(d[3]),
            "close": float(d[4]),
            "volume": float(d[5]),
        })
    return {"symbol": binance_symbol, "interval": interval, "data": result}

@app.get("/api/crypto/quote")
async def get_crypto_quote(symbol: str = Query("")):
    """Get current quote for a crypto"""
    url = "https://api.binance.com/api/v3/ticker/24hr"
    binance_symbol = symbol.upper() + "USDT" if not symbol.upper().endswith("USDT") else symbol.upper()
    params = {"symbol": binance_symbol}
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(url, params=params)
        data = r.json()

    return {
        "symbol": symbol.upper(),
        "price": float(data.get("lastPrice", 0)),
        "change": float(data.get("priceChange", 0)),
        "change_pct": float(data.get("priceChangePercent", 0)),
        "high": float(data.get("highPrice", 0)),
        "low": float(data.get("lowPrice", 0)),
        "volume": float(data.get("volume", 0)),
    }

@app.get("/api/twse/list")
async def get_twse_list():
    """Returns top 50 TWSE stocks for the selector"""
    return [{"code": c, "name": c} for c in TOP50_TWSE_CODES]

def _twse_headers():
    return {"Accept": "application/json", "User-Agent": "Mozilla/5.0"}

_TWSE_CLIENT_ARGS = {"timeout": 15.0, "headers": _twse_headers(), "verify": False}

# ── 股票搜尋 ──────────────────────────────────────────────────────────────

@app.get("/api/twse/search")
async def twse_search(q: str = Query("")):
    url = f"{TWSE_BASE}/v1/exchangeReport/STOCK_DAY_ALL"
    async with httpx.AsyncClient(**_TWSE_CLIENT_ARGS) as client:
        r = await client.get(url)
        all_stocks = r.json()

    q_lower = q.lower()
    results = [
        {"code": s["Code"], "name": s["Name"]}
        for s in all_stocks
        if q_lower in s["Code"].lower() or q_lower in s["Name"].lower()
    ]
    return results[:20]

# ── 即時行情 ────────────────────────────────────────────────────────────────

@app.get("/api/twse/quote")
async def twse_quote(stock: str = Query("")):
    url = f"{TWSE_BASE}/v1/exchangeReport/STOCK_DAY_ALL"
    async with httpx.AsyncClient(**_TWSE_CLIENT_ARGS) as client:
        r = await client.get(url)
        all_stocks = r.json()

    target = None
    for s in all_stocks:
        if s["Code"] == stock:
            target = s
            break

    if not target:
        return JSONResponse(content={"error": f"Stock {stock} not found"}, status_code=404)

    # 本益比/殖利率
    pe_url = f"{TWSE_BASE}/v1/exchangeReport/BWIBBU_ALL"
    async with httpx.AsyncClient(**_TWSE_CLIENT_ARGS) as client:
        r2 = await client.get(pe_url)
        pe_data = r2.json()

    pe_info = {}
    for p in pe_data:
        if p["Code"] == stock:
            pe_info = {"pe": p.get("PEratio", ""), "dy": p.get("DividendYield", ""), "pb": p.get("PBratio", "")}
            break

    close = float(target["ClosingPrice"]) if target["ClosingPrice"] else 0
    open_p = float(target["OpeningPrice"]) if target["OpeningPrice"] else close
    change = float(target["Change"]) if target["Change"] else 0
    pct = (change / open_p * 100) if open_p else 0

    return {
        "code": target["Code"],
        "name": target["Name"],
        "price": close,
        "change": change,
        "change_pct": round(pct, 2),
        "open": float(target["OpeningPrice"]) if target["OpeningPrice"] else None,
        "high": float(target["HighestPrice"]) if target["HighestPrice"] else None,
        "low": float(target["LowestPrice"]) if target["LowestPrice"] else None,
        "volume": int(target["TradeVolume"]) if target["TradeVolume"] else 0,
        "trade_value": int(target["TradeValue"]) if target["TradeValue"] else 0,
        "transaction": int(target["Transaction"]) if target["Transaction"] else 0,
        **pe_info,
    }

# ── 日K線 ─────────────────────────────────────────────────────────────────

@app.get("/api/twse/daily")
async def twse_daily(stock: str = Query(""), months: int = 6):
    url = f"{TWSE_BASE}/v1/exchangeReport/STOCK_DAY_ALL"
    async with httpx.AsyncClient(**_TWSE_CLIENT_ARGS) as client:
        r = await client.get(url)
        all_data = r.json()

    target = None
    for s in all_data:
        if s["Code"] == stock:
            target = s
            break

    if not target:
        return JSONResponse(content={"error": f"Stock {stock} not found"}, status_code=404)

    close = float(target["ClosingPrice"]) if target["ClosingPrice"] else 0
    open_p = float(target["OpeningPrice"]) if target["OpeningPrice"] else close
    high = float(target["HighestPrice"]) if target["HighestPrice"] else close
    low = float(target["LowestPrice"]) if target["LowestPrice"] else close
    volume = int(target["TradeVolume"]) if target["TradeVolume"] else 0
    date_str = str(target["Date"])  # e.g. "1150416"

    # Taiwan ROC calendar: year = first 3 digits + 1911 = Gregorian year
    greg_year = int(date_str[:3]) + 1911
    greg_month = int(date_str[3:5])
    greg_day = int(date_str[5:7])
    from datetime import datetime
    ts = int(datetime(greg_year, greg_month, greg_day).timestamp())

    return [{
        "time": ts,
        "open": float(open_p),
        "high": float(high),
        "low": float(low),
        "close": float(close),
        "volume": int(volume),
    }]

# ── 分線圖 ────────────────────────────────────────────────────────────────

@app.get("/api/twse/klines")
async def twse_klines(stock: str = Query(""), interval: str = Query(""), limit: int = 300):
    """Serve TWSE klines: 1d from JSON, 1wk/1mo from parquet"""
    import pandas as pd
    interval_key_map = {"1d": "1d", "1wk": "1wk", "1mo": "1mo", "D": "1d", "W": "1wk", "M": "1mo"}
    interval_key = interval_key_map.get(interval, "1d")

    # Try parquet first (for 1wk/1mo, or if 1d parquet exists)
    parquet_path = os.path.join(DATA_DIR, "ohlcvutc", "twse", f"{stock}_{interval_key}.parquet")
    if os.path.exists(parquet_path):
        df = pd.read_parquet(parquet_path)
        if limit:
            df = df.tail(limit)
        data = [
            {"time": int(pd.Timestamp(t).timestamp()), "open": float(r["open"]), "high": float(r["high"]),
             "low": float(r["low"]), "close": float(r["close"]), "volume": float(r["volume"])}
            for t, r in df.iterrows()
        ]
        return {"data": data}

    # Fallback to JSON for 1d
    data_dir = "/Users/changrunlin/.openclaw/workspace/crypto-agent-platform/data/twse_daily"
    filepath = os.path.join(data_dir, f"{stock}.json")
    if not os.path.exists(filepath):
        return JSONResponse(content={"error": f"No data for {stock}"}, status_code=404)
    with open(filepath) as f:
        raw_data = json.load(f)
    data = raw_data[-limit:]
    return {"data": data}

@app.get("/api/twse/intraday")
async def twse_intraday(stock: str = Query("")):
    url = f"{TWSE_BASE}/v1/exchangeReport/MI_5MINS"
    async with httpx.AsyncClient(**_TWSE_CLIENT_ARGS) as client:
        r = await client.get(url)
        data = r.json()

    result = []
    for item in data:
        try:
            t = str(item["Time"])
            h = int(t[:2])
            m = int(t[2:4])
            s = int(t[4:6]) if len(t) >= 6 else 0
            today = datetime.now().replace(hour=h, minute=m, second=s, microsecond=0)
            ts = int(today.timestamp())

            close = float(item.get("AccTradePrice", 0) or 0)
            if close <= 0:
                continue

            result.append({
                "time": ts,
                "open": close,
                "high": close,
                "low": close,
                "close": close,
                "volume": int(item["AccTradeVolume"]) if item["AccTradeVolume"] else 0,
            })
        except:
            continue
    return result

# ── 大盤指數 ─────────────────────────────────────────────────────────────

@app.get("/api/twse/index")
async def twse_index():
    url = f"{TWSE_BASE}/v1/exchangeReport/MI_INDEX"
    async with httpx.AsyncClient(**_TWSE_CLIENT_ARGS) as client:
        r = await client.get(url)
        data = r.json()

    for item in data:
        if "發行量加權股價指數" in item.get("指數", ""):
            return {
                "name": item["指數"],
                "close": float(item["收盤指數"].replace(",", "")) if item["收盤指數"] else 0,
                "change": item.get("漲跌", ""),
                "change_point": float(item["漲跌點數"].replace(",", "")) if item.get("漲跌點數") else 0,
                "change_pct": float(item["漲跌百分比"].replace(",", "")) if item.get("漲跌百分比") else 0,
                "date": item["日期"],
            }
    return {}

# ── 個股基本資料 ─────────────────────────────────────────────────────────

@app.get("/api/twse/info")
async def twse_info(stock: str = Query("")):
    url = f"{TWSE_BASE}/v1/exchangeReport/BWIBBU_ALL"
    async with httpx.AsyncClient(**_TWSE_CLIENT_ARGS) as client:
        r = await client.get(url)
        all_data = r.json()

    for item in all_data:
        if item["Code"] == stock:
            return {
                "code": item["Code"],
                "name": item["Name"],
                "date": item["Date"],
                "pe": item.get("PEratio", ""),
                "dividend_yield": item.get("DividendYield", ""),
                "pb": item.get("PBratio", ""),
            }
    return {"code": stock, "name": "", "pe": "", "dividend_yield": "", "pb": ""}

# ══════════════════════════════════════════════════════════════════════════════
# Binance / Crypto Endpoints
# ══════════════════════════════════════════════════════════════════════════════
# Multi-Market K-Line Endpoint (Iteration 3)
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/klines")
async def get_klines(symbol: str = Query("BTCUSDT"), interval: str = Query("1d"),
                    limit: int = 100, market: str = Query("CRYPTO")):
    """Unified klines endpoint: CRYPTO=Binance real, TWSE=FinMind real, US=yfinance real."""
    if market == "CRYPTO":
        url = "https://api.binance.com/api/v3/klines"
        binance_symbol = symbol.upper() + "USDT" if not symbol.upper().endswith("USDT") else symbol.upper()
        binance_interval_map = {
            "1d": "1d", "1h": "1h", "4h": "4h", "1wk": "1w", "1mo": "1M",
            "15m": "15m", "5m": "5m", "D": "1d", "W": "1w", "M": "1M"
        }
        binance_interval = binance_interval_map.get(interval, interval)
        params = {"symbol": binance_symbol, "interval": binance_interval, "limit": limit}
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(url, params=params)
            raw = r.json()
        result = []
        for d in raw:
            ts = int(d[0]) // 1000
            result.append({
                "time": ts,
                "open": float(d[1]),
                "high": float(d[2]),
                "low": float(d[3]),
                "close": float(d[4]),
                "volume": float(d[5]),
            })
        return {"symbol": binance_symbol, "interval": interval, "data": result}

    elif market == "TWSE":
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    "https://api.finmindtrade.com/api/v4/data",
                    params={
                        "dataset": "TaiwanStockPrice",
                        "data_id": symbol,
                        "start_date": "2026-04-01",
                        "end_date": "2026-04-20",
                    }
                )
                raw = resp.json()
                data = []
                for d in raw.get("data", []):
                    if d.get("open"):
                        data.append({
                            "time": int(datetime.strptime(d["date"], "%Y-%m-%d").timestamp()),
                            "open": float(d["open"]),
                            "high": float(d["max"]),
                            "low": float(d["min"]),
                            "close": float(d["close"]),
                        })
                if data:
                    return {"symbol": symbol, "interval": "1d", "data": data[-limit:]}
        except Exception:
            pass
        # Fallback to mock
        base_prices = {"2330": 800.0, "2317": 180.0, "2454": 1200.0, "3008": 2000.0}
        base = base_prices.get(symbol, 100.0)
        data = _generate_mock_klines(num_bars=limit, base_price=base)
        response = JSONResponse(content={"symbol": symbol, "interval": interval, "data": data})
        response.headers["X-Data-Source"] = "mock"
        return response

    elif market == "US":
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            df = ticker.history(period="90d")
            if df is not None and len(df) > 0:
                data = []
                for i in range(min(limit, len(df))):
                    dt = df.index[i]
                    ts = int(dt.timestamp()) if hasattr(dt, 'timestamp') else int(dt.to_pydatetime().timestamp())
                    data.append({
                        "time": ts,
                        "open": float(df['Open'].iloc[i]),
                        "high": float(df['High'].iloc[i]),
                        "low": float(df['Low'].iloc[i]),
                        "close": float(df['Close'].iloc[i]),
                    })
                if data:
                    return {"symbol": symbol.upper(), "interval": "1d", "data": data[-limit:]}
        except Exception:
            pass
        # Fallback to mock
        base_prices = {"AAPL": 175.0, "TSLA": 250.0, "NVDA": 800.0, "MSFT": 400.0}
        base = base_prices.get(symbol, 100.0)
        data = _generate_mock_klines(num_bars=limit, base_price=base)
        response = JSONResponse(content={"symbol": symbol, "interval": interval, "data": data})
        response.headers["X-Data-Source"] = "mock"
        return response

    else:
        base_prices = {"2330": 800.0, "2317": 180.0, "2454": 1200.0, "3008": 2000.0,
                       "AAPL": 175.0, "TSLA": 250.0, "NVDA": 800.0, "MSFT": 400.0}
        base = base_prices.get(symbol, 100.0)
        data = _generate_mock_klines(num_bars=limit, base_price=base)
        response = JSONResponse(content={"symbol": symbol, "interval": interval, "data": data})
        response.headers["X-Data-Source"] = "mock"
        return response

# ══════════════════════════════════════════════════════════════════════════════
# Backend proxy routes (proxied to port 5008)
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/strategies/all")
async def get_strategies_all():
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get("http://localhost:5008/api/strategies/all")
        return r.json()

@app.get("/api/strategies/live")
async def get_strategies_live():
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get("http://localhost:5008/api/strategies/live")
        return r.json()

@app.get("/api/dashboard/anomalies")
async def get_anomalies():
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get("http://localhost:5008/api/dashboard/anomalies")
        return r.json()

@app.get("/api/status")
async def get_status():
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get("http://localhost:5008/api/status")
        return r.json()

@app.get("/api/signals")
async def get_signals(symbol: str = None, limit: int = 10):
    async with httpx.AsyncClient(timeout=30.0) as client:
        params = {"limit": limit}
        if symbol:
            params["symbol"] = symbol
        r = await client.get("http://localhost:5008/api/signals", params=params)
        return r.json()

@app.get("/api/signals/history")
async def get_signal_history(symbol: str = None, strategy: str = None, days: int = 7, limit: int = 100):
    async with httpx.AsyncClient(timeout=30.0) as client:
        params = {"days": days, "limit": limit}
        if symbol:
            params["symbol"] = symbol
        if strategy:
            params["strategy"] = strategy
        r = await client.get("http://localhost:5008/api/signals/history", params=params)
        return r.json()

@app.get("/api/strategies")
async def get_strategies():
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get("http://localhost:5008/api/strategies")
        return r.json()

@app.get("/api/rankings")
async def get_rankings():
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get("http://localhost:5008/api/rankings")
        return r.json()

# TWSE API routes (proxy to port 5008)
@app.get("/api/twse/quote/{code}")
async def twse_quote_proxy(code: str):
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"http://localhost:5008/api/twse/quote/{code}")
        return r.json()

@app.get("/api/twse/klines/{code}")
async def twse_klines_proxy(code: str, interval: str = "D", limit: int = 300):
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"http://localhost:5008/api/twse/klines/{code}?interval={interval}&limit={limit}")
        raw = r.json()
    if isinstance(raw, list):
        return {"data": raw[-limit:]}
    return raw

@app.get("/api/twse/anomalies/realtime")
async def twse_anomalies_realtime():
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get("http://localhost:5008/api/twse/anomalies/realtime")
        return r.json()

@app.get("/api/symbols/us")
async def get_symbols_us():
    """Returns US stock symbols from meta/symbols_us.json"""
    import json
    path = os.path.join(DATA_DIR, "meta", "symbols_us.json")
    if not os.path.exists(path):
        return {"symbols": []}
    with open(path) as f:
        data = json.load(f)
    return {"symbols": data.get("symbols", [])}

@app.get("/api/us/quote/{symbol}")
async def us_quote(symbol: str):
    """Get current US stock quote via yfinance"""
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        price = info.last_price or 0
        prev_close = info.previous_close or 0
        change = price - prev_close
        change_pct = (change / prev_close * 100) if prev_close else 0
        return {
            "symbol": symbol.upper(),
            "price": round(float(price), 2),
            "change": round(float(change), 2),
            "change_pct": round(float(change_pct), 2),
            "volume": info.last_volume or 0
        }
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/api/us/klines/{symbol}")
async def us_klines(symbol: str, interval: str = "1d", limit: int = 300):
    """Serve US stock klines from local parquet files"""
    import pandas as pd
    interval_map = {"1d": "1d", "1wk": "1wk", "1mo": "1mo", "D": "1d", "W": "1wk", "M": "1mo"}
    interval_key = interval_map.get(interval, "1d")
    path = os.path.join(DATA_DIR, "ohlcvutc", "us", f"{symbol.upper()}_{interval_key}.parquet")
    if not os.path.exists(path):
        return JSONResponse(content={"error": f"No data for {symbol} {interval}"}, status_code=404)
    df = pd.read_parquet(path).tail(limit)
    data = []
    for idx, row in df.iterrows():
        ts = idx
        if hasattr(ts, 'timestamp'):
            ts = int(ts.timestamp())
        elif isinstance(ts, str):
            from datetime import datetime
            ts = int(datetime.parse(ts).timestamp())
        data.append({
            "time": ts,
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": float(row["volume"]),
        })
    return {"symbol": symbol.upper(), "interval": interval_key, "data": data}

@app.get("/api/twse/stocks")
async def twse_stocks():
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get("http://localhost:5008/api/twse/stocks")
        return r.json()
