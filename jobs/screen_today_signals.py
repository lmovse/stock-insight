#!/usr/bin/env python3
"""
当日信号检测脚本 - 只检测信号，不回测
用法: python jobs/screen_today_signals.py
"""
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys
import json
import argparse

DB_PATH = "prisma/dev.db"


def get_stock_codes():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT tsCode FROM MinuteCandle ORDER BY tsCode")
    codes = [row[0] for row in cursor.fetchall()]
    conn.close()
    return codes


def get_15min_data(ts_code: str, days: int = 10) -> pd.DataFrame:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    end_date = datetime.now().strftime("%Y%m%d")
    start_date = (datetime.now() - timedelta(days=days)).strftime("%Y%m%d")
    cursor.execute("""
        SELECT tradeDate, tradeTime, tsCode, open, high, low, close, volume, amount
        FROM MinuteCandle
        WHERE tsCode = ? AND tradeDate >= ? AND tradeDate <= ?
        ORDER BY tradeTime
    """, (ts_code, start_date, end_date))
    rows = cursor.fetchall()
    conn.close()
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows, columns=["tradeDate", "tradeTime", "tsCode", "open", "high", "low", "close", "volume", "amount"])
    for col in ["open", "high", "low", "close", "volume", "amount"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def aggregate_to_30min(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame()
    df = df.sort_values("tradeTime").reset_index(drop=True)
    n = len(df)
    result_list = []
    for i in range(0, n - 1, 2):
        row1 = df.iloc[i]
        row2 = df.iloc[i + 1]
        result_list.append({
            "tradeDate": row1["tradeDate"],
            "tradeTime": row1["tradeTime"],
            "tsCode": row1["tsCode"],
            "open": row1["open"],
            "high": max(row1["high"], row2["high"]),
            "low": min(row1["low"], row2["low"]),
            "close": row2["close"],
            "volume": row1["volume"] + row2["volume"],
            "amount": row1["amount"] + row2["amount"],
        })
    return pd.DataFrame(result_list)


def calc_macd(df: pd.DataFrame, fast=12, slow=26, signal=9) -> pd.DataFrame:
    df = df.copy()
    df["ema_fast"] = df["close"].ewm(span=fast, adjust=False).mean()
    df["ema_slow"] = df["close"].ewm(span=slow, adjust=False).mean()
    df["dif"] = df["ema_fast"] - df["ema_slow"]
    df["dea"] = df["dif"].ewm(span=signal, adjust=False).mean()
    df["macd"] = (df["dif"] - df["dea"]) * 2
    return df


def calc_kd(df: pd.DataFrame, n=9, m1=3, m2=3) -> pd.DataFrame:
    df = df.copy()
    low_n = df["low"].rolling(window=n, min_periods=1).min()
    high_n = df["high"].rolling(window=n, min_periods=1).max()
    denominator = high_n - low_n
    denominator = denominator.replace(0, np.nan)
    rsv = (df["close"] - low_n) / denominator * 100
    rsv = rsv.fillna(50)
    df["k"] = rsv.ewm(com=m1 - 1, adjust=False).mean()
    df["d"] = df["k"].ewm(com=m2 - 1, adjust=False).mean()
    return df


def find_today_signal(df_30min: pd.DataFrame, today: str) -> dict | None:
    """
    检测是否有当日信号
    条件：过去2天（16根30min K线）内创了新低，之后DIF和K持续上升
    """
    if len(df_30min) < 16:
        return None

    # 取最后16根K线
    recent = df_30min.tail(16).copy()
    if len(recent) < 4:
        return None

    # 找到最低价位置
    min_low_idx = recent["low"].idxmin()
    min_low_pos = recent.index.get_loc(min_low_idx)
    after_min = len(recent) - min_low_pos - 1

    # 需要至少有2根K线在最低点之后
    if after_min < 2:
        return None

    after_data = recent.loc[min_low_idx:].iloc[1:]
    if len(after_data) < 2:
        return None

    # 检查最低点是否在今天
    min_low_time = recent.loc[min_low_idx, "tradeTime"]
    if not min_low_time.startswith(today):
        return None

    # 检查DIF和K是否从最低点后持续上升
    dif_rising = all(after_data["dif"].iloc[j] >= after_data["dif"].iloc[j - 1] - 0.0001
                      for j in range(1, len(after_data)))
    k_rising = all(after_data["k"].iloc[j] >= after_data["k"].iloc[j - 1] - 0.5
                    for j in range(1, len(after_data)))

    dif_before = recent.loc[min_low_idx, "dif"]
    k_before = recent.loc[min_low_idx, "k"]
    dif_now = after_data["dif"].iloc[-1]
    k_now = after_data["k"].iloc[-1]

    if dif_rising and k_rising and dif_now > dif_before and k_now > k_before:
        return {
            "tsCode": df_30min["tsCode"].iloc[-1],
            "minLow": round(recent.loc[min_low_idx, "low"], 2),
            "minLowTime": min_low_time,
            "difBefore": round(dif_before, 4),
            "difNow": round(dif_now, 4),
            "difChange": round(dif_now - dif_before, 4),
            "kBefore": round(k_before, 2),
            "kNow": round(k_now, 2),
            "kChange": round(k_now - k_before, 2),
            "currentPrice": round(after_data["close"].iloc[-1], 2),
        }
    return None


def main():
    parser = argparse.ArgumentParser(description="当日信号检测脚本")
    parser.add_argument("--date", type=str, required=True, help="日期，如 20260522")
    args = parser.parse_args()

    today = args.date if args.date else datetime.now().strftime("%Y%m%d")
    print(f"检测日期: {today}", file=sys.stderr)

    codes = get_stock_codes()
    print(f"共 {len(codes)} 只股票", file=sys.stderr)

    signals = []
    for i, code in enumerate(codes):
        try:
            df = get_15min_data(code, days=10)
            if df.empty or len(df) < 60:
                continue

            df = df[df["volume"] > 0]
            if len(df) < 60:
                continue

            df_30min = aggregate_to_30min(df)
            if len(df_30min) < 16:
                continue

            df_30min = calc_macd(df_30min)
            df_30min = calc_kd(df_30min)

            signal = find_today_signal(df_30min, today)
            if signal:
                signals.append(signal)

        except Exception:
            pass

        if (i + 1) % 50 == 0:
            print(f"已处理 {i+1}/{len(codes)}", file=sys.stderr)

    result = {
        "success": True,
        "date": today,
        "count": len(signals),
        "data": signals,
        "summary": f"共找到 {len(signals)} 个信号"
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()