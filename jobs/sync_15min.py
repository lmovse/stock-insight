#!/usr/bin/env python3
"""
15 分钟 K 线抓取脚本 — Baostock 数据源
入口: python jobs/sync_15min.py
依赖: pip install baostock pandas
"""
import baostock as bs
import pandas as pd
import time
import os
import sys
from pathlib import Path

OUT_DIR = Path(__file__).parent.parent / "data" / "15min"
OUT_DIR.mkdir(parents=True, exist_ok=True)

START_DATE = "2023-05-07"  # 近三年
RECONNECT_EVERY = 500
SLEEP_INTERVAL = 0.1


def login():
    result = bs.login()
    if result.error_code != "0":
        raise RuntimeError(f"Baostock login failed: {result.error_msg}")


def logout():
    bs.logout()


def fetch_stock(code: str) -> pd.DataFrame | None:
    try:
        rs = bs.query_history_k_data_plus(
            code,
            "date,time,code,open,high,low,close,volume,amount",
            start_date=START_DATE,
            end_date="",
            frequency="15",
            adjustflag="1",  # 后复权
        )
        if rs.error_code != "0":
            print(f"  query failed: {rs.error_msg}", file=sys.stderr)
            return None

        data_list = []
        while rs.next():
            data_list.append(rs.get_row_data())

        if not data_list:
            return None

        df = pd.DataFrame(data_list, columns=rs.fields)
        df = df[df["volume"].astype(float) > 0]  # 过滤停牌

        # time: YYYYMMDDHHMMSSsss → YYYYMMDDHHMM（前12位）
        df["tradeTime"] = df["time"].str[:12]
        df["tradeDate"] = df["date"].str.replace("-", "", regex=False)

        for col in ["open", "high", "low", "close", "volume", "amount"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        df = df[["tradeDate", "tradeTime", "code", "open", "high", "low", "close", "volume", "amount"]]
        df = df.rename(columns={"code": "tsCode"})
        return df
    except Exception as e:
        print(f"  exception: {e}", file=sys.stderr)
        return None


def get_all_codes() -> list[str]:
    login()
    try:
        rs = bs.query_all_stock(day="2024-12-31")
        data = rs.get_data()
        mask = data["code"].str.startswith(("sh.6", "sz.0", "sz.3"))
        return data[mask]["code"].tolist()
    finally:
        logout()


def main():
    codes = get_all_codes()
    print(f"[sync_15min] Total A-share codes: {len(codes)}", file=sys.stderr)

    login()
    total = len(codes)
    done = 0

    try:
        for i, code in enumerate(codes):
            csv_path = OUT_DIR / f"{code}.csv"
            if csv_path.exists():
                done += 1
                continue

            df = fetch_stock(code)

            if df is not None and len(df) > 0:
                df.to_csv(csv_path, index=False)
                print(f"[{i+1}/{total}] {code} OK: {len(df)} rows", file=sys.stderr)
            else:
                csv_path.write_text("")
                print(f"[{i+1}/{total}] {code} SKIP: no data", file=sys.stderr)

            done += 1

            if done % RECONNECT_EVERY == 0:
                logout()
                login()
                print(f"[sync_15min] reconnected at {done}/{total}", file=sys.stderr)

            time.sleep(SLEEP_INTERVAL)

    finally:
        logout()

    print(f"[sync_15min] Done. CSV files in {OUT_DIR}", file=sys.stderr)


if __name__ == "__main__":
    main()
