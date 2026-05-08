#!/usr/bin/env python3
"""
15 分钟 K 线 CSV 批量导入 SQLite
入口: python jobs/sync_15min_import.py
依赖: pip install pandas
"""
import csv
import sys
import sqlite3
import uuid
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "prisma" / "dev.db"
CSV_DIR = Path(__file__).parent.parent / "data" / "15min"


def get_configured_codes() -> list[str]:
    """从 StockConfig 读取 enabled=true + purpose=FIFTEEN_MIN 的股票，转换回 Baostock 格式"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT stockCode FROM StockConfig
        WHERE enabled = 1 AND purpose = 'FIFTEEN_MIN'
    """)
    codes = [row[0] for row in cursor.fetchall()]
    conn.close()
    # 内部格式 "600000.SH" → Baostock 格式 "sh.600000"
    return [f"{code.split('.')[1].lower()}.{code.split('.')[0].lower()}" for code in codes]


def cuid() -> str:
    # 使用 uuid4 截断生成唯一 ID，格式类似 Prisma cuid
    u = uuid.uuid4().hex
    return f"c{u[:24]}"


def import_csv(csv_path: Path, conn: sqlite3.Connection) -> int:
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            rows.append((
                cuid(),
                row["tsCode"],
                row["tradeDate"],
                row["tradeTime"],
                float(row["open"]),
                float(row["high"]),
                float(row["low"]),
                float(row["close"]),
                float(row["volume"]),
                float(row["amount"]) if row.get("amount") else None,
                "1",  # adjustFlag=后复权
            ))

    if not rows:
        return 0

    cursor = conn.cursor()
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


def main():
    if not CSV_DIR.exists():
        print(f"[sync_15min_import] CSV dir not found: {CSV_DIR}", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    total_imported = 0
    total_files = 0

    configured_codes = get_configured_codes()
    if not configured_codes:
        print("[sync_15min_import] No stocks configured for FIFTEEN_MIN. Exiting.", file=sys.stderr)
        return

    all_csv = CSV_DIR.glob("*.csv")
    # 只处理配置中存在的 CSV 文件
    csv_files = [f for f in all_csv if f.stem in configured_codes]
    print(f"[sync_15min_import] {len(csv_files)} CSV files found", file=sys.stderr)

    for csv_path in csv_files:
        if csv_path.stat().st_size == 0:
            continue
        try:
            n = import_csv(csv_path, conn)
            total_imported += n
            total_files += 1
            print(f"  {csv_path.name}: {n} rows", file=sys.stderr)
        except Exception as e:
            print(f"  {csv_path.name} FAILED: {e}", file=sys.stderr)

    conn.close()
    print(f"[sync_15min_import] Done. {total_files} files, {total_imported} total rows imported", file=sys.stderr)


if __name__ == "__main__":
    main()
