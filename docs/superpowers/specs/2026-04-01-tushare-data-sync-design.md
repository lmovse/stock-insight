# Tushare 数据同步模块设计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用 tushare pro API 替换现有 mock 数据，建立后台定时任务同步机制，将数据持久化到 Prisma DB，前端 API routes 直接查库，不再实时调 tushare。

**Architecture:**
- tushare 提供 HTTP REST API（通过 `axios` 调用，无需 Python SDK）
- Node.js 后台定时任务（`node-cron`）驱动数据拉取
- 所有数据存入 Prisma + SQLite（开发）/ PostgreSQL（生产）
- 前端 API routes 只查 DB，不直接调 tushare

**Tech Stack:** `axios`（HTTP调 tushare）、`node-cron`（定时）、`Prisma`（ORM）

---

## 一、Tushare API 调用封装

### 1.1 Client 模块

**文件**: `lib/tushare/client.ts`

tushare HTTP API 格式：
```
POST https://api.tushare.pro
Body: { api_name: "daily", token: "...", params: {...}, fields: "..." }
```

- token 从 `process.env.TUSHARE_TOKEN` 读取
- 封装 `tushareGet<T>(apiName, params, fields?)` 方法
- 统一错误处理：网络错误、积分不足、数据为空均抛出 `TushareError`
- 请求间隔：每次调用后 `sleep(100ms)`，避免触发频率限制

### 1.2 可用 API 列表（免费账户 120 积分权限）

| API 名称 | 说明 | 关键字段 |
|---|---|---|
| `stock_basic` | 沪深股票基础信息 | ts_code, name, area, industry, list_date, delist_date |
| `trade_cal` | 交易日历 | exchange, cal_date, is_open |
| `daily` | 日线行情 | ts_code, trade_date, open, high, low, close, vol |
| `weekly` | 周线行情 | 同上 |
| `monthly` | 月线行情 | 同上 |
| `adj_factor` | 复权因子 | ts_code, trade_date, adj_factor |
| `stk_rewards` | 分红送股 | ts_code, div_ratio, sum_div_ratio |
| `index_basic` | 指数基础信息 | ts_code, name, fullname, market |
| `index_daily` | 指数日线 | ts_code, trade_date, close, vol |

**暂不接入**（需要更多积分）：财务报表、个股资金流、龙虎榜等。

---

## 二、数据库模型

### 2.1 Prisma Schema 扩展

**文件**: `prisma/schema.prisma`

```prisma
model StockBasic {
  tsCode     String @id  // e.g. "600519.SH"
  symbol     String       // e.g. "600519"
  name       String
  area       String?
  industry   String?
  market     String        // "SH" / "SZ" / "BJ"
  listDate   DateTime?
  delistDate DateTime?
  updatedAt  DateTime @updatedAt

  dailyCandles    DailyCandle[]
  indexDaily      IndexDaily[]
}

model DailyCandle {
  id        String   @id @default(cuid())
  tsCode    String
  tradeDate DateTime
  open      Float
  high      Float
  low       Float
  close     Float
  vol       Float     // 成交量（手）
  amount    Float?    // 成交额（元）
  turnrate  Float?    // 换手率
  pe        Float?    // 市盈率
  ps        Float?    // 市销率
  pcf      Float?    // 市现率
  marketCap Float?    // 总市值
  floatCap  Float?    // 流通市值

  stock     StockBasic @relation(fields: [tsCode], references: [tsCode])

  @@unique([tsCode, tradeDate])
  @@index([tsCode])
  @@index([tradeDate])
}

model IndexBasic {
  tsCode   String @id  // e.g. "000001.SH"
  name     String
  fullname String?
  market   String   // "SSE" / "SZSE" / "CICC"
  count    Int?
  updatedAt DateTime @updatedAt

  indexDaily IndexDaily[]
}

model IndexDaily {
  id        String   @id @default(cuid())
  tsCode    String
  tradeDate DateTime
  close     Float
  vol       Float?
  amount    Float?

  index     IndexBasic @relation(fields: [tsCode], references: [tsCode])

  @@unique([tsCode, tradeDate])
  @@index([tsCode])
  @@index([tradeDate])
}

model SyncLog {
  id         String   @id @default(cuid())
  jobName    String   // e.g. "daily_candle_sync"
  status     String   // "running" / "success" / "failed"
  total      Int      @default(0)
  inserted   Int      @default(0)
  updated    Int      @default(0)
  errorMsg   String?
  startedAt  DateTime @default(now())
  finishedAt DateTime?
}
```

---

## 三、同步任务

### 3.1 Tushare API 频率限制（120积分免费账户）

| 接口 | 每分钟上限 | 每次最大条数 | 数据覆盖 |
|---|---|---|---|
| `daily` | 500次 | 6000条 | 单股23年历史 |
| `stock_basic` | 500次 | 2000条 | 全量 |
| `trade_cal` | 500次 | — | 全量 |
| `index_daily` | 500次 | 6000条 | 单指23年 |

**实际限制分析**：
- 沪深股票约 5000 只，每日增量同步：5000次 ÷ 500次/分钟 = **10分钟**（刚好跑完）
- 每请求间隔 = 60000ms ÷ 500 = **120ms**，加 20ms 安全缓冲 = **140ms/次**
- 全量历史同步（首次）：5000只 ÷ 500次/分钟 = **10分钟**（每只6000条一次拉完）
- 每日 16:00 后增量同步 1 条交易日数据：5000只 × 1条，5000次 = **10分钟**

### 3.2 同步任务列表

| 任务名 | cron 表达式 | 说明 |
|---|---|---|
| `sync_stock_basics` | `0 2 * * *` | 每天 02:00，全量拉取股票基础信息（约5000只，3次调用） |
| `sync_daily_candles` | `*/5 16-23 * * 1-5` | 交易日 16:00-23:55 每5分钟跑一次，增量同步（每次5000只股票，约10分钟） |
| `sync_index_basics` | `0 3 * * *` | 每天 03:00，拉取指数基础信息 |
| `sync_index_daily` | `*/10 16-22 * * 1-5` | 交易日 16:00-22:00 每10分钟一次（约10只指数，极快） |
| `sync_trade_cal` | `0 0 1 * *` | 每月1日拉取交易日历 |

### 3.3 同步逻辑

**限频策略**：
- 全局请求队列，保证任意时刻每分钟请求数 ≤ 500
- 相邻两次请求间隔 140ms（留20ms缓冲）
- 请求完成后记录 `SyncLog`，下次同步断点续传

**全量同步（首次）**：
1. 调 `stock_basic` 拿全部股票列表（约5000只，每2000条分页）
2. 调 `daily(ts_code='600519.SH')` 不带日期范围，每次6000条拉完23年历史
3. 每只股票 1 次 API 调用，5000调用 ÷ 500次/分钟 ≈ 10分钟

**每日增量同步**：
1. 查 `SyncLog` 获取 `last_success_date`（上次成功同步的日期）
2. 调 `daily(trade_date=上一交易日)`，不带 ts_code 参数，一次拿全部股票的当日数据（tushare 支持）
3. 5000只股票 × 1条 ≈ 5000调用 ≈ 10分钟
4. 完成后更新 `SyncLog`

**幂等处理**：使用 `@@unique([tsCode, tradeDate])` 约束，`upsert` 写入
**失败重试**：网络错误重试3次，每次间隔 30s；限频 429 错误等 60s 再试
**断点续传**：每次同步记录 `SyncLog.startedAt`，任务中断下次从断点继续，不重复拉取

### 3.3 调度器

**文件**: `lib/tushare/scheduler.ts`

- `startScheduler()` 启动所有 cron 任务
- `stopScheduler()` 优雅关闭
- 每次任务开始/结束记录 `SyncLog`
- 进程常驻，适合部署在 Railway/Render 等平台

---

## 四、前端 API 适配

现有 routes 不变，只需把 `lib/stockApi.ts` 的 mock 实现替换为 DB 查询：

| 函数 | 新的数据源 |
|---|---|
| `searchStocks` | `prisma.stockBasic.findMany({ where: { OR: [{ name: { contains: q }}, { symbol: { contains: q }}] }})` |
| `getKLineData` | `prisma.dailyCandle.findMany({ where: { tsCode }, orderBy: { tradeDate: asc } })` |
| `getStockInfo` | `prisma.stockBasic.findUnique({ where: { tsCode } })` |

**注意**：ts_code 格式为 `600519.SH`，需要和前端 code `600519` 兼容，在 DB 查询时做格式转换。

---

## 五、环境变量

```
TUSHARE_TOKEN=your_token_here   # .env.local
DATABASE_URL=file:./dev.db       # Prisma SQLite 开发用
```

---

## 六、目录结构

```
lib/
  tushare/
    client.ts      # tushare HTTP API 封装
    sync.ts        # 各数据同步任务实现
    scheduler.ts   # cron 调度器
  stockApi.ts     # 改为 DB 查询（替换 mock）
prisma/
  schema.prisma   # 扩展 StockBasic, DailyCandle 等表
jobs/
  sync.ts         # 可选：独立进程入口，用于 PM2/Docker
```

---

## 七、实现顺序

1. 配置 `TUSHARE_TOKEN`，验证 API 连通性
2. 扩展 Prisma Schema，migration
3. 实现 `lib/tushare/client.ts`
4. 实现 `lib/tushare/sync.ts`（stock_basic 先行）
5. 实现 `lib/tushare/scheduler.ts`
6. 改造 `lib/stockApi.ts` 查 DB
7. 接入 `sync_daily_candles`，验证日线数据写入
8. 部署验证（常驻进程或 Serverless + 定时触发）
