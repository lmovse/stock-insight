#!/usr/bin/env python3
"""
15 分钟 K 线抓取脚本
直接从 DB 查询每只股票的最新日期，决定增量还是全量抓取，然后 upsert 到 DB。
入口: python jobs/sync_15min_fetch.py
依赖: pip install baostock pandas
"""
import baostock as bs
import pandas as pd
import time
import sys
import sqlite3
import uuid
import os
from pathlib import Path
from datetime import datetime, timedelta, date

WORK_DIR = Path(__file__).parent.parent
DB_PATH = os.environ.get("DATABASE_URL", str(WORK_DIR / "prisma" / "dev.db"))
# DATABASE_URL格式: file:/path/to/dev.db 或 file:./prisma/dev.db
if DB_PATH.startswith("file:"):
    DB_PATH = DB_PATH[5:]  # 去掉 "file:" 前缀
START_DATE = "2023-05-07"  # 近三年
RECONNECT_EVERY = 100
SLEEP_INTERVAL = 0.1


def to_baostock_code(stock_code: str) -> str:
    """内部格式转 Baostock 格式: 600000.SH -> sh.600000"""
    try:
        symbol, market = stock_code.split(".")
        return f"{market.lower()}.{symbol}"
    except ValueError:
        raise ValueError(f"Invalid stock code format: {stock_code}")


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


def get_latest_date(ts_code: str) -> str | None:
    """查询 DB 中某只股票最新一条 K 线日期"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT MAX(tradeDate) FROM MinuteCandle WHERE tsCode = ?",
        (ts_code,)
    )
    row = cursor.fetchone()
    conn.close()
    return row[0] if row and row[0] else None


def upsert_minute_candles(df: pd.DataFrame, conn: sqlite3.Connection) -> int:
    """Upsert DataFrame 到 MinuteCandle 表，返回写入行数"""
    cursor = conn.cursor()
    rows = []
    for _, r in df.iterrows():
        rows.append((
            str(uuid.uuid4().hex[:24]),
            r["tsCode"],
            r["tradeDate"],
            r["tradeTime"],
            float(r["open"]),
            float(r["high"]),
            float(r["low"]),
            float(r["close"]),
            float(r["volume"]),
            float(r["amount"]) if pd.notna(r["amount"]) else None,
            "1",  # adjustFlag=后复权
        ))

    cursor.executemany("""
        INSERT INTO MinuteCandle
          (id, tsCode, tradeDate, tradeTime, open, high, low, close, volume, amount, adjustFlag)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (tsCode, tradeTime) DO UPDATE SET
          open=excluded.open,
          high=excluded.high,
          low=excluded.low,
          close=excluded.close,
          volume=excluded.volume,
          amount=excluded.amount
    """, rows)
    conn.commit()
    return len(rows)


def fetch_and_upsert(baostock_code: str) -> tuple[int, str]:
    """
    抓取并 upsert 单只股票的 15min K 线。
    返回 (写入行数, start_date)。如果无新数据则返回 (0, start_date)。
    """
    # 查 DB 最新日期
    latest = get_latest_date(baostock_code)

    if latest:
        # 有数据，增量：从最新日期的下一天开始
        latest_dt = datetime.strptime(latest, "%Y%m%d")
        start_dt = latest_dt + timedelta(days=1)
        if start_dt.date() >= date.today():
            return (0, start_dt.strftime("%Y-%m-%d"))  # 今天还没过，跳过
        start_date = start_dt.strftime("%Y-%m-%d")
    else:
        # 无数据，全量
        start_date = START_DATE

    # 抓取
    try:
        rs = bs.query_history_k_data_plus(
            baostock_code,
            "date,time,code,open,high,low,close,volume,amount",
            start_date=start_date,
            end_date="",
            frequency="15",
            adjustflag="1",
        )
        if rs.error_code != "0":
            print(f"  query failed: {rs.error_msg}", file=sys.stderr)
            return (0, start_date)
    except Exception as e:
        print(f"  exception: {e}", file=sys.stderr)
        return (0, start_date)

    data_list = []
    while rs.next():
        data_list.append(rs.get_row_data())

    if not data_list:
        return (0, start_date)

    df = pd.DataFrame(data_list, columns=rs.fields)
    df = df[df["volume"].astype(float) > 0]

    df["tradeTime"] = df["time"].str[:12]
    df["tradeDate"] = df["date"].str.replace("-", "", regex=False)

    for col in ["open", "high", "low", "close", "volume", "amount"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df[["tradeDate", "tradeTime", "code", "open", "high", "low", "close", "volume", "amount"]]
    df = df.rename(columns={"code": "tsCode"})

    # 直接 upsert 到 DB
    conn = sqlite3.connect(DB_PATH)
    try:
        inserted = upsert_minute_candles(df, conn)
    finally:
        conn.close()

    return (inserted, start_date)


def main():
    stock_codes = get_configured_codes()
    print(f"[sync_15min_fetch] Configured stocks: {len(stock_codes)}", file=sys.stderr)

    if not stock_codes:
        print("[sync_15min_fetch] No stocks configured", file=sys.stderr)
        return

    baostock_codes = [to_baostock_code(code) for code in stock_codes]

    login()
    total = len(baostock_codes)
    fetched = 0
    skipped = 0
    failed = 0

    try:
        for i, baostock_code in enumerate(baostock_codes):
            inserted, start_date = fetch_and_upsert(baostock_code)

            if inserted > 0:
                fetched += 1
                print(f"[{i+1}/{total}] {baostock_code} OK: {inserted} rows from {start_date}", file=sys.stderr)
            else:
                skipped += 1
                print(f"[{i+1}/{total}] {baostock_code} SKIP: no new data", file=sys.stderr)

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
