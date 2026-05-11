#!/usr/bin/env python3
"""
选股策略：30分钟线 过去2天内创了新低，但MACD DIF和KD K线从最低点开始上升
数据来源：SQLite数据库 prisma/dev.db
"""
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys
import os

DB_PATH = os.environ.get("DATABASE_URL", "prisma/dev.db")
# DATABASE_URL格式: file:/path/to/dev.db 或 file:./prisma/dev.db
if DB_PATH.startswith("file:"):
    DB_PATH = DB_PATH[5:]  # 去掉 "file:" 前缀

# 获取所有股票代码
def get_stock_codes():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT tsCode FROM MinuteCandle ORDER BY tsCode")
    codes = [row[0] for row in cursor.fetchall()]
    conn.close()
    return codes


def get_15min_data(ts_code: str, days: int = 30) -> pd.DataFrame:
    """获取某股票最近N天的15分钟数据"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 计算日期范围
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
    """将15分钟K线聚合为30分钟K线"""
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
    """计算MACD指标"""
    df = df.copy()
    df["ema_fast"] = df["close"].ewm(span=fast, adjust=False).mean()
    df["ema_slow"] = df["close"].ewm(span=slow, adjust=False).mean()
    df["dif"] = df["ema_fast"] - df["ema_slow"]
    df["dea"] = df["dif"].ewm(span=signal, adjust=False).mean()
    df["macd"] = (df["dif"] - df["dea"]) * 2
    return df


def calc_kd(df: pd.DataFrame, n=9, m1=3, m2=3) -> pd.DataFrame:
    """计算KD指标"""
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


def find_low_rebound_v2(df: pd.DataFrame) -> list:
    """
    在30天数据中扫描所有可能的信号
    条件：最低点在数据的前80%位置（有20%数据用于回测）
    """
    if len(df) < 60:
        return []

    results = []
    # 只在前80%的数据中寻找信号，给后面20%留足够的回测空间
    cutoff_idx = int(len(df) * 0.80)
    search_df = df.iloc[:cutoff_idx]

    # 滑动窗口寻找信号：每次取16根30min K线（约2天）
    for i in range(len(search_df) - 16):
        window = df.iloc[i:i + 16].copy()
        if len(window) < 4:
            continue

        min_low_idx = window["low"].idxmin()
        min_low_pos = window.index.get_loc(min_low_idx)
        after_min = len(window) - min_low_pos - 1

        if after_min < 2:
            continue

        after_data = window.loc[min_low_idx:].iloc[1:]
        if len(after_data) < 2:
            continue

        # 检查DIF和K是否从最低点后持续上升
        dif_rising = all(after_data["dif"].iloc[j] >= after_data["dif"].iloc[j - 1] - 0.0001
                         for j in range(1, len(after_data)))
        k_rising = all(after_data["k"].iloc[j] >= after_data["k"].iloc[j - 1] - 0.5
                        for j in range(1, len(after_data)))

        dif_before = window.loc[min_low_idx, "dif"]
        k_before = window.loc[min_low_idx, "k"]
        dif_now = after_data["dif"].iloc[-1]
        k_now = after_data["k"].iloc[-1]

        if dif_rising and k_rising and dif_now > dif_before and k_now > k_before:
            results.append({
                "tsCode": df["tsCode"].iloc[-1],
                "minLow": round(window.loc[min_low_idx, "low"], 2),
                "minLowTime": window.loc[min_low_idx, "tradeTime"],
                "dif": f"{dif_before:.4f} -> {dif_now:.4f}",
                "k": f"{k_before:.2f} -> {k_now:.2f}",
                "difChange": f"+{dif_now - dif_before:.4f}",
                "kChange": f"+{k_now - k_before:.2f}",
                "signalIdx": min_low_idx,  # 用于回测计算
            })

    return results


def get_15min_data_for_backtest(ts_code: str, start_date: str) -> pd.DataFrame:
    """获取某股票从某个日期开始的15分钟数据（用于回测）"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT tradeDate, tradeTime, tsCode, open, high, low, close, volume, amount
        FROM MinuteCandle
        WHERE tsCode = ? AND tradeDate >= ?
        ORDER BY tradeTime
    """, (ts_code, start_date))

    rows = cursor.fetchall()
    conn.close()

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows, columns=["tradeDate", "tradeTime", "tsCode", "open", "high", "low", "close", "volume", "amount"])
    for col in ["open", "high", "low", "close", "volume", "amount"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def calc_future_return(df_30min: pd.DataFrame, signal_idx: int, days: int = 5) -> dict:
    """计算从信号点开始，未来N天的收益率"""
    if signal_idx >= len(df_30min) - 1:
        return None

    # 取最低点的收盘价作为买入价
    entry_price = df_30min.iloc[signal_idx]["close"]

    # 获取之后的数据
    df_future = df_30min.iloc[signal_idx + 1:].copy()
    if df_future.empty:
        return None

    # 聚合到日线
    df_future = df_future.copy()
    df_future["date"] = df_future["tradeTime"].str[:8]

    daily = df_future.groupby("date").agg({
        "open": "first",
        "high": "max",
        "low": "min",
        "close": "last",
        "volume": "sum"
    }).reset_index()

    if daily.empty:
        return None

    # 计算未来N天的涨跌幅
    if len(daily) >= days:
        future_close = daily.iloc[days - 1]["close"]
        total_return = (future_close - entry_price) / entry_price * 100
        max_high = daily.iloc[:days]["high"].max()
        max_return = (max_high - entry_price) / entry_price * 100
    else:
        total_return = (daily.iloc[-1]["close"] - entry_price) / entry_price * 100
        max_high = daily["high"].max()
        max_return = (max_high - entry_price) / entry_price * 100

    return {
        "entryPrice": round(entry_price, 2),
        "future3dClose": round(daily.iloc[min(2, len(daily)-1)]["close"], 2) if len(daily) >= 3 else None,
        "future5dClose": round(daily.iloc[min(4, len(daily)-1)]["close"], 2) if len(daily) >= 5 else None,
        "return3d": round(total_return, 2) if len(daily) >= 3 else None,
        "return5d": round((daily.iloc[min(4, len(daily)-1)]["close"] - entry_price) / entry_price * 100, 2) if len(daily) >= 5 else None,
        "maxReturn": round(max_return, 2),
    }


def main():
    print("正在获取股票列表...", file=sys.stderr)
    codes = get_stock_codes()
    print(f"共 {len(codes)} 只股票", file=sys.stderr)

    results = []
    for i, code in enumerate(codes):
        try:
            df = get_15min_data(code, days=30)
            if df.empty or len(df) < 60:
                continue

            df = df[df["volume"] > 0]
            if len(df) < 60:
                continue

            df_30min = aggregate_to_30min(df)
            if len(df_30min) < 30:
                continue

            df_30min = calc_macd(df_30min)
            df_30min = calc_kd(df_30min)

            signals = find_low_rebound_v2(df_30min)
            for sig in signals:
                backtest = calc_future_return(df_30min, sig["signalIdx"], days=5)
                if backtest and backtest.get('return5d') is not None:
                    sig.update(backtest)
                    results.append(sig)
                    print(f"[{i+1}/{len(codes)}] ✓ {sig['tsCode']} @ {sig['minLowTime']} | 买入:{backtest['entryPrice']} | 3日:{backtest.get('return3d','N/A')}% | 5日:{backtest.get('return5d','N/A')}% | 最高:{backtest.get('maxReturn','N/A')}%")

        except Exception as e:
            pass

        if (i + 1) % 50 == 0:
            print(f"已处理 {i+1}/{len(codes)}", file=sys.stderr)

    print(f"\n{'='*120}")
    print(f"共找到 {len(results)} 个有效信号（均有完整5日回测数据）")
    print(f"{'='*120}")

    # 按5日涨幅排序
    results.sort(key=lambda x: x.get('return5d') or 0, reverse=True)

    print(f"\n{'代码':<12} {'信号日期':>10} {'最低价':>10} {'买入价':>10} {'3日涨幅':>10} {'5日涨幅':>10} {'最高涨幅':>10}")
    print(f"{'-'*120}")

    for r in results:
        print(f"{r['tsCode']:<12} {r['minLowTime'][:8]:>10} {r['minLow']:>10} {r.get('entryPrice', 'N/A'):>10} {r.get('return3d', 'N/A'):>10} {r.get('return5d', 'N/A'):>10} {r.get('maxReturn', 'N/A'):>10}")

    # 统计
    if results:
        valid_3d = [r for r in results if r.get('return3d') is not None]
        valid_5d = [r for r in results if r.get('return5d') is not None]

        avg_3d = sum(r['return3d'] for r in valid_3d) / len(valid_3d)
        win_rate_3d = len([r for r in valid_3d if r['return3d'] > 0]) / len(valid_3d) * 100

        avg_5d = sum(r['return5d'] for r in valid_5d) / len(valid_5d)
        win_rate_5d = len([r for r in valid_5d if r['return5d'] > 0]) / len(valid_5d) * 100

        print(f"\n{'='*60}")
        print(f"策略回测统计 (共{len(results)}个样本)")
        print(f"{'='*60}")
        print(f"3日策略: 平均涨幅 {avg_3d:+.2f}%, 胜率 {win_rate_3d:.1f}%")
        print(f"5日策略: 平均涨幅 {avg_5d:+.2f}%, 胜率 {win_rate_5d:.1f}%")


if __name__ == "__main__":
    main()