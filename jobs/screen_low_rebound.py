#!/usr/bin/env python3
"""
选股策略：30分钟线 底背离 + 反弹
条件：MACD DIF 和 KDJ J 同时底背离
  - MACD底背离: 当前最低价 = N天内最低价 AND DIF > N天内DIF最低价的前一值
  - KD底背离:  当前最低价 = N天内最低价 AND J   > N天内J最低价的前一值
  - 双底背离: MACD底背离 AND KD底背离
数据来源：SQLite数据库 prisma/dev.db
"""
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys

DB_PATH = "prisma/dev.db"

N = 20  # 背离窗口


def get_stock_codes():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT tsCode FROM MinuteCandle ORDER BY tsCode")
    codes = [row[0] for row in cursor.fetchall()]
    conn.close()
    return codes


def get_15min_data(ts_code: str, days: int = 60) -> pd.DataFrame:
    """获取某股票最近N天的15分钟数据"""
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
    """将15分钟K线聚合为30分钟K线"""
    if df.empty:
        return pd.DataFrame()

    df = df.sort_values("tradeTime").reset_index(drop=True)
    result_list = []

    for i in range(0, len(df) - 1, 2):
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


def calc_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """计算 MACD(12,26,9) + KDJ(21,3,3)"""
    df = df.copy().reset_index(drop=True)

    # MACD: DIF = EMA(CLOSE,12) - EMA(CLOSE,26), DEA = EMA(DIF,9)
    df["ema12"] = df["close"].ewm(span=12, adjust=False).mean()
    df["ema26"] = df["close"].ewm(span=26, adjust=False).mean()
    df["dif"] = df["ema12"] - df["ema26"]
    df["dea"] = df["dif"].ewm(span=9, adjust=False).mean()

    # KDJ: RSV = (CLOSE - LLV(LOW,21)) / (HHV(HIGH,21) - LLV(LOW,21)) * 100
    # K = SMA(RSV, 3, 1) = 2/3*RSV + 1/3*K_prev, 即 alpha=2/3
    low21 = df["low"].rolling(window=21, min_periods=1).min()
    high21 = df["high"].rolling(window=21, min_periods=1).max()
    denominator = high21 - low21
    denominator = denominator.replace(0, np.nan)
    rsv = (df["close"] - low21) / denominator * 100
    rsv = rsv.fillna(50)

    # K = SMA(RSV, 3, 1): alpha = 1/3
    df["k"] = rsv.ewm(alpha=1/3, adjust=False).mean()
    # D = SMA(K, 3, 1): alpha = 1/3
    df["d"] = df["k"].ewm(alpha=1/3, adjust=False).mean()
    df["j"] = 3 * df["k"] - 2 * df["d"]

    return df


def find_bottom_divergence(df: pd.DataFrame) -> list:
    """
    底背离信号：
      MACD底背离: L = LLV(L,N) AND DIF > REF(LLV(DIF,N), 1)
      KD底背离:   L = LLV(L,N) AND J   > REF(LLV(J,  N), 1)
      双底背离:   MACD底背离 AND KD底背离
    """
    if len(df) < N + 2:
        return []

    results = []

    for i in range(N, len(df)):
        cur = df.iloc[i]
        cur_low = cur["low"]
        cur_dif = cur["dif"]
        cur_j = cur["j"]

        # N天内最低价
        window = df.iloc[i - N + 1:i + 1]
        ll_l = window["low"].min()

        # 当前K线是否创N天内最低价
        if cur_low != ll_l:
            continue

        # LL_DIF = LLV(DIF, N): N天内DIF最低值
        ll_dif = window["dif"].min()
        # REF(LLV(DIF,N), 1): N天内DIF最低值的前一bar的DIF
        # 在window中，N天内DIF最低值出现的位置
        ll_dif_idx = window["dif"].idxmin()
        ll_dif_pos = window.index.get_loc(ll_dif_idx)

        # REF(LLV(DIF,N), 1) = 最低点那根的前一根DIF
        # 如果最低点就是第一根，则取第一根的DIF
        if ll_dif_pos > 0:
            ref_ll_dif = window.iloc[ll_dif_pos - 1]["dif"]
        else:
            ref_ll_dif = window.iloc[0]["dif"]

        # 同样算J
        ll_j = window["j"].min()
        ll_j_idx = window["j"].idxmin()
        ll_j_pos = window.index.get_loc(ll_j_idx)

        if ll_j_pos > 0:
            ref_ll_j = window.iloc[ll_j_pos - 1]["j"]
        else:
            ref_ll_j = window.iloc[0]["j"]

        macd_div = cur_dif > ref_ll_dif
        kd_div = cur_j > ref_ll_j

        if macd_div and kd_div:
            results.append({
                "tsCode": cur["tsCode"],
                "signalTime": cur["tradeTime"],
                "minLow": round(cur_low, 2),
                "minLowTime": window.iloc[ll_dif_pos]["tradeTime"],
                "dif": f"{ref_ll_dif:.4f} -> {cur_dif:.4f}",
                "j": f"{ref_ll_j:.2f} -> {cur_j:.2f}",
                "signalIdx": i,
            })

    return results


def calc_future_return(df_30min: pd.DataFrame, signal_idx: int, days: int = 5) -> dict:
    """计算从信号点开始，未来N天的收益率"""
    if signal_idx >= len(df_30min) - 1:
        return None

    entry_price = df_30min.iloc[signal_idx]["close"]
    df_future = df_30min.iloc[signal_idx + 1:].copy()
    if df_future.empty:
        return None

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
        "return3d": round((daily.iloc[min(2, len(daily)-1)]["close"] - entry_price) / entry_price * 100, 2) if len(daily) >= 3 else None,
        "return5d": round(total_return, 2) if len(daily) >= 5 else None,
        "maxReturn": round(max_return, 2),
    }


def main():
    print("正在获取股票列表...", file=sys.stderr)
    codes = get_stock_codes()
    print(f"共 {len(codes)} 只股票", file=sys.stderr)

    results = []
    for i, code in enumerate(codes):
        try:
            df = get_15min_data(code, days=60)
            if df.empty or len(df) < N + 5:
                continue

            df = df[df["volume"] > 0]
            if len(df) < N + 5:
                continue

            df_30min = aggregate_to_30min(df)
            if len(df_30min) < N + 5:
                continue

            df_30min = calc_indicators(df_30min)
            signals = find_bottom_divergence(df_30min)

            for sig in signals:
                backtest = calc_future_return(df_30min, sig["signalIdx"], days=5)
                if backtest and backtest.get('return5d') is not None:
                    sig.update(backtest)
                    results.append(sig)
                    print(f"[{i+1}/{len(codes)}] ✓ {sig['tsCode']} @{sig['signalTime']} | 最低:{sig['minLow']}@{sig['minLowTime']} | DIF:{sig['dif']} | J:{sig['j']} | 买入:{backtest['entryPrice']} | 3日:{backtest.get('return3d','N/A')}% | 5日:{backtest.get('return5d','N/A')}% | 最高:{backtest.get('maxReturn','N/A')}%")

        except Exception:
            pass

        if (i + 1) % 50 == 0:
            print(f"已处理 {i+1}/{len(codes)}", file=sys.stderr)

    print(f"\n{'='*120}")
    print(f"共找到 {len(results)} 个有效信号")
    print(f"{'='*120}")

    results.sort(key=lambda x: x.get('return5d') or 0, reverse=True)

    print(f"\n{'代码':<12} {'信号时间':>14} {'最低价':>10} {'买入价':>10} {'3日涨幅':>10} {'5日涨幅':>10} {'最高涨幅':>10}")
    print(f"{'-'*120}")

    for r in results:
        print(f"{r['tsCode']:<12} {r['signalTime']:>14} {r['minLow']:>10} {r.get('entryPrice', 'N/A'):>10} {r.get('return3d', 'N/A'):>10} {r.get('return5d', 'N/A'):>10} {r.get('maxReturn', 'N/A'):>10}")

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
