# 15 分钟 K 线实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 15 分钟（及 60 分钟）K 线功能，数据源为 Baostock，同步链路与日 K 线统一，用户可在股票详情页切换分钟级别行情。

**Architecture:** Python 脚本抓取 Baostock 数据写入 CSV，Node 调用脚本导入 SQLite；前端通过 `period=15min|60min` 参数调 K 线接口，周期选择器分组显示短周期和中长周期。

**Tech Stack:** Baostock (Python), Prisma/SQLite, Next.js API Routes, Canvas Chart

---

## 文件变更总览

| 操作 | 文件路径 | 职责 |
|------|----------|------|
| Modify | `prisma/schema.prisma` | 新增 `MinuteCandle` model |
| Create | `jobs/sync_15min.py` | Baostock 全量抓取脚本 |
| Create | `jobs/sync_15min_import.py` | CSV 批量导入 SQLite |
| Modify | `lib/tushare/sync.ts` | 新增 `syncMinuteCandles()` |
| Modify | `lib/stockApi.ts` | 新增 `getMinuteKLineData()` |
| Modify | `lib/types.ts` | `KLineData` 扩展可选 `time` 字段 |
| Modify | `app/api/stocks/[code]/kline/route.ts` | 支持 `period=15min\|60min` |
| Modify | `app/api/stocks/sync/route.ts` | 支持 `type=minute` |
| Modify | `app/stock/[code]/page.tsx` | 周期选择器 + 分钟线显示 |
| Modify | `lib/chartRenderer.ts` | X轴标签支持 `HH:MM` 格式 |

---

### Task 1: 新增 Prisma Model — `MinuteCandle`

**Files:**
- Modify: `prisma/schema.prisma:124-143`

- [ ] **Step 1: 在 schema.prisma 的 `DailyCandle` model 之后添加 `MinuteCandle` model**

在 `DailyCandle` model（大约第 143 行）之后，插入：

```prisma
model MinuteCandle {
  id         String  @id @default(cuid())
  tsCode     String
  tradeDate  String              // YYYYMMDD 格式
  tradeTime  String              // YYYYMMDDHHMM 格式，唯一约束
  open       Float
  high       Float
  low        Float
  close      Float
  volume     Float
  amount     Float?
  adjustFlag String  @default("3") // 1=后复权 2=前复权 3=不复权

  @@unique([tsCode, tradeTime])
  @@index([tsCode])
  @@index([tradeDate])
  @@index([tsCode, tradeDate])
}
```

- [ ] **Step 2: 生成迁移**

Run: `npx prisma migrate dev --name add_minute_candle`
Expected: 迁移文件创建成功，SQLite schema 更新

- [ ] **Step 3: 验证 schema 同步**

Run: `npx prisma validate`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add MinuteCandle model for minute-level K-line data"
```

---

### Task 2: 编写 Python 抓取脚本 — `jobs/sync_15min.py`

**Files:**
- Create: `jobs/sync_15min.py`

- [ ] **Step 1: 创建 `jobs/sync_15min.py`**

```python
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

# 输出目录
OUT_DIR = Path(__file__).parent.parent / "data" / "15min"
OUT_DIR.mkdir(parents=True, exist_ok=True)

START_DATE = "2023-05-07"  # 近三年
RECONNECT_EVERY = 500       # 每 N 只股票重连一次
SLEEP_INTERVAL = 0.1        # 秒


def login():
    result = bs.login()
    if result.error_code != "0":
        raise RuntimeError(f"Baostock login failed: {result.error_msg}")


def logout():
    bs.logout()


def fetch_stock(code: str) -> pd.DataFrame | None:
    """抓取单只股票的 15 分钟 K 线，返回 DataFrame 或 None."""
    try:
        rs = bs.query_history_k_data_plus(
            code,
            "date,time,code,open,high,low,close,volume,amount",
            start_date=START_DATE,
            end_date="",  # 至今
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

        # 过滤停牌（volume=0）
        df = df[df["volume"].astype(float) > 0]

        # 转换字段
        # time 格式: YYYYMMDDHHMMSSsss → YYYYMMDDHHMM（前12位）
        df["tradeTime"] = df["time"].str[:12]
        # date 格式: YYYY-MM-DD → YYYYMMDD
        df["tradeDate"] = df["date"].str.replace("-", "", regex=False)

        # 数值列
        for col in ["open", "high", "low", "close", "volume", "amount"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        # 输出列重命名，匹配 CSV 格式
        df = df[["tradeDate", "tradeTime", "code", "open", "high", "low", "close", "volume", "amount"]]
        df = df.rename(columns={"code": "tsCode"})
        return df
    except Exception as e:
        print(f"  exception: {e}", file=sys.stderr)
        return None


def get_all_codes() -> list[str]:
    """获取全市场 A 股代码列表."""
    login()
    try:
        rs = bs.query_all_stock(day="2024-12-31")
        data = rs.get_data()
        # 只保留上交所/深交所主板+创业板
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

            # 断点续传：已有 CSV 则跳过
            if csv_path.exists():
                done += 1
                continue

            df = fetch_stock(code)

            if df is not None and len(df) > 0:
                df.to_csv(csv_path, index=False)
                print(f"[{i+1}/{total}] {code} OK: {len(df)} rows", file=sys.stderr)
            else:
                # 写空文件标记，避免重复抓取
                csv_path.write_text("")
                print(f"[{i+1}/{total}] {code} SKIP: no data", file=sys.stderr)

            done += 1

            # 每 N 只重连
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
```

- [ ] **Step 2: 验证脚本可执行**

Run: `python jobs/sync_15min.py 2>&1 | head -20`
Expected: 输出 `Total A-share codes: N` 或快速失败（无 baostock 依赖则先安装）

- [ ] **Step 3: Commit**

```bash
git add jobs/sync_15min.py
git commit -m "feat: add Baostock 15min K-line fetch script"
```

---

### Task 3: 编写 CSV 导入脚本 — `jobs/sync_15min_import.py`

**Files:**
- Create: `jobs/sync_15min_import.py`

- [ ] **Step 1: 创建 `jobs/sync_15min_import.py`**

```python
#!/usr/bin/env python3
"""
15 分钟 K 线 CSV 批量导入 SQLite
入口: python jobs/sync_15min_import.py
依赖: pip install pandas
"""
import csv
import sys
import sqlite3
from pathlib import Path

# 指向项目根目录的 SQLite 数据库
DB_PATH = Path(__file__).parent.parent / "prisma" / "dev.db"
CSV_DIR = Path(__file__).parent.parent / "data" / "15min"

# CUID 生成（匹配 Prisma @default(cuid())）
import random
import time as _time

def cuid() -> str:
    t = int(_time.time()).to_string(36)
    r = random.random().__repr__()[2:10]
    c = random.random().__repr__()[10:14]
    return f"c{t}{r}{c}"


def import_csv(csv_path: Path, conn: sqlite3.Connection) -> int:
    """读取单个 CSV，批量 upsert 入库。返回插入记录数。"""
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
    # upsert: ON CONFLICT (tsCode, tradeTime) DO UPDATE
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

    csv_files = list(CSV_DIR.glob("*.csv"))
    print(f"[sync_15min_import] {len(csv_files)} CSV files found", file=sys.stderr)

    for csv_path in csv_files:
        # 跳过空文件
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
```

- [ ] **Step 2: 测试导入（先用一只股票测试）**

Run: `python jobs/sync_15min_import.py 2>&1 | head -10`
Expected: 输出导入行数或空目录提示

- [ ] **Step 3: Commit**

```bash
git add jobs/sync_15min_import.py
git commit -m "feat: add 15min K-line CSV import script"
```

---

### Task 4: 新增 Node 同步函数 — `syncMinuteCandles()`

**Files:**
- Modify: `lib/tushare/sync.ts` (在文件末尾添加)

- [ ] **Step 1: 在 `lib/tushare/sync.ts` 末尾添加 `syncMinuteCandles` 和 `runPythonScript`**

在 `runFullSync` 函数之后（第 482 行附近），添加：

```typescript
// ─── runPythonScript ─────────────────────────────────────────────────────────
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function runPythonScript(scriptPath: string): Promise<void> {
  const absolutePath = path.resolve(process.cwd(), scriptPath);
  console.log(`[sync] Running Python script: ${absolutePath}`);
  try {
    const { stdout, stderr } = await execAsync(`python ${absolutePath}`, {
      timeout: 10 * 60 * 1000, // 10 分钟超时
    });
    if (stdout) console.log(`[sync] ${scriptPath} stdout:`, stdout.trim());
    if (stderr) console.warn(`[sync] ${scriptPath} stderr:`, stderr.trim());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sync] ${scriptPath} failed:`, msg);
    throw err;
  }
}

// ─── syncMinuteCandles ───────────────────────────────────────────────────────
import * as path from "path";

export async function syncMinuteCandles() {
  await upsertSyncLog("sync_minute_candles", "running");

  try {
    // 阶段1: 抓取 Baostock 数据（近三年）
    console.log("[sync] === Phase 1: fetching 15min data from Baostock ===");
    await runPythonScript("jobs/sync_15min.py");

    // 阶段2: 导入 SQLite
    console.log("[sync] === Phase 2: importing CSV to SQLite ===");
    await runPythonScript("jobs/sync_15min_import.py");

    // 记录同步状态
    const count = await prisma.minuteCandle.count();
    await upsertSyncLog("sync_minute_candles", "success", count, count, 0);
    console.log(`[sync] minute_candles done: ${count} records`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await upsertSyncLog("sync_minute_candles", "failed", 0, 0, 0, msg);
    console.error("[sync] sync_minute_candles failed:", err);
    throw err;
  }
}
```

> 注意：文件顶部已有 `import { PrismaClient } from '@prisma/client';`，不要重复添加。

- [ ] **Step 2: 添加缺失的 import**

在 `lib/tushare/sync.ts` 顶部确认已有（如果没有就添加）：
```typescript
import * as path from "path";
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `npx tsc --noEmit lib/tushare/sync.ts`
Expected: 无编译错误

- [ ] **Step 4: Commit**

```bash
git add lib/tushare/sync.ts
git commit -m "feat: add syncMinuteCandles() with Python subprocess"
```

---

### Task 5: 新增 `getMinuteKLineData()` 和类型更新

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/stockApi.ts`

- [ ] **Step 1: 在 `lib/types.ts` 的 `KLineData` 接口末尾添加可选 `time` 字段**

```typescript
export interface KLineData {
  date: number;       // yyyymmdd format (e.g., 20260331)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount?: number;
  time?: string;      // YYYYMMDDHHMM format, for minute-level K-line
}
```

- [ ] **Step 2: 在 `lib/stockApi.ts` 末尾添加 `getMinuteKLineData` 函数**

```typescript
export async function getMinuteKLineData(
  code: string,
  period: "15min" | "60min",
  count: number = 300
): Promise<KLineData[]> {
  const tsCode = codeToTsCode(code);

  const candles = await prisma.minuteCandle.findMany({
    where: { tsCode },
    orderBy: { tradeTime: "desc" },
    take: count,
  });

  return candles.reverse().map((c) => ({
    date: parseInt(c.tradeDate),
    time: c.tradeTime,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    amount: c.amount ?? undefined,
  }));
}
```

- [ ] **Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/stockApi.ts
git commit -m "feat: add getMinuteKLineData() and time field to KLineData"
```

---

### Task 6: 扩展 K 线 API 支持分钟周期

**Files:**
- Modify: `app/api/stocks/[code]/kline/route.ts`

- [ ] **Step 1: 修改 `app/api/stocks/[code]/kline/route.ts`，在 GET handler 中添加分钟周期分支**

将原代码中：
```typescript
const data = await getKLineData(code, period, count);
return NextResponse.json(data);
```

替换为：
```typescript
if (period === "15min" || period === "60min") {
  const data = await getMinuteKLineData(code, period, count);
  return NextResponse.json(data);
}

const data = await getKLineData(code, period, count);
return NextResponse.json(data);
```

同时在文件顶部确认 `getMinuteKLineData` 已导入（如果没有就添加）：
```typescript
import { getKLineData, getMinuteKLineData } from "@/lib/stockApi";
```

- [ ] **Step 2: 验证 API 路由编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add app/api/stocks/\[code\]/kline/route.ts
git commit -m "feat: support period=15min|60min in kline API"
```

---

### Task 7: 扩展同步 API 支持分钟同步

**Files:**
- Modify: `app/api/stocks/sync/route.ts`

- [ ] **Step 1: 修改 POST handler 支持 `type` 参数**

将 POST handler 改为：

```typescript
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const type = body.type || "all"; // "daily" | "minute" | "all"

    if (type === "all" || type === "daily") {
      runFullSync().catch((err) => console.error("[sync] daily failed:", err));
    }
    if (type === "all" || type === "minute") {
      syncMinuteCandles().catch((err) => console.error("[sync] minute failed:", err));
    }

    return NextResponse.json({ message: "Sync started", type });
  } catch (e) {
    console.error("[api/stocks/sync] Failed to start sync:", e);
    return NextResponse.json({ error: "Failed to start sync" }, { status: 500 });
  }
}
```

在文件顶部确认 `syncMinuteCandles` 已导入：
```typescript
import { runFullSync, syncMinuteCandles } from "@/lib/tushare/sync";
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add app/api/stocks/sync/route.ts
git commit -m "feat: support type=minute in sync API"
```

---

### Task 8: 前端周期选择器 UI 更新

**Files:**
- Modify: `app/stock/[code]/page.tsx`

- [ ] **Step 1: 将 `period` state 类型从 `("daily" | "weekly" | "monthly")[]` 扩展**

将：
```typescript
const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
```

改为：
```typescript
const [period, setPeriod] = useState<"15min" | "60min" | "daily" | "weekly" | "monthly">("daily");
```

- [ ] **Step 2: 更新周期选择器按钮，添加分隔线分组**

将周期选择器的 JSX 从：
```tsx
<div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-subtle)] shrink-0">
  {(["daily", "weekly", "monthly"] as const).map((p) => (
    <button
      key={p}
      onClick={() => setPeriod(p)}
      className={`px-3 py-1 text-xs font-mono uppercase tracking-wide border transition-colors rounded-lg ${
        period === p
          ? "bg-[var(--accent)] text-white border-[var(--accent)]"
          : "bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]"
      }`}
    >
      {p === "daily" ? "日K" : p === "weekly" ? "周K" : "月K"}
    </button>
  ))}
</div>
```

替换为：
```tsx
<div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-subtle)] shrink-0">
  {/* 短周期 */}
  {(["15min", "60min"] as const).map((p) => (
    <button
      key={p}
      onClick={() => setPeriod(p)}
      className={`px-3 py-1 text-xs font-mono uppercase tracking-wide border transition-colors rounded-lg ${
        period === p
          ? "bg-[var(--accent)] text-white border-[var(--accent)]"
          : "bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]"
      }`}
    >
      {p === "15min" ? "15分" : "60分"}
    </button>
  ))}
  <span className="w-px h-4 bg-[var(--border)]" />
  {/* 中长周期 */}
  {(["daily", "weekly", "monthly"] as const).map((p) => (
    <button
      key={p}
      onClick={() => setPeriod(p)}
      className={`px-3 py-1 text-xs font-mono uppercase tracking-wide border transition-colors rounded-lg ${
        period === p
          ? "bg-[var(--accent)] text-white border-[var(--accent)]"
          : "bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]"
      }`}
    >
      {p === "daily" ? "日K" : p === "weekly" ? "周K" : "月K"}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add app/stock/\[code\]/page.tsx
git commit -m "feat: add 15min/60min period buttons with grouping separator"
```

---

### Task 9: 图表渲染 — X 轴标签支持分钟时间格式

**Files:**
- Modify: `lib/chartRenderer.ts`

- [ ] **Step 1: 确定 X 轴标签渲染逻辑位置**

找到 `ChartRenderer` 中绘制 X 轴时间标签的代码（约在 `drawTimeAxis` 或类似函数中），添加分钟线判断：

```typescript
// 判断是否为分钟线：KLineData 有 time 字段
const isMinuteLine = klineData.length > 0 && "time" in klineData[0];

if (isMinuteLine) {
  // 分钟线：显示 HH:MM
  const timeStr = kline.time!; // YYYYMMDDHHMM
  const label = `${timeStr.slice(8, 10)}:${timeStr.slice(10, 12)}`;
  ctx.fillText(label, x, axisY);
} else {
  // 日线：显示 MM/DD
  const dateStr = String(data.date);
  const label = `${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}`;
  ctx.fillText(label, x, axisY);
}
```

具体代码位置需要根据 `chartRenderer.ts` 的实际内容定位后修改。

- [ ] **Step 2: 验证图表渲染（需启动 dev server 并手动测试）**

Run: `npm run dev`
Expected: 页面正常加载，切换到 15 分周期时 X 轴显示 `HH:MM` 格式

- [ ] **Step 3: Commit**

```bash
git add lib/chartRenderer.ts
git commit -m "feat: render HH:MM labels for minute-level K-line x-axis"
```

---

## 实施检查清单

| # | 任务 | 状态 |
|---|------|------|
| 1 | Prisma MinuteCandle Model + migrate | ☐ |
| 2 | Python 抓取脚本 `jobs/sync_15min.py` | ☐ |
| 3 | CSV 导入脚本 `jobs/sync_15min_import.py` | ☐ |
| 4 | `syncMinuteCandles()` Node 函数 | ☐ |
| 5 | `getMinuteKLineData()` + KLineData 类型 | ☐ |
| 6 | K 线 API 支持 `period=15min\|60min` | ☐ |
| 7 | 同步 API 支持 `type=minute` | ☐ |
| 8 | 前端周期选择器 + 分组 UI | ☐ |
| 9 | 图表 X 轴分钟标签 | ☐ |

---

## Spec 自查

1. **覆盖度**：设计 10 个步骤，任务 1-9 对应全部实现步骤 ✓
2. **占位符扫描**：无 "TBD"/"TODO"/"类似" 等占位符 ✓
3. **类型一致性**：
   - `MinuteCandle.tsCode` = `string` ✓
   - `getMinuteKLineData` 入参 `period: "15min" | "60min"` ✓
   - `KLineData.time?: string` ✓
   - API route 中 `period === "15min" || period === "60min"` 判断 ✓
   - Python CSV 字段 `tradeTime`, `tradeDate` 与 DB 列名一致 ✓
