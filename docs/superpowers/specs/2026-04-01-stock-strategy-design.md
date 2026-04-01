# 选股策略模块设计

## 概述

为 Stock Insight 添加选股策略模块，支持用户创建、管理策略提示词，通过 AI 分析指定股票在指定日期区间内是否符合策略要求。运行时支持实时进度查看、手动取消，运行结果持久化可查询。

---

## 核心功能

### 1. 策略管理（Strategy CRUD）

- **创建/编辑策略**：名称、描述、关联提示词
- **列表/详情/删除**
- 策略是用户私有的（绑定 userId）

### 2. 提示词管理（Prompt CRUD）

- 提示词作为独立实体，可被多个策略复用
- **模板变量**：支持 `{{stockCode}}`、`{{dateRange}}`、`{{klineData}}` 占位符，运行时替换
- 提示词是用户私有的

### 3. 策略运行（Strategy Run）

**运行时参数**：
- 股票列表（多选，支持从自选股或搜索选择）
- 日期区间（开始日期 ~ 结束日期）
- 数据配置（初始仅 K 线 OHLCV）

**执行流程**：
1. 前端发起 `POST /api/strategies/{id}/run`，传入运行参数
2. 后端创建 `StrategyRun` 记录（status=pending），立即返回 `taskId`
3. 前端连接 `GET /api/strategy-runs/{taskId}/stream`（SSE）
4. 后端异步处理每支股票：
   - 获取 K 线数据
   - 渲染提示词模板（替换变量）
   - 调用 AI（OpenAI 兼容格式）
   - 每完成一支，通过 SSE 推送结果
5. 运行状态：`pending` → `running` → `completed` / `cancelled` / `failed`
6. 支持 `POST /api/strategy-runs/{taskId}/cancel` 取消

**实时推送事件（SSE）**：
- `progress`: `{ done: number, total: number, currentStock: string }`
- `result`: `{ stockCode, result, reason, rawResponse }`
- `done`: `{ status, summary }`
- `error`: `{ message }`

### 4. 运行历史查询

- 按时间范围、策略、状态筛选
- 查看每次运行的参数（股票、日期区间、数据配置）
- 查看每支股票的执行结果

---

## 数据模型

### Strategy（策略）

```prisma
model Strategy {
  id          String   @id @default(cuid())
  userId      String
  name        String
  description String?
  promptId    String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  prompt      Prompt       @relation(...)
  runs        StrategyRun[]
}
```

### Prompt（提示词）

```prisma
model Prompt {
  id        String   @id @default(cuid())
  userId    String
  name      String
  content   String   // 模板，支持 {{stockCode}}, {{dateRange}}, {{klineData}}
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  strategies Strategy[]
}
```

### StrategyRun（运行快照）

```prisma
model StrategyRun {
  id          String   @id @default(cuid())
  userId      String
  strategyId  String
  stockCodes  String   // JSON: ["600519", "000001"]
  startDate   String
  endDate     String
  dataConfig  String   @default("{\"kline\":true}")  // JSON
  status      String   @default("pending")  // pending|running|completed|cancelled|failed
  results     StrategyRunResult[]
  startedAt   DateTime?
  finishedAt  DateTime?
  createdAt   DateTime @default(now())

  strategy    Strategy @relation(...)
}
```

### StrategyRunResult（单次执行结果）

```prisma
model StrategyRunResult {
  id          String   @id @default(cuid())
  runId       String
  stockCode   String
  result      String   // 符合|不符合|错误
  reason      String?
  rawResponse String?
  executedAt  DateTime @default(now())

  run         StrategyRun @relation(...)
}
```

---

## API 设计

### 策略

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/strategies` | 列表 |
| POST | `/api/strategies` | 创建 |
| GET | `/api/strategies/[id]` | 详情 |
| PUT | `/api/strategies/[id]` | 更新 |
| DELETE | `/api/strategies/[id]` | 删除 |

### 提示词

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/prompts` | 列表 |
| POST | `/api/prompts` | 创建 |
| GET | `/api/prompts/[id]` | 详情 |
| PUT | `/api/prompts/[id]` | 更新 |
| DELETE | `/api/prompts/[id]` | 删除 |

### 策略运行

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/strategy-runs` | 运行历史 |
| GET | `/api/strategy-runs/[id]` | 运行详情（含结果） |
| POST | `/api/strategies/[id]/run` | 启动运行 → `{ taskId }` |
| POST | `/api/strategy-runs/[taskId]/cancel` | 取消运行 |
| GET | `/api/strategy-runs/[taskId]/stream` | SSE 实时推送端点 |

---

## AI 调用

### 请求格式（OpenAI 兼容）

```
POST {BASE_URL}/chat/completions
Headers: Authorization: Bearer {API_KEY}
{
  "model": "gpt-4",
  "messages": [
    {"role": "system", "content": "[提示词模板 content]"},
    {"role": "user", "content": "股票代码: {{stockCode}}\n日期区间: {{dateRange}}\nK线数据:\n{{klineData}}"}
  ]
}
```

### 运行时变量替换

| 变量 | 示例 |
|------|------|
| `{{stockCode}}` | 600519 |
| `{{dateRange}}` | 2026-01-01 ~ 2026-03-31 |
| `{{klineData}}` | 日期,开,高,低,收,成交量\n20260101,100,105,98,103,5000000... |

### K 线数据格式

```
日期,开,高,低,收,成交量
20260101,100.0,105.0,98.0,103.0,5000000
20260102,103.0,108.0,102.0,107.0,6200000
...
```

---

## 前端页面

| 路径 | 说明 |
|------|------|
| `/strategies` | 策略列表 |
| `/strategies/new` | 创建策略 |
| `/strategies/[id]` | 编辑策略 |
| `/strategies/run` | **选股运行页**：选择策略/股票/日期区间/数据配置，运行并实时查看结果 |
| `/strategies/runs` | 运行历史列表 |
| `/strategies/runs/[id]` | 单次运行详情 |
| `/prompts` | 提示词管理列表 |
| `/prompts/new` | 创建提示词 |
| `/prompts/[id]` | 编辑提示词 |

---

## 环境变量

```
OPENAI_BASE_URL=https://your-api-base.com/v1
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4
```

---

## 技术要点

1. **SSE 实现**：使用 Next.js App Router 的 `Response` + `ReadableStream`，通过 `text/event-stream` 格式推送
2. **取消机制**：使用 `AbortController` 标记取消状态，异步任务检测到取消后停止后续处理
3. **并发控制**：建议单次运行最多 N 支股票（防止 token 溢出），可配置
4. **任务持久化**：运行快照存储在 SQLite，进程重启后可继续查询

---

## 修订记录

- 2026-04-01: 初始设计
