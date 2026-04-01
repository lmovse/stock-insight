# Tushare 数据同步实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 tushare pro API 替换 mock 数据，建立后台定时任务同步机制，将数据持久化到 Prisma/SQLite，前端 API routes 直接查库。

**Architecture:**
- `lib/tushare/client.ts` — tushare HTTP API 封装，axios 调用，140ms 间隔控频
- `lib/tushare/sync.ts` — 各数据同步任务，增量/全量拉取逻辑
- `lib/tushare/scheduler.ts` — node-cron 调度，常驻进程运行
- `lib/stockApi.ts` — 替换 mock 为 Prisma DB 查询
- `prisma/schema.prisma` — 新增 StockBasic, DailyCandle, IndexBasic, IndexDaily, SyncLog 模型

**Tech Stack:** `axios`, `node-cron`, `Prisma/SQLite`

---

## 文件结构

```
lib/tushare/
  client.ts      # tushare HTTP API 封装
  sync.ts        # 各同步任务实现
  scheduler.ts   # cron 调度器

prisma/
  schema.prisma  # 扩展：StockBasic, DailyCandle, IndexBasic, IndexDaily, SyncLog

lib/
  stockApi.ts    # 替换 mock 为 DB 查询

.env.local       # 添加 TUSHARE_TOKEN
```

---

## Task 1: 环境配置 & Prisma Schema

**Files:**
- Modify: `.env.local`
- Modify: `prisma/schema.prisma`
- Run: `npx prisma migrate dev`

- [ ] **Step 1: 添加 TUSHARE_TOKEN 到 .env.local**

```bash
echo "TUSHARE_TOKEN=你的token" >> .env.local
```

- [ ] **Step 2: 扩展 Prisma schema**

在 `prisma/schema.prisma` 末尾添加：

```prisma
model StockBasic {
  tsCode    String @id
  symbol    String
  name      String
  area      String?
  industry  String?
  market    String
  listDate  String?
  delistDate String?
  updatedAt DateTime @updatedAt
  dailyCandles DailyCandle[]
  @@index([symbol])
  @@index([market])
}

model DailyCandle {
  id        String @id @default(cuid())
  tsCode    String
  tradeDate String
  open      Float
  high      Float
  low       Float
  close     Float
  vol       Float
  amount    Float?
  turnrate  Float?
  pe        Float?
  ps        Float?
  pcf       Float?
  marketCap Float?
  floatCap  Float?
  stock     StockBasic @relation(fields: [tsCode], references: [tsCode])
  @@unique([tsCode, tradeDate])
  @@index([tsCode])
  @@index([tradeDate])
}

model IndexBasic {
  tsCode   String @id
  name     String
  fullname String?
  market   String
  count    Int?
  updatedAt DateTime @updatedAt
  indexDaily IndexDaily[]
}

model IndexDaily {
  id        String @id @default(cuid())
  tsCode    String
  tradeDate String
  close     Float
  vol       Float?
  amount    Float?
  index     IndexBasic @relation(fields: [tsCode], references: [tsCode])
  @@unique([tsCode, tradeDate])
  @@index([tsCode])
  @@index([tradeDate])
}

model SyncLog {
  jobName    String @id
  status     String
  total      Int @default(0)
  inserted   Int @default(0)
  updated    Int @default(0)
  errorMsg   String?
  startedAt  DateTime @default(now())
  finishedAt DateTime?
  @@index([jobName])
}
```

- [ ] **Step 3: 运行 migration**

```bash
npx prisma migrate dev --name add_tushare_tables
```

---

## Task 2: Tushare Client 封装

**Files:**
- Create: `lib/tushare/client.ts`
- Create: `lib/tushare/types.ts`

- [ ] **Step 1: 创建类型定义**

```typescript
// lib/tushare/types.ts
export interface TushareResponse<T> {
  code: number;
  msg: string;
  data: {
    fields: string[];
    items: T[][];
  };
}

export interface DailyItem {
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  amount: number;
}

export interface StockBasicItem {
  ts_code: string;
  symbol: string;
  name: string;
  area: string;
  industry: string;
  market: string;
  list_date: string;
  delist_date: string;
}

export interface IndexBasicItem {
  ts_code: string;
  name: string;
  fullname: string;
  market: string;
  count: number;
}

export interface IndexDailyItem {
  ts_code: string;
  trade_date: string;
  close: number;
  vol: number;
  amount: number;
}
```

- [ ] **Step 2: 创建 tushare client**

```typescript
// lib/tushare/client.ts
import axios from 'axios';

const BASE_URL = 'https://api.tushare.pro';
const REQUEST_INTERVAL = 140; // ms between requests (leaves 20ms buffer under 500/min limit)

let lastRequestTime = 0;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function throttle() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < REQUEST_INTERVAL) {
    await sleep(REQUEST_INTERVAL - elapsed);
  }
  lastRequestTime = Date.now();
}

export class TushareError extends Error {
  constructor(
    message: string,
    public code: number,
    public requestParams?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TushareError';
  }
}

export async function tushareGet<T>(
  apiName: string,
  params: Record<string, string | number | undefined>,
  fields: string
): Promise<T[][]> {
  const token = process.env.TUSHARE_TOKEN;
  if (!token) throw new Error('TUSHARE_TOKEN not set in environment');

  await throttle();

  try {
    const response = await axios.post<TushareResponse<T>>(BASE_URL, {
      api_name: apiName,
      token,
      params: Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined)
      ),
      fields,
    });

    const { code, msg, data } = response.data;

    if (code !== 0) {
      throw new TushareError(msg, code, params);
    }

    return data.items;
  } catch (err: unknown) {
    if (err instanceof TushareError) throw err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new TushareError(message, -1, params);
  }
}

// Helper: convert field array + items array to objects
export function rowsToObjects<T extends Record<string, string | number>>(
  fields: string[],
  items: T[][]
): T[] {
  return items.map(item =>
    Object.fromEntries(fields.map((f, i) => [f, item[i]]))
  ) as T[];
}
```

---

## Task 3: 同步任务实现

**Files:**
- Create: `lib/tushare/sync.ts`

- [ ] **Step 1: 写入 sync.ts**

```typescript
// lib/tushare/sync.ts
import { PrismaClient } from '@prisma/client';
import { tushareGet, rowsToObjects, TushareError } from './client';
import type {
  DailyItem,
  StockBasicItem,
  IndexBasicItem,
  IndexDailyItem,
} from './types';

const prisma = new PrismaClient();

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function todayStr(): string {
  return formatDate(new Date());
}

function parseTradeDate(s: string): string {
  // "20230401" -> Date
  const y = s.slice(0, 4);
  const m = s.slice(4, 6);
  const d = s.slice(6, 8);
  return `${y}-${m}-${d}`;
}

function tsCodeToSymbol(tsCode: string): string {
  return tsCode.replace(/\.(SH|SZ|BJ)/, (_, ext) =>
    ext === 'SH' ? '.SS' : ext === 'SZ' ? '.SZ' : '.BJ'
  );
}

async function getLastSyncDate(jobName: string): Promise<string | null> {
  const log = await prisma.syncLog.findFirst({
    where: { jobName, status: 'success' },
    orderBy: { finishedAt: 'desc' },
  });
  if (!log?.finishedAt) return null;
  return formatDate(new Date(log.finishedAt));
}

async function upsertSyncLog(
  jobName: string,
  status: string,
  total = 0,
  inserted = 0,
  updated = 0,
  errorMsg?: string
) {
  return prisma.syncLog.upsert({
    where: { jobName },
    create: {
      jobName,
      jobName,
      status,
      total,
      inserted,
      updated,
      errorMsg,
      finishedAt: status !== 'running' ? new Date() : null,
    },
    update: {
      status,
      total,
      inserted,
      updated,
      errorMsg,
      finishedAt: status !== 'running' ? new Date() : null,
    },
  });
}

// Retry wrapper
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 30000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      if (i === retries - 1) throw err;
      const isRateLimit = err instanceof TushareError && err.code === 429;
      const waitMs = isRateLimit ? 60000 : delayMs;
      console.warn(`[sync] Attempt ${i + 1} failed, retrying in ${waitMs}ms...`, err instanceof Error ? err.message : err);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  throw new Error('unreachable');
}

// ─── sync_stock_basics ───────────────────────────────────────────────────────
export async function syncStockBasics() {
  await upsertSyncLog('sync_stock_basics', 'running');

  try {
    const items = await withRetry(async () => {
      return tushareGet<StockBasicItem>('stock_basic', {
        exchange: '',
        list_status: 'L',
        fields: 'ts_code,symbol,name,area,industry,market,list_date,delist_date',
      }, 'ts_code,symbol,name,area,industry,market,list_date,delist_date');
    });

    const records = rowsToObjects(['ts_code','symbol','name','area','industry','market','list_date','delist_date'], items as unknown as string[][]);

    let inserted = 0, updated = 0;
    for (const r of records) {
      const result = await prisma.stockBasic.upsert({
        where: { tsCode: r.ts_code as string },
        create: {
          tsCode: r.ts_code as string,
          symbol: r.symbol as string,
          name: r.name as string,
          area: r.area as string | undefined,
          industry: r.industry as string | undefined,
          market: r.market as string,
          listDate: r.list_date ? new Date((r.list_date as string).slice(0,4)+'-'+(r.list_date as string).slice(4,6)+'-'+(r.list_date as string).slice(6,8)) : null,
          delistDate: r.delist_date ? new Date((r.delist_date as string).slice(0,4)+'-'+(r.delist_date as string).slice(4,6)+'-'+(r.delist_date as string).slice(6,8)) : null,
        },
        update: {
          symbol: r.symbol as string,
          name: r.name as string,
          area: r.area as string | undefined,
          industry: r.industry as string | undefined,
        },
      });
      inserted++;
    }

    await upsertSyncLog('sync_stock_basics', 'success', records.length, inserted, 0);
    console.log(`[sync] stock_basics done: ${inserted} inserted, ${updated} updated`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await upsertSyncLog('sync_stock_basics', 'failed', 0, 0, 0, msg);
    console.error(`[sync] stock_basics failed:`, err);
  }
}

// ─── sync_daily_candles ──────────────────────────────────────────────────────
// If startDate is empty, pulls full history for each stock.
// If startDate is set, pulls only from that date forward (incremental).
export async function syncDailyCandles(startDate?: string) {
  await upsertSyncLog('sync_daily_candles', 'running');

  try {
    const lastDate = startDate || (await getLastSyncDate('sync_daily_candles'));

    // Get all stocks
    const stocks = await prisma.stockBasic.findMany({ select: { tsCode: true } });
    console.log(`[sync] syncing daily candles for ${stocks.length} stocks`);

    let totalInserted = 0, totalUpdated = 0;

    // tushare daily API: pass ts_code to get single stock, or no ts_code to get all stocks
    // For incremental (date range), we can call daily without ts_code to get all stocks for that date
    if (lastDate) {
      // Incremental: fetch all stocks for the given date
      const [items] = await withRetry(() =>
        tushareGet<DailyItem>('daily', {
          trade_date: lastDate,
        }, 'ts_code,trade_date,open,high,low,close,vol,amount')
      );

      const records = rowsToObjects(['ts_code','trade_date','open','high','low','close','vol','amount'], items as unknown as string[][]);

      for (const r of records) {
        await prisma.dailyCandle.upsert({
          where: {
            tsCode_tradeDate: {
              tsCode: r.ts_code as string,
              tradeDate: parseTradeDate(r.trade_date as string),
            },
          },
          create: {
            tsCode: r.ts_code as string,
            tradeDate: parseTradeDate(r.trade_date as string),
            open: Number(r.open),
            high: Number(r.high),
            low: Number(r.low),
            close: Number(r.close),
            vol: Number(r.vol),
            amount: r.amount ? Number(r.amount) : null,
          },
          update: {
            open: Number(r.open),
            high: Number(r.high),
            low: Number(r.low),
            close: Number(r.close),
            vol: Number(r.vol),
            amount: r.amount ? Number(r.amount) : null,
          },
        });
        totalInserted++;
      }
    } else {
      // Full history: one call per stock (single ts_code = full history up to 6000 records)
      for (const { tsCode } of stocks) {
        const [items] = await withRetry(() =>
          tushareGet<DailyItem>('daily', {
            ts_code: tsCode,
          }, 'ts_code,trade_date,open,high,low,close,vol,amount')
        );

        const records = rowsToObjects(['ts_code','trade_date','open','high','low','close','vol','amount'], items as unknown as string[][]);

        for (const r of records) {
          const result = await prisma.dailyCandle.upsert({
            where: {
              tsCode_tradeDate: {
                tsCode: r.ts_code as string,
                tradeDate: parseTradeDate(r.trade_date as string),
              },
            },
            create: {
              tsCode: r.ts_code as string,
              tradeDate: parseTradeDate(r.trade_date as string),
              open: Number(r.open),
              high: Number(r.high),
              low: Number(r.low),
              close: Number(r.close),
              vol: Number(r.vol),
              amount: r.amount ? Number(r.amount) : null,
            },
            update: {
              open: Number(r.open),
              high: Number(r.high),
              low: Number(r.low),
              close: Number(r.close),
              vol: Number(r.vol),
              amount: r.amount ? Number(r.amount) : null,
            },
          });
        }
        totalInserted += records.length;

        // Progress log every 100 stocks
        if (totalInserted % 100 === 0) {
          console.log(`[sync] daily candles progress: ${totalInserted} records for ${stocks.indexOf({ tsCode })}/${stocks.length}`);
        }
      }
    }

    await upsertSyncLog('sync_daily_candles', 'success', stocks.length, totalInserted, totalUpdated);
    console.log(`[sync] daily_candles done: ${totalInserted} records`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await upsertSyncLog('sync_daily_candles', 'failed', 0, 0, 0, msg);
    console.error(`[sync] daily_candles failed:`, err);
  }
}

// ─── sync_index_basics ───────────────────────────────────────────────────────
export async function syncIndexBasics() {
  await upsertSyncLog('sync_index_basics', 'running');

  try {
    const [items] = await withRetry(() =>
      tushareGet<IndexBasicItem>('index_basic', {
        market: '',
      }, 'ts_code,name,fullname,market,count')
    );

    const records = rowsToObjects(['ts_code','name','fullname','market','count'], items as unknown as string[][]);

    let inserted = 0, updated = 0;
    for (const r of records) {
      const result = await prisma.indexBasic.upsert({
        where: { tsCode: r.ts_code as string },
        create: {
          tsCode: r.ts_code as string,
          name: r.name as string,
          fullname: r.fullname as string | undefined,
          market: r.market as string,
          count: r.count ? Number(r.count) : null,
        },
        update: {
          name: r.name as string,
          fullname: r.fullname as string | undefined,
          count: r.count ? Number(r.count) : null,
        },
      });
      inserted++;
    }

    await upsertSyncLog('sync_index_basics', 'success', records.length, inserted, 0);
    console.log(`[sync] index_basics done: ${inserted} inserted, ${updated} updated`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await upsertSyncLog('sync_index_basics', 'failed', 0, 0, 0, msg);
    console.error(`[sync] index_basics failed:`, err);
  }
}

// ─── sync_index_daily ───────────────────────────────────────────────────────
export async function syncIndexDaily(date?: string) {
  await upsertSyncLog('sync_index_daily', 'running');

  try {
    const targetDate = date || await getLastSyncDate('sync_index_daily') || todayStr();

    const [items] = await withRetry(() =>
      tushareGet<IndexDailyItem>('index_daily', {
        trade_date: targetDate,
      }, 'ts_code,trade_date,close,vol,amount')
    );

    const records = rowsToObjects(['ts_code','trade_date','close','vol','amount'], items as unknown as string[][]);

    let inserted = 0;
    for (const r of records) {
      await prisma.indexDaily.upsert({
        where: {
          tsCode_tradeDate: {
            tsCode: r.ts_code as string,
            tradeDate: parseTradeDate(r.trade_date as string),
          },
        },
        create: {
          tsCode: r.ts_code as string,
          tradeDate: parseTradeDate(r.trade_date as string),
          close: Number(r.close),
          vol: r.vol ? Number(r.vol) : null,
          amount: r.amount ? Number(r.amount) : null,
        },
        update: {
          close: Number(r.close),
          vol: r.vol ? Number(r.vol) : null,
          amount: r.amount ? Number(r.amount) : null,
        },
      });
      inserted++;
    }

    await upsertSyncLog('sync_index_daily', 'success', records.length, inserted, 0);
    console.log(`[sync] index_daily done: ${inserted} records for ${targetDate}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await upsertSyncLog('sync_index_daily', 'failed', 0, 0, 0, msg);
    console.error(`[sync] index_daily failed:`, err);
  }
}

// ─── Helper: run full sync ───────────────────────────────────────────────────
export async function runFullSync() {
  console.log('[sync] === starting full sync ===');
  await syncStockBasics();
  await syncDailyCandles(); // full history for all stocks
  await syncIndexBasics();
  await syncIndexDaily();
  console.log('[sync] === full sync complete ===');
}
```

---

## Task 4: Scheduler 调度器

**Files:**
- Create: `lib/tushare/scheduler.ts`

- [ ] **Step 1: 写入 scheduler.ts**

```typescript
// lib/tushare/scheduler.ts
import cron from 'node-cron';
import {
  syncStockBasics,
  syncDailyCandles,
  syncIndexBasics,
  syncIndexDaily,
} from './sync';

type CronTask = {
  name: string;
  cronExpr: string;
  fn: () => Promise<void>;
};

const tasks: CronTask[] = [
  // 每天 01:00 — sync stock basics
  { name: 'sync_stock_basics', cronExpr: '0 1 * * *', fn: syncStockBasics },
  // 交易日 16:00-23:55 每5分钟 — incremental daily candles
  {
    name: 'sync_daily_candles',
    cronExpr: '*/5 16-23 * * 1-5',
    fn: () => syncDailyCandles(),
  },
  // 每天 02:00 — sync index basics
  { name: 'sync_index_basics', cronExpr: '0 2 * * *', fn: syncIndexBasics },
  // 交易日 16:00-22:00 每10分钟 — index daily
  {
    name: 'sync_index_daily',
    cronExpr: '*/10 16-22 * * 1-5',
    fn: () => syncIndexDaily(),
  },
];

const scheduledJobs: cron.ScheduledTask[] = [];

export function startScheduler() {
  console.log('[scheduler] starting...');
  for (const task of tasks) {
    const job = cron.schedule(task.cronExpr, async () => {
      console.log(`[scheduler] running: ${task.name}`);
      try {
        await task.fn();
      } catch (err) {
        console.error(`[scheduler] ${task.name} failed:`, err);
      }
    });
    scheduledJobs.push(job);
    console.log(`[scheduler] scheduled: ${task.name} (${task.cronExpr})`);
  }
  console.log('[scheduler] started');
}

export function stopScheduler() {
  for (const job of scheduledJobs) {
    job.stop();
  }
  console.log('[scheduler] stopped');
}

// Keep process alive
process.on('SIGTERM', () => {
  stopScheduler();
  process.exit(0);
});
```

- [ ] **Step 2: 添加启动入口**

在 `package.json` scripts 中添加：

```json
"sync": "tsx lib/tushare/scheduler.ts",
"sync:once": "tsx lib/tushare/sync.ts"
```

安装依赖：

```bash
npm install node-cron
npm install -D tsx
```

---

## Task 5: 改造 stockApi.ts 查 DB

**Files:**
- Modify: `lib/stockApi.ts`

- [ ] **Step 1: 替换为 DB 查询**

```typescript
// lib/stockApi.ts
import { PrismaClient } from '@prisma/client';
import type { StockInfo, KLineData } from './types';

const prisma = new PrismaClient();

// ts_code format: "600519.SH", frontend uses "600519"
// We store ts_codes in DB as "600519.SH"
function toTsCode(code: string): string {
  if (code.endsWith('.SH') || code.endsWith('.SZ')) return code;
  // guess market from code prefix
  if (code.startsWith('6')) return `${code}.SH`;
  if (code.startsWith('8') || code.startsWith('4')) return `${code}.BJ`;
  return `${code}.SZ`;
}

function fromTsCode(tsCode: string): string {
  return tsCode.replace(/\.(SH|SZ|BJ)/, '');
}

function tsCodeToMarket(tsCode: string): string {
  if (tsCode.endsWith('.SH')) return 'sh';
  if (tsCode.endsWith('.BJ')) return 'bj';
  return 'sz';
}

export async function searchStocks(query: string): Promise<StockInfo[]> {
  const q = query.trim();
  if (!q) return [];

  const stocks = await prisma.stockBasic.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { symbol: { contains: q } },
        { tsCode: { contains: q } },
      ],
    },
    take: 20,
  });

  return stocks.map(s => ({
    code: fromTsCode(s.tsCode),
    name: s.name,
    market: tsCodeToMarket(s.tsCode),
  }));
}

export async function getKLineData(
  code: string,
  period: string = 'daily',
  count: number = 300
): Promise<KLineData[]> {
  const tsCode = toTsCode(code);

  const candles = await prisma.dailyCandle.findMany({
    where: { tsCode },
    orderBy: { tradeDate: 'asc' },
    take: count,
  });

  return candles.map(c => ({
    date: parseInt(c.tradeDate.replace(/-/g, ''), 10),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.vol,
  }));
}

export async function getStockInfo(code: string): Promise<StockInfo> {
  const tsCode = toTsCode(code);
  const stock = await prisma.stockBasic.findUnique({ where: { tsCode } });
  if (!stock) throw new Error(`Stock ${code} not found`);
  return {
    code: fromTsCode(stock.tsCode),
    name: stock.name,
    market: tsCodeToMarket(stock.tsCode),
  };
}
```

---

## Task 6: 验证

**Files:**
- Test: manual run

- [ ] **Step 1: 验证 API 连通性**

```bash
npx tsx -e "
import { tushareGet } from './lib/tushare/client';
const [items] = await tushareGet('trade_cal', { exchange: 'SSE', start_date: '20260101', end_date: '20260401' }, 'exchange,cal_date,is_open');
console.log('tushare连通:', items.length, '条记录');
console.log(items.slice(0,3));
"
```

Expected: 输出交易日历记录，无报错

- [ ] **Step 2: 验证 DB 写入**

```bash
npx tsx lib/tushare/sync.ts
```

Expected: 控制台输出 `sync_stock_basics done: X inserted`，无报错

- [ ] **Step 3: 验证 API route**

```bash
curl "http://localhost:3000/api/stocks/600519/kline?period=daily&count=10"
```

Expected: 返回 JSON 数组，含 K 线数据

---

## 依赖清单

```bash
npm install node-cron axios
npm install -D tsx
npx prisma migrate dev --name add_tushare_tables
```
