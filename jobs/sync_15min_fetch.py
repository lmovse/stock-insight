#!/usr/bin/env python3
"""
15 分钟 K 线抓取脚本 — 只抓取 StockConfig 中配置的股票
入口: python jobs/sync_15min_fetch.py
依赖: pip install baostock pandas
"""
import baostock as bs
import pandas as pd
import time
import os
import sys
import sqlite3
from pathlib import Path

# 路径配置
WORK_DIR = Path(__file__).parent.parent
DB_PATH = WORK_DIR / "prisma" / "dev.db"
OUT_DIR = WORK_DIR / "data" / "15min"
OUT_DIR.mkdir(parents=True, exist_ok=True)

START_DATE = "2023-05-07"  # 近三年
RECONNECT_EVERY = 500
SLEEP_INTERVAL = 0.1


def to_baostock_code(stock_code: str) -> str:
    """内部格式转 Baostock 格式: 600000.SH -> sh.600000"""
    symbol, market = stock_code.split(".")
    return f"{market.lower()}.{symbol}"


def login():
    result = bs.login()
    if result.error_code != "0":
        raise RuntimeError(f"Baostock login failed: {result.error_msg}")


def logout():
    bs.logout()


def get_configured_codes() -> list[str]:
    """从 StockConfig 表读取 enabled=1 AND purpose='FIFTEEN_MIN' 的 stockCode"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT stockCode FROM StockConfig WHERE enabled = 1 AND purpose = 'FIFTEEN_MIN'"
    )
    rows = cursor.fetchall()
    conn.close()
    return [row[0] for row in rows]


def fetch_stock(baostock_code: str) -> pd.DataFrame | None:
    """抓取单只股票的 15min K 线"""
    try:
        rs = bs.query_history_k_data_plus(
            baostock_code,
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


def main():
    # 读取配置的股票
    stock_codes = get_configured_codes()
    print(f"[sync_15min_fetch] Configured stocks: {len(stock_codes)}", file=sys.stderr)

    if not stock_codes:
        print("[sync_15min_fetch] No stocks configured with enabled=1 AND purpose=FIFTEEN_MIN", file=sys.stderr)
        return

    # 转换为 Baostock 格式
    baostock_codes = [to_baostock_code(code) for code in stock_codes]

    # 开始抓取
    login()
    total = len(baostock_codes)
    fetched = 0
    skipped = 0
    failed = 0

    try:
        for i, baostock_code in enumerate(baostock_codes):
            csv_path = OUT_DIR / f"{baostock_code}.csv"

            # 跳过已存在的 CSV
            if csv_path.exists():
                skipped += 1
                continue

            df = fetch_stock(baostock_code)

            if df is not None and len(df) > 0:
                df.to_csv(csv_path, index=False)
                fetched += 1
                print(f"[{i+1}/{total}] {baostock_code} OK: {len(df)} rows", file=sys.stderr)
            else:
                failed += 1
                print(f"[{i+1}/{total}] {baostock_code} SKIP: no data", file=sys.stderr)

            # 每 500 只股票重连一次
            if (i + 1) % RECONNECT_EVERY == 0:
                logout()
                login()
                print(f"[sync_15min_fetch] reconnected at {i+1}/{total}", file=sys.stderr)

            time.sleep(SLEEP_INTERVAL)

    finally:
        logout()

    print(
        f"[sync_15min_fetch] Done. fetched={fetched}, skipped={skipped}, failed={failed}, total={total}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
