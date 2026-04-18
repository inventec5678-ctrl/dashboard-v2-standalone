#!/usr/bin/env python3
"""
Data Quality Checker for Dashboard OHLCV Parquet Files

Usage:
    python data_quality_check.py --market crypto
    python data_quality_check.py --market twse
    python data_quality_check.py --market us
    python data_quality_check.py --market all --fix
"""

import os
import pandas as pd
import numpy as np
from datetime import datetime, timezone
import argparse
import sys

BASE = '/Users/changrunlin/.openclaw/workspace/dashboard_v2_standalone/data/ohlcvutc/'

# Expected schema for all markets
EXPECTED_COLS = ['open', 'high', 'low', 'close', 'volume']
EXPECTED_DTYPES = {
    'open': 'float64', 'high': 'float64', 'low': 'float64',
    'close': 'float64', 'volume': 'float64'
}

class DataQualityChecker:

    def __init__(self, market, fix=False):
        self.market = market
        self.fix = fix
        self.base = os.path.join(BASE, market)
        self.results = []

    def check_schema(self, df, filepath):
        """Check if schema matches expected"""
        issues = []
        for col in EXPECTED_COLS:
            if col not in df.columns:
                issues.append(f'MISSING column: {col}')
        for col, dtype in EXPECTED_DTYPES.items():
            if col in df.columns and df[col].dtype != dtype:
                issues.append(f'WRONG dtype for {col}: got {df[col].dtype}, expected {dtype}')
        return issues

    def check_timezone(self, df, filepath):
        """Check if index is UTC timezone aware"""
        issues = []
        if not hasattr(df.index, 'tz') or df.index.tz is None:
            issues.append('Index is not timezone-aware (should be UTC)')
        elif str(df.index.tz) != 'UTC':
            issues.append(f'Index timezone is {df.index.tz}, should be UTC')
        return issues

    def check_gaps(self, df, filepath):
        """Check for missing bars in time series"""
        issues = []
        if len(df) < 2:
            return issues

        # For 15m: check for gaps > 20min (1+ bar missing)
        # For 1h: check for gaps > 3h (allow for after-hours)
        # For 4h: check for gaps > 6h
        # For 1d: check for gaps > 4 days (allow for Fri-Mon weekends + holidays)
        # For 1w: check for gaps > 10 days (allow for holiday weeks)
        # For 1mo: check for gaps > 45 days
        
        tf_gaps = {
            '15m': 20, '1h': 180, '4h': 360, '1d': 5760, '1w': 14400, '1mo': 43200
        }

        # Determine timeframe from filepath
        fname = os.path.basename(filepath)
        tf = None
        for t in tf_gaps:
            if f'_{t}' in fname:
                tf = t
                break

        if tf is None:
            return issues

        max_gap_min = tf_gaps[tf]
        # Calculate time differences
        diffs = df.index.to_series().diff().dropna()
        large_gaps = diffs[diffs > pd.Timedelta(minutes=max_gap_min)]

        if len(large_gaps) > 0:
            for ts, delta in large_gaps.items():
                gap_hours = delta.total_seconds() / 3600
                issues.append(f'TIME GAP: {gap_hours:.1f}h gap at {ts} (expected max {max_gap_min}min for {tf})')

        return issues

    def check_volume(self, df, filepath):
        """Check for zero/null volume bars"""
        issues = []
        if 'volume' not in df.columns:
            return issues

        null_count = df['volume'].isna().sum()
        zero_count = (df['volume'] == 0).sum()

        if null_count > 0:
            issues.append(f'Volume NULL: {null_count} bars have null volume')
        if zero_count > len(df) * 0.05:  # >5% zero
            issues.append(f'Volume ZERO: {zero_count} bars have zero volume ({zero_count/len(df)*100:.1f}%)')

        return issues

    def check_ohlc_validity(self, df, filepath):
        """Check if OHLC values are valid"""
        issues = []
        for col in ['open', 'high', 'low', 'close']:
            if col not in df.columns:
                continue
            neg = (df[col] <= 0).sum()
            if neg > 0:
                issues.append(f'{col.upper()} <= 0: {neg} bars have non-positive {col}')
            null = df[col].isna().sum()
            if null > 0:
                issues.append(f'{col.upper()} NULL: {null} bars have null {col}')

        # high >= low
        if 'high' in df.columns and 'low' in df.columns:
            invalid = (df['high'] < df['low']).sum()
            if invalid > 0:
                issues.append(f'HIGH < LOW: {invalid} bars have high < low')

        # open/close within high/low
        if all(c in df.columns for c in ['open', 'high', 'low', 'close']):
            invalid = ((df['high'] < df['open']) | (df['high'] < df['close']) |
                     (df['low'] > df['open']) | (df['low'] > df['close'])).sum()
            if invalid > 0:
                issues.append(f'OHLC out of range: {invalid} bars have price outside high/low')

        return issues

    def check_date_range(self, df, filepath):
        """Check if data is within expected range"""
        issues = []
        now = pd.Timestamp.now(tz='UTC')

        # Make df.index UTC-aware if needed for comparison
        df_index = df.index
        if hasattr(df_index, 'tz') and df_index.tz is None:
            df_index = df_index.tz_localize('UTC')

        future = df[df_index > now + pd.Timedelta(days=1)]
        if len(future) > 0:
            issues.append(f'FUTURE data: {len(future)} bars are in the future')

        # For 15m/1h/4h/1d, check if data is stale (>7 days old)
        fname = os.path.basename(filepath)
        for tf in ['15m', '1h', '4h', '1d', '1w', '1mo']:
            if f'_{tf}' in fname:
                max_stale_days = {'15m':7,'1h':7,'4h':7,'1d':7,'1w':14,'1mo':60}[tf]
                last_ts = df.index.max()
                # Ensure last_ts is tz-aware for comparison
                if hasattr(last_ts, 'tz') and last_ts.tz is None:
                    last_ts = last_ts.tz_localize('UTC')
                if (now - last_ts).total_seconds() > max_stale_days * 86400:
                    issues.append(f'STALE data: last bar is {(now-last_ts).days} days old (max {max_stale_days}d for {tf})')
                break

        return issues

    def check_file_naming(self, filepath):
        """Check if filename follows convention {SYMBOL}_{TIMEFRAME}.parquet"""
        issues = []
        fname = os.path.basename(filepath)

        # Valid patterns: BTCUSDT_1d.parquet, 2330_1w.parquet, AAPL_1mo.parquet
        valid_patterns = ['_1d.parquet', '_1w.parquet', '_1wk.parquet', '_1mo.parquet',
                         '_1h.parquet', '_4h.parquet', '_15m.parquet', '_5m.parquet']

        if not any(pat in fname for pat in valid_patterns):
            issues.append(f'INVALID naming: {fname} does not match {valid_patterns}')

        # Should not have orphaned files (no timeframe suffix)
        orphaned = ['BRK_B.parquet', 'JPM.parquet', 'BTCUSDT.parquet']
        if fname in orphaned:
            issues.append(f'ORPHANED file: {fname} has no timeframe suffix')

        return issues

    def check_duplicate_bars(self, df, filepath):
        """Check for duplicate timestamps"""
        issues = []
        dupes = df.index.duplicated().sum()
        if dupes > 0:
            issues.append(f'DUPLICATES: {dupes} duplicate timestamps')
        return issues

    def fix_timezone(self, df, filepath):
        """Fix timezone to UTC"""
        if df.index.tz is None:
            df.index = df.index.tz_localize('UTC')
        elif str(df.index.tz) != 'UTC':
            df.index = df.index.tz_convert('UTC')
        return df

    def fix_dtype(self, df):
        """Fix dtypes to float64"""
        for col, dtype in EXPECTED_DTYPES.items():
            if col in df.columns and df[col].dtype != dtype:
                df[col] = df[col].astype(dtype)
        return df

    def auto_fix(self, filepath):
        """Apply auto-fixes to a parquet file"""
        df = pd.read_parquet(filepath)
        original = df.copy()

        # Fix timezone
        df = self.fix_timezone(df, filepath)
        # Fix dtype
        df = self.fix_dtype(df)

        if not df.equals(original):
            df.to_parquet(filepath)
            print(f'  [FIXED] {os.path.basename(filepath)}')

    def run_all_checks(self):
        """Run all checks on all parquet files"""
        if not os.path.exists(self.base):
            print(f'ERROR: {self.base} does not exist')
            return

        files = sorted([f for f in os.listdir(self.base) if f.endswith('.parquet')])
        total = len(files)

        print(f'\n=== Data Quality Report: {self.market.upper()} ===')
        print(f'Total files: {total}\n')

        all_issues = []
        clean_files = []

        for i, fname in enumerate(files):
            filepath = os.path.join(self.base, fname)
            try:
                df = pd.read_parquet(filepath)
            except Exception as e:
                all_issues.append({'file': fname, 'severity': 'ERROR', 'msg': f'Cannot read: {e}'})
                continue

            issues = []

            # Run all checks
            issues.extend(self.check_schema(df, filepath))
            issues.extend(self.check_timezone(df, filepath))
            issues.extend(self.check_gaps(df, filepath))
            issues.extend(self.check_volume(df, filepath))
            issues.extend(self.check_ohlc_validity(df, filepath))
            issues.extend(self.check_date_range(df, filepath))
            issues.extend(self.check_file_naming(filepath))
            issues.extend(self.check_duplicate_bars(df, filepath))

            if issues:
                for issue in issues:
                    all_issues.append({'file': fname, 'severity': 'WARNING', 'msg': issue})
            else:
                clean_files.append(fname)

        # Print results
        print(f'--- Files Summary ---')
        print(f'  Clean: {len(clean_files)}')
        print(f'  With issues: {len(all_issues)}')

        print(f'\n--- All Issues ---')
        errors = [i for i in all_issues if i['severity'] == 'ERROR']
        warnings = [i for i in all_issues if i['severity'] == 'WARNING']

        if errors:
            print(f'\n  ERRORs ({len(errors)}):')
            for e in errors:
                print(f'    [{e["file"]}] {e["msg"]}')

        if warnings:
            print(f'\n  WARNINGs ({len(warnings)}):')
            # Group by file
            by_file = {}
            for w in warnings:
                by_file.setdefault(w['file'], []).append(w['msg'])
            for fname, msgs in by_file.items():
                print(f'    {fname}:')
                for m in msgs:
                    print(f'      - {m}')

        # Summary table
        print(f'\n--- Per-File Summary ---')
        print(f'{"File":<30} {"Status":<10} {"Rows":<8} {"Date Range":<30}')
        print('-' * 80)

        for fname in sorted(files):
            df = pd.read_parquet(os.path.join(self.base, fname))
            issues_found = any(i['file'] == fname for i in all_issues)
            status = '❌ ISSUES' if issues_found else '✅ CLEAN'
            rows = len(df)
            rng = f'{df.index.min().strftime("%Y-%m-%d")} to {df.index.max().strftime("%Y-%m-%d")}'
            print(f'{fname:<30} {status:<10} {rows:<8} {rng}')

        return len(all_issues) == 0

def main():
    parser = argparse.ArgumentParser(description='Data Quality Checker')
    parser.add_argument('--market', required=True, choices=['crypto','twse','us','all'])
    parser.add_argument('--fix', action='store_true', help='Auto-fix issues where possible')
    args = parser.parse_args()

    markets = ['crypto','twse','us'] if args.market == 'all' else [args.market]

    all_clean = True
    for m in markets:
        checker = DataQualityChecker(m, fix=args.fix)
        clean = checker.run_all_checks()
        if not clean:
            all_clean = False

    sys.exit(0 if all_clean else 1)

if __name__ == '__main__':
    main()
