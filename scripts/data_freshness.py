#!/usr/bin/env python3
"""
Data Freshness Checker - 檢查資料是否到最新日期

Usage:
    python data_freshness.py                 # 全部市場
    python data_freshness.py --market crypto  # 只有 crypto
    python data_freshness.py --threshold 3    # 3天內算 GREEN
"""

import os, argparse
import pandas as pd

BASE = '/Users/changrunlin/.openclaw/workspace/dashboard_v2_standalone/data/ohlcvutc/'

THRESHOLDS = {
    '15m': 7,   # 7 days
    '1h': 7,
    '4h': 7,
    '1d': 7,
    '1w': 14,
    '1wk': 14,
    '1mo': 60,
}

def check_freshness(market):
    base = os.path.join(BASE, market)
    files = sorted([f for f in os.listdir(base) if f.endswith('.parquet')])

    print(f'\n=== {market.upper()} Freshness ===')

    now = pd.Timestamp.now(tz='UTC')
    stale = []

    for f in files:
        path = os.path.join(base, f)
        try:
            df = pd.read_parquet(path)
            last_ts = df.index.max()
            age_days = (now - last_ts).total_seconds() / 86400

            # Determine timeframe from filename
            tf = None
            for t in THRESHOLDS:
                if f'_{t}.' in f:
                    tf = t
                    break

            threshold = THRESHOLDS.get(tf, 7)

            if age_days <= threshold:
                status = '✅ GREEN'
            elif age_days <= threshold * 2:
                status = '🟡 YELLOW'
            else:
                status = '🔴 RED'

            print(f'{status} {f}: last={last_ts.strftime("%Y-%m-%d")} ({age_days:.0f}d ago, threshold={threshold}d)')

            if age_days > threshold * 2:
                stale.append((f, last_ts, age_days))

        except Exception as e:
            print(f'ERROR {f}: {e}')

    if stale:
        print(f'\n⚠️  STALE FILES ({len(stale)}):')
        for f, ts, age in stale:
            print(f'  {f}: {ts.strftime("%Y-%m-%d")} ({age:.0f}d old)')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--market', choices=['crypto','twse','us','all'])
    parser.add_argument('--threshold', type=int, default=None)  # 覆寫預設閾值
    args = parser.parse_args()

    markets = ['crypto','twse','us'] if args.market == 'all' else [args.market or 'all']

    print('=== Data Freshness Report ===')
    print(f'Generated: {pd.Timestamp.now(tz="UTC").strftime("%Y-%m-%d %H:%M UTC")}')

    for m in markets:
        check_freshness(m)

if __name__ == '__main__':
    main()
