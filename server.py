from fastapi import FastAPI
from fastapi.responses import HTMLResponse, RedirectResponse
import httpx
import os

app = FastAPI()

# Dashboard HTML 路徑
HTML_PATH = os.path.join(os.path.dirname(__file__), "dashboard_v2.html")

@app.get("/")
async def root():
    return RedirectResponse(url="/dashboard_v2")

@app.get("/dashboard_v2")
async def dashboard():
    with open(HTML_PATH, "r") as f:
        return HTMLResponse(content=f.read())

@app.get("/api/klines")
async def get_klines(symbol: str, interval: str, limit: int = 300):
    # Binance klines API
    url = f"https://api.binance.com/api/v3/klines"
    params = {"symbol": symbol, "interval": interval, "limit": limit}
    async with httpx.AsyncClient() as client:
        r = await client.get(url, params=params)
        return r.json()

@app.get("/api/strategies/all")
async def get_strategies_all():
    # 回傳空陣列或其他默認值
    return []

@app.get("/api/strategies/live")
async def get_strategies_live():
    return []

@app.get("/api/dashboard/anomalies")
async def get_anomalies():
    return []
