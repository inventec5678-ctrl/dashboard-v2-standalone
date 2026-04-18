import time, requests, pandas as pd, os

BASE = '/Users/changrunlin/.openclaw/workspace/dashboard_v2_standalone/data/ohlcvutc/crypto/'

def fetch_segment(symbol, start_ms, end_ms, retries=3):
    """Fetch 15m bars from start_ms to end_ms, paginating"""
    url = 'https://api.binance.com/api/v3/klines'
    bars = []
    current = start_ms
    
    while current < end_ms:
        params = {'symbol': symbol, 'interval': '15m', 'limit': 1000, 'startTime': current}
        try:
            r = requests.get(url, params=params, timeout=10)
            if r.status_code != 200:
                print(f'  Error {r.status_code}')
                break
            data = r.json()
            if not data:
                break
            # Filter to bars before end_ms
            segment = [b for b in data if b[0] < end_ms]
            bars.extend(segment)
            last_ts = data[-1][0]
            current = last_ts + 15*60*1000
            print(f'  {symbol}: {len(bars)} bars, last={pd.Timestamp(last_ts, unit="ms").strftime("%Y-%m-%d")}')
            if len(data) < 1000 or last_ts >= end_ms:
                break
            time.sleep(0.25)
        except requests.exceptions.RequestException as e:
            if 'DNS' in str(e) or 'timeout' in str(e).lower():
                if retries > 0:
                    print(f'  DNS/timeout error, retrying ({retries})...')
                    retries -= 1
                    time.sleep(2)
                    continue
            print(f'  Error: {e}')
            time.sleep(1)
            break
        except Exception as e:
            print(f'  Error: {e}')
            time.sleep(1)
            break
    return bars

def write_15m(symbol, bars, start_ms, end_ms):
    if not bars:
        return []
    df = pd.DataFrame(bars, columns=['open_time','open','high','low','close','volume','close_time','quote_vol','trades','tb_base','tb_quote','ignore'])
    df['timestamp'] = pd.to_datetime(df['open_time'], unit='ms', utc=True)
    df.set_index('timestamp', inplace=True)
    df.index = df.index.tz_convert('UTC')
    df.index.name = 'timestamp'
    df = df[['open','high','low','close','volume']].astype(float)
    df['market'] = 'crypto'; df['symbol'] = symbol; df['currency'] = 'USDT'
    df['timeframe'] = '15m'; df['adj_close'] = df['close']
    df['dividends'] = 0.0; df['stock_splits'] = 0.0; df['source'] = 'binance'
    df['fetched_at'] = pd.Timestamp.now(tz='UTC')
    return df

def download_symbol_full(symbol):
    """Download full 15m history for symbol"""
    path = f'{BASE}{symbol}_15m.parquet'
    
    # Define segments (start_ms, end_ms)
    segments = [
        (int(pd.Timestamp('2019-01-01').value/1e6), int(pd.Timestamp('2020-04-01').value/1e6)),
        (int(pd.Timestamp('2020-04-01').value/1e6), int(pd.Timestamp('2021-08-01').value/1e6)),
        (int(pd.Timestamp('2021-08-01').value/1e6), int(pd.Timestamp('2023-01-01').value/1e6)),
        (int(pd.Timestamp('2023-01-01').value/1e6), int(pd.Timestamp('2024-06-01').value/1e6)),
        (int(pd.Timestamp('2024-06-01').value/1e6), int(pd.Timestamp('2026-04-18').value/1e6)),
    ]
    
    all_dfs = []
    for start_ms, end_ms in segments:
        print(f'  Segment {pd.Timestamp(start_ms, unit="ms").strftime("%Y-%m-%d")} to {pd.Timestamp(end_ms, unit="ms").strftime("%Y-%m-%d")}')
        bars = fetch_segment(symbol, start_ms, end_ms)
        if bars:
            df = write_15m(symbol, bars, start_ms, end_ms)
            all_dfs.append(df)
        time.sleep(1)
    
    if not all_dfs:
        print(f'{symbol}: no data')
        return
    
    # Merge all segments
    combined = pd.concat(all_dfs).drop_duplicates().sort_index()
    combined.to_parquet(path)
    df2 = pd.read_parquet(path)
    print(f'OK: {symbol} -> {len(df2)} rows, {df2.index.min()} to {df2.index.max()}')

# Main execution
symbols = [
    'ETHUSDT', 'ADAUSDT', 'ATOMUSDT',
    'AVAXUSDT', 'BNBUSDT', 'DOGEUSDT', 'DOTUSDT', 'ETCUSDT', 'LINKUSDT', 'LTCUSDT', 'MATICUSDT', 'NEARUSDT', 'SOLUSDT', 'UNIUSDT',
    'XLMUSDT', 'XRPUSDT',
    'APTUSDT', 'ARBUSDT', 'OPUSDT',
]

for sym in symbols:
    print(f'=== {sym} ===')
    download_symbol_full(sym)
    print()
