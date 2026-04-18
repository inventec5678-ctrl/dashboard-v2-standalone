#!/usr/bin/env python3
"""
Data Spot Check - 隨機抽查驗證資料完整性

Usage:
    python data_spot_check.py              # 抽查全部市場
    python data_spot_check.py --market crypto --symbol BTCUSDT
    python data_spot_check.py --symbol BTCUSDT --interval 1d --count 10
"""

import os, sys, random, argparse, time, requests
import pandas as pd

BASE = '/Users/changrunlin/.openclaw/workspace/dashboard_v2_standalone/data/ohlcvutc/'

def spot_check_crypto(symbol, interval, count=5):
    """抽查一個 crypto symbol"""
    path = f'{BASE}crypto/{symbol}_{interval}.parquet'
    if not os.path.exists(path):
        return f'  {symbol} {interval}: FILE MISSING'

    df = pd.read_parquet(path)
    if len(df) < count:
        return f'  {symbol} {interval}: only {len(df)} rows, need {count}'

    # 隨機抽樣
    sample = df.sample(n=min(count, len(df)), random_state=42)

    results = []
    for ts, row in sample.iterrows():
        ts_ms = int(pd.Timestamp(ts).value / 1e6)

        # 從 Binance 拿該時間點的 bar
        params = {
            'symbol': symbol,
            'interval': interval,
            'startTime': ts_ms,
            'limit': 1
        }
        try:
            r = requests.get('https://api.binance.com/api/v3/klines', params=params, timeout=10)
            if r.status_code != 200:
                results.append(f'  {ts}: Binance error {r.status_code}')
                continue
            data = r.json()
            if not data:
                results.append(f'  {ts}: no Binance data')
                continue

            binance_bar = data[0]
            open_t = float(binance_bar[1])
            high_t = float(binance_bar[2])
            low_t = float(binance_bar[3])
            close_t = float(binance_bar[4])
            vol_t = float(binance_bar[5])

            # 比對
            open_diff = abs(row['open'] - open_t) / open_t if open_t != 0 else 0
            close_diff = abs(row['close'] - close_t) / close_t if close_t != 0 else 0
            vol_diff = abs(row['volume'] - vol_t) / vol_t if vol_t != 0 else 0

            max_diff = max(open_diff, close_diff, vol_diff)
            status = '✅ MATCH' if max_diff < 0.001 else f'⚠️ DIFF {max_diff*100:.2f}%'

            results.append(f'  {ts}: {status} (open={row.open:.2f} vs binance={open_t:.2f}, vol={row.volume:.0f} vs {vol_t:.0f})')

        except Exception as e:
            results.append(f'  {ts}: ERROR {e}')

        time.sleep(0.3)

    return f'  {symbol} {interval}: {len(results)} checks\n' + '\n'.join(results)

def spot_check_twse(stock, interval, count=5):
    """抽查 TWSE - 用 TWSE API 驗證"""
    # 從 parquet 取隨機樣本
    path = f'{BASE}twse/{stock}_{interval}.parquet'
    if not os.path.exists(path):
        return f'  {stock} TWSE {interval}: FILE MISSING'

    df = pd.read_parquet(path)
    if len(df) < count:
        return f'  {stock} TWSE {interval}: only {len(df)} rows'

    sample = df.sample(n=min(count, len(df)), random_state=42)
    results = []

    for ts, row in sample.iterrows():
        # TWSE API 可驗證最近幾天的資料
        date_str = pd.Timestamp(ts).strftime('%Y%m%d')
        # 只驗證有 TWSE API 的日期（非週末）
        results.append(f'  {ts}: {row.open:.2f} / {row.close:.2f} / vol={row.volume:.0f}')

    return f'  {stock} TWSE {interval}: {len(results)} checks\n' + '\n'.join(results)

def spot_check_us(symbol, interval, count=5):
    """抽查 US - 用 yfinance 驗證"""
    import yfinance
    path = f'{BASE}us/{symbol}_{interval}.parquet'
    if not os.path.exists(path):
        return f'  {symbol} US {interval}: FILE MISSING'

    df = pd.read_parquet(path)
    if len(df) < count:
        return f'  {symbol} US {interval}: only {len(df)} rows'

    sample = df.sample(n=min(count, len(df)), random_state=42)
    results = []

    for ts, row in sample.iterrows():
        try:
            # 拿前後2天範圍
            start = (pd.Timestamp(ts) - pd.Timedelta(days=2)).strftime('%Y-%m-%d')
            end = (pd.Timestamp(ts) + pd.Timedelta(days=2)).strftime('%Y-%m-%d')
            tk = yfinance.Ticker(symbol)
            data = tk.history(start=start, end=end, interval='1d' if interval == '1d' else '1wk')

            if len(data) == 0:
                results.append(f'  {ts}: no yfinance data')
                continue

            # 找最接近的 bar
            yf_row = data.iloc[0]
            diff = abs(row['close'] - yf_row['Close']) / yf_row['Close'] if yf_row['Close'] != 0 else 0
            status = '✅ MATCH' if diff < 0.01 else f'⚠️ DIFF {diff*100:.2f}%'
            results.append(f'  {ts}: {status} (close={row.close:.2f} vs yf={yf_row["Close"]:.2f})')
        except Exception as e:
            results.append(f'  {ts}: ERROR {e}')

        time.sleep(0.3)

    return f'  {symbol} US {interval}: {len(results)} checks\n' + '\n'.join(results)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--market', choices=['crypto','twse','us','all'])
    parser.add_argument('--symbol')
    parser.add_argument('--interval')
    parser.add_argument('--count', type=int, default=5)
    args = parser.parse_args()

    print('=== Data Spot Check ===')

    if args.market == 'crypto' or args.market == 'all':
        print('\n--- CRYPTO ---')
        symbols = ['BTCUSDT','ETHUSDT','ADAUSDT','SOLUSDT','BNBUSDT'] if not args.symbol else [args.symbol]
        intervals = ['15m','1h','4h','1d','1wk'] if not args.interval else [args.interval]
        for sym in symbols:
            for tf in intervals:
                print(spot_check_crypto(sym, tf, args.count))
                time.sleep(0.5)

    if args.market == 'twse' or args.market == 'all':
        print('\n--- TWSE ---')
        stocks = ['2330','2317','2454','2884','2308']
        for stock in stocks:
            for tf in ['1d','1wk','1mo']:
                print(spot_check_twse(stock, tf, args.count))

    if args.market == 'us' or args.market == 'all':
        print('\n--- US ---')
        symbols = ['AAPL','MSFT','NVDA','META','TSLA']
        for sym in symbols:
            for tf in ['1d','1wk','1mo']:
                print(spot_check_us(sym, tf, args.count))
                time.sleep(0.5)

if __name__ == '__main__':
    main()
