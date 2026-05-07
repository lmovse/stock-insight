# 15 分钟 K 线设计

## 背景

目前系统只有日/周/月三个 K 线周期，用户无法查看 15 分钟级别的分钟行情。本设计新增 15 分钟 K 线功能。

## 关键决策

- **数据源**：Baostock（Python 脚本抓取），无需注册、无 API 限制，数据从 1999 年至今
- **同步触发**：`POST /api/stocks/sync` 时同时触发日K 和 15分钟K 两条同步链路，保持接口统一
- **Python 子进程**：Node 调用 Python 脚本，脚本写入 SQLite，Node 读取
- **数据范围**：近三年（2023-05-07 起），全市场 A 股
- **UI 分组**：`[15分] [60分] | [日K] [周K] [月K]`

---

## 一、数据模型

### 1.1 Prisma Model — `MinuteCandle`

```prisma
model MinuteCandle {
  id         String @id @default(cuid())
  tsCode     String             // 如 "sh.600519"
  tradeDate  String             // YYYYMMDD 格式，交易日日期
  tradeTime  String             // YYYYMMDDHHMM 格式，含时间（分钟精度）
  open       Float
  high       Float
  low        Float
  close      Float
  volume     Float
  amount     Float?
  adjustFlag String              @default("3")  // 1=后复权 2=前复权 3=不复权

  @@unique([tsCode, tradeTime])
  @@index([tsCode])
  @@index([tradeDate])
  @@index([tsCode, tradeDate])
}
```

> `tradeTime` 唯一约束确保同一股票同一时间点只有一条记录。

### 1.2 时间字段格式

| 字段 | 格式 | 示例 | 说明 |
|------|------|------|------|
| `tradeDate` | `YYYYMMDD` | `20260507` | 交易日日期 |
| `tradeTime` | `YYYYMMDDHHMM` | `202605071030` | 精确到分钟，10:30 那根代表 10:15–10:30 |

> Baostock 返回的 `time` 字段为 `YYYYMMDDHHMMSSsss`，取前 12 位即 `YYYYMMDDHHMM`。

---

## 二、同步链路

### 2.1 Python 抓取脚本 — `jobs/sync_15min.py`

**入口**：`npx tsx jobs/sync_15min.py`

**流程**：
1. `bs.login()` — 无需账号
2. `bs.query_all_stock(day)` 获取全市场股票代码（只保留 `sh.6`/`sz.0`/`sz.3`）
3. 循环每只股票，调用 `bs.query_history_k_data_plus(frequency="15", start_date="2023-05-07")`
4. 转换字段：`time` → `tradeTime`（取前12位），`date` → `tradeDate`
5. 输出 CSV：`data/15min/{tsCode}.csv`
6. 每 500 只股票 `bs.logout()` + `bs.login()` 防断线
7. 加 0.1s sleep 防限频

**输出**：CSV 文件，按股票代码分文件，便于断点续传。

### 2.2 CSV 批量导入 — `jobs/sync_15min_import.py`

**流程**：
1. 读取 `data/15min/*.csv`
2. 转换字段
3. Prisma `$executeRawUnsafe` 批量 upsert

**SQL**：
```sql
INSERT INTO MinuteCandle (id, tsCode, tradeDate, tradeTime, open, high, low, close, volume, amount, adjustFlag)
VALUES (...)
ON CONFLICT (tsCode, tradeTime) DO UPDATE SET
  open=excluded.open, high=excluded.high, low=excluded.low,
  close=excluded.close, volume=excluded.volume, amount=excluded.amount
```

### 2.3 Node 同步函数 — `lib/tushare/sync.ts`

新增 `syncMinuteCandles()` 函数：

```typescript
export async function syncMinuteCandles() {
  // 1. 调用 Python 脚本抓取（subprocess）
  await runPythonScript('jobs/sync_15min.py');

  // 2. 批量导入
  await runPythonScript('jobs/sync_15min_import.py');
}
```

### 2.4 API 统一入口 — `app/api/stocks/sync/route.ts`

```typescript
// POST /api/stocks/sync
export async function POST(req: NextRequest) {
  const { type } = await req.json(); // "daily" | "minute" | "all"

  if (type === 'all' || type === 'daily') {
    runFullSync().catch(err => console.error('[sync] daily failed:', err));
  }
  if (type === 'all' || type === 'minute') {
    syncMinuteCandles().catch(err => console.error('[sync] minute failed:', err));
  }

  return NextResponse.json({ message: 'Sync started' });
}
```

GET 返回结构不变（cutoffDate 等日线信息），15 分钟同步状态可通过 `SyncLog` 表独立查询。

---

## 三、API 层

### 3.1 K 线查询 — `app/api/stocks/[code]/kline/route.ts`

```typescript
// GET /api/stocks/[code]/kline?period=15min&count=100
export async function GET(req: NextRequest, { params }) {
  const { code } = await params;
  const period = req.nextUrl.searchParams.get("period") || "daily";
  const count = parseInt(req.nextUrl.searchParams.get("count") || "300");

  if (period === "15min" || period === "60min") {
    const data = await getMinuteKLineData(code, period, count);
    return NextResponse.json(data);
  }

  // 日/周/月走原有逻辑
  const data = await getKLineData(code, period, count);
  return NextResponse.json(data);
}
```

### 3.2 `lib/stockApi.ts` — `getMinuteKLineData`

```typescript
export async function getMinuteKLineData(
  code: string,
  period: "15min" | "60min",
  count: number = 300
): Promise<KLineData[]> {
  const tsCode = codeToTsCode(code);
  const minutesPerBar = period === "15min" ? 15 : 60;

  // 从 MinuteCandle 读取最近 count 条（按 tradeTime 降序）
  const candles = await prisma.minuteCandle.findMany({
    where: { tsCode },
    orderBy: { tradeTime: "desc" },
    take: count,
  });

  // 转换：tradeTime → date（取日期部分）+ 重组 OHLCV
  return candles.reverse().map((c) => ({
    date: parseInt(c.tradeDate),           // YYYYMMDD 整数
    time: c.tradeTime,                      // YYYYMMDDHHMM 字符串
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    amount: c.amount ?? undefined,
  }));
}
```

> `KLineData` 接口需扩展 `time` 字段（可选）以支持分钟线。

---

## 四、前端

### 4.1 周期选择器 UI

```tsx
// app/stock/[code]/page.tsx
const [period, setPeriod] = useState<"15min" | "60min" | "daily" | "weekly" | "monthly">("daily");

// ...
<div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-subtle)] shrink-0">
  {/* 短周期 */}
  {(["15min", "60min"] as const).map((p) => (
    <button key={p} onClick={() => setPeriod(p)} className={period === p ? "active" : ""}>
      {p === "15min" ? "15分" : "60分"}
    </button>
  ))}
  <span className="w-px h-4 bg-[var(--border)]" />
  {/* 中长周期 */}
  {(["daily", "weekly", "monthly"] as const).map((p) => (
    <button key={p} onClick={() => setPeriod(p)} className={period === p ? "active" : ""}>
      {p === "daily" ? "日K" : p === "weekly" ? "周K" : "月K"}
    </button>
  ))}
</div>
```

### 4.2 OHLCV 信息面板 — 分钟线适配

| 字段 | 显示 | 说明 |
|------|------|------|
| 日期/时间 | `2026/05/07 10:30` | 分钟线显示到分钟 |
| 开盘/最高/收盘/最低 | 同日线 | — |
| 涨跌 | 同日线 | — |
| 成交量 | 原始值或万手 | — |

### 4.3 均线参数 — 分钟线调整

日线的 MA 参数（5/10/20/60）在分钟线含义不同：

| 日线 MA | 15分钟对应 | 60分钟对应 |
|---------|-----------|-----------|
| MA5 | MA5（75分钟≈1.5小时） | MA5（5小时） |
| MA10 | MA10（2.5小时） | MA10（10小时） |
| MA20 | MA20（5小时） | MA20（20小时） |
| MA60 | MA60（15小时） | MA60（60小时≈3天） |

**建议**：前端传给 ChartRenderer 的 `maPeriods` 保持不变（5/10/20/60），由 ChartRenderer 自行解释为对应周期根数的均线，不在后端转换。

### 4.4 图表渲染 — `lib/chartRenderer.ts`

ChartRenderer 的 K 线渲染逻辑不区分日/分钟线（都是 OHLCV），只需：

1. `setData()` 时区分 `date` 为 `YYYYMMDD`（日线）还是带 `time` 的字符串（分钟线）
2. X轴标签：分钟线显示 `HH:MM`，日线显示 `MM/DD`
3. 时间轴范围：分钟线按交易日分段（9:30–11:30, 13:00–15:00），日内最多 16 根 15 分钟K线（4小时）

---

## 五、实现步骤

1. **新建 Prisma Model** — `MinuteCandle`，`npx prisma migrate dev`
2. **编写 `jobs/sync_15min.py`** — Baostock 抓取脚本
3. **编写 `jobs/sync_15min_import.py`** — CSV 导入 SQLite
4. **新增 `syncMinuteCandles()`** — `lib/tushare/sync.ts`
5. **扩展 `getMinuteKLineData()`** — `lib/stockApi.ts`
6. **扩展 API** — `app/api/stocks/[code]/kline/route.ts` 支持 `period=15min|60min`
7. **扩展 API** — `app/api/stocks/sync/route.ts` 支持 `type=minute`
8. **前端周期选择器** — 5 分组按钮 + `period` state 扩展
9. **前端图表** — `HQChart` 支持分钟线时间轴标签
10. **类型更新** — `KLineData` 接口扩展可选 `time` 字段

---

## 六、风险与注意事项

- **Baostock 断线**：每 500 只重连一次，抓取时加 0.1s sleep
- **停牌数据**：Baostock 会返回停牌日的 volume=0，导入时过滤 `volume > 0`
- **复权方式**：默认后复权（`adjustflag="1"`），与日线复权方式保持一致
- **数据库大小**：3年全市场15分钟数据估计 5~10GB，SQLite 写入性能需关注；可考虑按年分表
- **同步时间**：首次全量预计数小时，后续增量只同步当天数据，分钟级完成
