# Stock Config 配置表实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `StockConfig` 配置表，控制 15min K 线只抓取配置中的股票，支持多用途扩展。

**Architecture:** Prisma model + SQLite，手动维护配置。抓取脚本拆分为 fetch（读配置抓 CSV）和 import（读配置写 DB）两层。

**Tech Stack:** Prisma (SQLite), Python (baostock)

---

## 文件结构

```
prisma/schema.prisma            # 修改：新增 StockConfig model
jobs/sync_15min_fetch.py       # 新建：读取配置抓 CSV
jobs/sync_15min_import.py      # 修改：读取配置决定导入哪些
jobs/sync_15min.py             # 不变：全量抓取脚本保留
```

---

## Task 1: 修改 Prisma Schema，新增 StockConfig model

**Files:**
- Modify: `prisma/schema.prisma`（在 `SyncLog` model 之前插入新 model）

- [ ] **Step 1: 添加 StockConfig model**

在 `SyncLog` model 前插入：

```prisma
model StockConfig {
  id        String   @id @default(cuid())
  stockCode String   // 格式: "600000.SH" / "000001.SZ"
  purpose   String   // "FIFTEEN_MIN" | "DAILY" | "REALTIME"
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now())

  @@unique([stockCode, purpose])
  @@index([enabled])
}
```

- [ ] **Step 2: 运行 Prisma migrate 生成迁移**

```bash
cd /Users/zhangguangguang/VSCodeProjects/stock-insight
npx prisma generate
```

- [ ] **Step 3: 验证 dev.db 中表已创建**

```bash
sqlite3 prisma/dev.db ".schema StockConfig"
```

预期输出包含 `CREATE TABLE "StockConfig" ...`

- [ ] **Step 4: 提交**

```bash
git add prisma/schema.prisma
git commit -m "feat: add StockConfig model for selective stock data fetching"
```

---

## Task 2: 新建 jobs/sync_15min_fetch.py

**Files:**
- Create: `jobs/sync_15min_fetch.py`

```python
#!/usr/bin/env python3
"""
15 分钟 K 线抓取脚本（配置驱动版）
入口: python jobs/sync_15min_fetch.py
依赖: pip install baostock pandas
从 StockConfig 读取 enabled=true + purpose=FIFTEEN_MIN 的股票，只抓取这些
"""
import baostock as bs
import pandas as pd
import time
import sys
import sqlite3
from pathlib import Path

OUT_DIR = Path(__file__).parent.parent / "data" / "15min"
OUT_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = Path(__file__).parent.parent / "prisma" / "dev.db"
START_DATE = "2023-05-07"
RECONNECT_EVERY = 500
SLEEP_INTERVAL = 0.1

# 内部格式 → Baostock 格式转换
def to_baostock_code(stock_code: str) -> str:
    # "600000.SH" → "sh.600000"
    symbol, market = stock_code.split(".")
    market_lower = market.lower()
    return f"{market_lower}.{symbol}"

def login():
    result = bs.login()
    if result.error_code != "0":
        raise RuntimeError(f"Baostock login failed: {result.error_msg}")

def logout():
    bs.logout()

def fetch_stock(baostock_code: str) -> pd.DataFrame | None:
    try:
        rs = bs.query_history_k_data_plus(
            baostock_code,
            "date,time,code,open,high,low,close,volume,amount",
            start_date=START_DATE,
            end_date="",
            frequency="15",
            adjustflag="1",
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
        df = df[df["volume"].astype(float) > 0]

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

def get_configured_codes() -> list[str]:
    """从 StockConfig 读取 enabled=true + purpose=FIFTEEN_MIN 的股票代码"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT stockCode FROM StockConfig
        WHERE enabled = 1 AND purpose = 'FIFTEEN_MIN'
    """)
    codes = [row[0] for row in cursor.fetchall()]
    conn.close()
    return codes

def main():
    codes = get_configured_codes()
    if not codes:
        print("[sync_15min_fetch] No stocks configured for FIFTEEN_MIN. Exiting.", file=sys.stderr)
        return

    print(f"[sync_15min_fetch] Configured stocks: {len(codes)}", file=sys.stderr)

    login()
    total = len(codes)
    done = 0

    try:
        for i, stock_code in enumerate(codes):
            baostock_code = to_baostock_code(stock_code)
            csv_path = OUT_DIR / f"{baostock_code}.csv"
            if csv_path.exists():
                done += 1
                continue

            df = fetch_stock(baostock_code)

            if df is not None and len(df) > 0:
                df.to_csv(csv_path, index=False)
                print(f"[{i+1}/{total}] {baostock_code} OK: {len(df)} rows", file=sys.stderr)
            else:
                csv_path.write_text("")
                print(f"[{i+1}/{total}] {baostock_code} SKIP: no data", file=sys.stderr)

            done += 1

            if done % RECONNECT_EVERY == 0:
                logout()
                login()
                print(f"[sync_15min_fetch] reconnected at {done}/{total}", file=sys.stderr)

            time.sleep(SLEEP_INTERVAL)

    finally:
        logout()

    print(f"[sync_15min_fetch] Done. CSV files in {OUT_DIR}", file=sys.stderr)

if __name__ == "__main__":
    main()
```

- [ ] **Step 1: 创建文件**

路径: `jobs/sync_15min_fetch.py`，内容如上。

- [ ] **Step 2: 提交**

```bash
git add jobs/sync_15min_fetch.py
git commit -m "feat: add config-driven 15min fetch script"
```

---

## Task 3: 修改 jobs/sync_15min_import.py

**Files:**
- Modify: `jobs/sync_15min_import.py`（读取配置，只导入配置中的股票）

- [ ] **Step 1: 读取现有代码，在 main() 前添加配置读取函数**

在 `DB_PATH` 定义后添加：

```python
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
```

- [ ] **Step 2: 修改 main() 函数，只处理配置中的 CSV**

将 `csv_files = list(CSV_DIR.glob("*.csv"))` 改为：

```python
configured_codes = get_configured_codes()
if not configured_codes:
    print("[sync_15min_import] No stocks configured for FIFTEEN_MIN. Exiting.", file=sys.stderr)
    return

all_csv = CSV_DIR.glob("*.csv")
# 只处理配置中存在的 CSV 文件
csv_files = [f for f in all_csv if f.stem in configured_codes]
```

- [ ] **Step 3: 验证修改**

```bash
grep -n "get_configured_codes\|configured_codes" jobs/sync_15min_import.py
```

- [ ] **Step 4: 提交**

```bash
git add jobs/sync_15min_import.py
git commit -m "feat: make 15min import respect StockConfig"
```

---

## Task 4: 验证完整流程

**Files:**
- Modify: `prisma/schema.prisma`, `jobs/sync_15min_fetch.py`, `jobs/sync_15min_import.py`

- [ ] **Step 1: 在 dev.db 中插入一条测试配置**

```bash
sqlite3 prisma/dev.db "INSERT INTO StockConfig (id, stockCode, purpose, enabled) VALUES ('ctest001', '600000.SH', 'FIFTEEN_MIN', 1);"
```

- [ ] **Step 2: 验证读取配置**

```bash
sqlite3 prisma/dev.db "SELECT * FROM StockConfig;"
```

预期输出包含 `600000.SH | FIFTEEN_MIN | 1`

- [ ] **Step 3: 验证 fetch 脚本能读取配置（不实际抓取，只验证读取不报错）**

```bash
cd /Users/zhangguangguang/VSCodeProjects/stock-insight
python -c "from jobs.sync_15min_fetch import get_configured_codes; print(get_configured_codes())"
```

预期输出 `['600000.SH']`

- [ ] **Step 4: 清理测试数据**

```bash
sqlite3 prisma/dev.db "DELETE FROM StockConfig WHERE id='ctest001';"
```

- [ ] **Step 5: 最终提交**

```bash
git add -A && git commit -m "chore: add StockConfig table and config-driven 15min fetch"
```

---

## 自检清单

- [ ] Schema 中 `@@unique([stockCode, purpose])` 防止重复
- [ ] `@@index([enabled])` 加速过滤查询
- [ ] `purpose` 存 String 而非 enum，后续可迁移
- [ ] fetch 和 import 脚本都能正确读取配置
- [ ] 全量抓取脚本 `sync_15min.py` 未改动，保留原功能
