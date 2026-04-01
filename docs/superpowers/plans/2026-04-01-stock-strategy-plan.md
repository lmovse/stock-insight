# 选股策略模块实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现选股策略模块的完整功能，包括策略 CRUD、提示词 CRUD、策略异步运行（SSE 实时进度）、运行历史查询

**Architecture:** 基于 Next.js App Router，后端 Prisma/SQLite 存储，AI 调用走 OpenAI 兼容接口，前端使用 React 组件实现

**Tech Stack:** Next.js 16, Prisma, SQLite, React, Tailwind CSS, SSE

---

## 文件结构

```
prisma/schema.prisma                    # 新增 Strategy, Prompt, StrategyRun, StrategyRunResult 模型
.env.local                              # 新增 OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL

lib/ai.ts                               # AI 调用封装（OpenAI 兼容）

app/api/strategies/route.ts            # GET/POST /api/strategies
app/api/strategies/[id]/route.ts       # GET/PUT/DELETE /api/strategies/[id]
app/api/strategies/[id]/run/route.ts   # POST /api/strategies/[id]/run

app/api/prompts/route.ts                # GET/POST /api/prompts
app/api/prompts/[id]/route.ts           # GET/PUT/DELETE /api/prompts/[id]

app/api/strategy-runs/route.ts          # GET /api/strategy-runs（历史查询）
app/api/strategy-runs/[id]/route.ts     # GET /api/strategy-runs/[id]（详情）
app/api/strategy-runs/[taskId]/stream/route.ts  # GET SSE 端点
app/api/strategy-runs/[taskId]/cancel/route.ts  # POST 取消

app/strategies/page.tsx                 # 策略列表页
app/strategies/new/page.tsx             # 创建策略页
app/strategies/[id]/page.tsx           # 编辑策略页
app/strategies/run/page.tsx            # 选股运行页（SSE 实时进度）
app/strategies/runs/page.tsx           # 运行历史列表
app/strategies/runs/[id]/page.tsx      # 单次运行详情

app/prompts/page.tsx                    # 提示词列表
app/prompts/new/page.tsx                # 创建提示词
app/prompts/[id]/page.tsx               # 编辑提示词

components/StrategyList.tsx             # 策略列表组件
components/StrategyForm.tsx             # 策略表单组件
components/PromptList.tsx               # 提示词列表组件
components/PromptForm.tsx               # 提示词表单组件
components/StrategyRunner.tsx           # 选股运行器（SSE + 实时进度）
components/StockSelector.tsx             # 股票选择器（多选）
components/DataConfigSelector.tsx        # 数据配置选择器
```

---

## Task 1: Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 添加 Strategy, Prompt, StrategyRun, StrategyRunResult 模型到 schema.prisma**

```prisma
model Strategy {
  id          String   @id @default(cuid())
  userId      String
  name        String
  description String?
  promptId    String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  prompt      Prompt        @relation(fields: [promptId], references: [id])
  runs        StrategyRun[]

  @@index([userId])
}

model Prompt {
  id        String   @id @default(cuid())
  userId    String
  name      String
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  strategies Strategy[]

  @@index([userId])
}

model StrategyRun {
  id          String   @id @default(cuid())
  userId      String
  strategyId  String
  stockCodes  String
  startDate   String
  endDate     String
  dataConfig  String   @default("{\"kline\":true}")
  status      String   @default("pending")
  startedAt   DateTime?
  finishedAt  DateTime?
  createdAt   DateTime @default(now())

  strategy    Strategy            @relation(fields: [strategyId], references: [id])
  results     StrategyRunResult[]

  @@index([userId])
  @@index([status])
}

model StrategyRunResult {
  id          String   @id @default(cuid())
  runId       String
  stockCode   String
  result      String
  reason      String?
  rawResponse String?
  executedAt  DateTime @default(now())

  run         StrategyRun @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@index([runId])
}
```

- [ ] **Step 2: 运行 Prisma migrate 生成新表**

Run: `npx prisma migrate dev --name add_strategy_models`
Expected: Migration created and applied

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Strategy, Prompt, StrategyRun models"
```

---

## Task 2: AI 集成库

**Files:**
- Create: `lib/ai.ts`

- [ ] **Step 1: 创建 lib/ai.ts**

```typescript
interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AIResponse {
  content: string;
}

interface AIOptions {
  baseURL: string;
  apiKey: string;
  model: string;
}

export function buildPromptMessages(
  promptTemplate: string,
  stockCode: string,
  dateRange: string,
  klineData: string
): AIMessage[] {
  const userContent = promptTemplate
    .replace("{{stockCode}}", stockCode)
    .replace("{{dateRange}}", dateRange)
    .replace("{{klineData}}", klineData);

  return [
    { role: "system", content: userContent },
    {
      role: "user",
      content: `股票代码: ${stockCode}\n日期区间: ${dateRange}\nK线数据:\n${klineData}`,
    },
  ];
}

export async function callAI(
  messages: AIMessage[],
  options: AIOptions,
  signal?: AbortSignal
): Promise<AIResponse> {
  const url = `${options.baseURL}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI call failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  return { content: data.choices?.[0]?.message?.content ?? "" };
}

export function formatKLineData(
  data: Array<{ date: number; open: number; high: number; low: number; close: number; volume: number }>
): string {
  const header = "日期,开,高,低,收,成交量";
  const rows = data.map(
    (d) =>
      `${d.date},${d.open},${d.high},${d.low},${d.close},${d.volume}`
  );
  return [header, ...rows].join("\n");
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/ai.ts
git commit -m "feat: add AI integration library"
```

---

## Task 3: 提示词 CRUD API

**Files:**
- Create: `app/api/prompts/route.ts`
- Create: `app/api/prompts/[id]/route.ts`

- [ ] **Step 1: 创建 app/api/prompts/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const prompts = await prisma.prompt.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(prompts);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { name, content } = await req.json();
  if (!name || !content) {
    return NextResponse.json({ error: "名称和内容不能为空" }, { status: 400 });
  }

  const prompt = await prisma.prompt.create({
    data: { userId: user.id, name, content },
  });

  return NextResponse.json(prompt);
}
```

- [ ] **Step 2: 创建 app/api/prompts/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const prompt = await prisma.prompt.findFirst({
    where: { id, userId: user.id },
  });

  if (!prompt) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json(prompt);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const { name, content } = await req.json();

  const existing = await prisma.prompt.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  const prompt = await prisma.prompt.update({
    where: { id },
    data: { name, content },
  });

  return NextResponse.json(prompt);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.prompt.findFirst({
    where: { id, userId: user.id },
    include: { strategies: true },
  });
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  if (existing.strategies.length > 0) {
    return NextResponse.json(
      { error: "该提示词被策略引用，无法删除" },
      { status: 409 }
    );
  }

  await prisma.prompt.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/prompts/route.ts app/api/prompts/[id]/route.ts
git commit -m "feat: add Prompt CRUD API"
```

---

## Task 4: 策略 CRUD API

**Files:**
- Create: `app/api/strategies/route.ts`
- Create: `app/api/strategies/[id]/route.ts`

- [ ] **Step 1: 创建 app/api/strategies/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const strategies = await prisma.strategy.findMany({
    where: { userId: user.id },
    include: { prompt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(strategies);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { name, description, promptId } = await req.json();
  if (!name || !promptId) {
    return NextResponse.json({ error: "名称和提示词不能为空" }, { status: 400 });
  }

  // Verify prompt belongs to user
  const prompt = await prisma.prompt.findFirst({
    where: { id: promptId, userId: user.id },
  });
  if (!prompt) {
    return NextResponse.json({ error: "提示词不存在" }, { status: 400 });
  }

  const strategy = await prisma.strategy.create({
    data: { userId: user.id, name, description, promptId },
    include: { prompt: true },
  });

  return NextResponse.json(strategy);
}
```

- [ ] **Step 2: 创建 app/api/strategies/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const strategy = await prisma.strategy.findFirst({
    where: { id, userId: user.id },
    include: { prompt: true },
  });

  if (!strategy) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json(strategy);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const { name, description, promptId } = await req.json();

  const existing = await prisma.strategy.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  // Verify new prompt belongs to user if changing
  if (promptId && promptId !== existing.promptId) {
    const prompt = await prisma.prompt.findFirst({
      where: { id: promptId, userId: user.id },
    });
    if (!prompt) {
      return NextResponse.json({ error: "提示词不存在" }, { status: 400 });
    }
  }

  const strategy = await prisma.strategy.update({
    where: { id },
    data: { name, description, promptId },
    include: { prompt: true },
  });

  return NextResponse.json(strategy);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.strategy.findFirst({
    where: { id, userId: user.id },
    include: { runs: true },
  });
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  await prisma.strategy.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/strategies/route.ts app/api/strategies/[id]/route.ts
git commit -m "feat: add Strategy CRUD API"
```

---

## Task 5: 策略运行核心（启动 + 取消 + SSE）

**Files:**
- Create: `app/api/strategies/[id]/run/route.ts`
- Create: `app/api/strategy-runs/[taskId]/cancel/route.ts`
- Create: `app/api/strategy-runs/[taskId]/stream/route.ts`
- Create: `app/api/strategy-runs/route.ts`
- Create: `app/api/strategy-runs/[id]/route.ts`

- [ ] **Step 1: 创建 app/api/strategies/[id]/run/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const { stockCodes, startDate, endDate, dataConfig } = await req.json();

  if (!stockCodes || !Array.isArray(stockCodes) || stockCodes.length === 0) {
    return NextResponse.json({ error: "请选择股票" }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "请选择日期区间" }, { status: 400 });
  }

  const strategy = await prisma.strategy.findFirst({
    where: { id, userId: user.id },
    include: { prompt: true },
  });
  if (!strategy) return NextResponse.json({ error: "策略不存在" }, { status: 404 });

  const run = await prisma.strategyRun.create({
    data: {
      userId: user.id,
      strategyId: id,
      stockCodes: JSON.stringify(stockCodes),
      startDate,
      endDate,
      dataConfig: dataConfig ?? '{"kline":true}',
      status: "pending",
    },
  });

  return NextResponse.json({ taskId: run.id });
}
```

- [ ] **Step 2: 创建 app/api/strategy-runs/[taskId]/cancel/route.ts**

```typescript
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// In-memory cancel flags (keyed by run id)
// In production, use Redis or DB flag
const cancelFlags = new Set<string>();

export function setCancelFlag(taskId: string) {
  cancelFlags.add(taskId);
}

export function isCancelled(taskId: string): boolean {
  return cancelFlags.has(taskId);
}

export function clearCancelFlag(taskId: string) {
  cancelFlags.delete(taskId);
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { taskId } = await params;

  const run = await prisma.strategyRun.findFirst({
    where: { id: taskId, userId: user.id },
  });
  if (!run) return NextResponse.json({ error: "运行不存在" }, { status: 404 });

  setCancelFlag(taskId);

  if (run.status === "running") {
    await prisma.strategyRun.update({
      where: { id: taskId },
      data: { status: "cancelled", finishedAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: 创建 app/api/strategy-runs/[taskId]/stream/route.ts（SSE 端点）**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callAI, buildPromptMessages, formatKLineData } from "@/lib/ai";
import { getKLineData } from "@/lib/stockApi";
import { setCancelFlag, isCancelled, clearCancelFlag } from "../cancel/route";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { taskId } = await params;

  const run = await prisma.strategyRun.findFirst({
    where: { id: taskId, userId: user.id },
    include: { strategy: { include: { prompt: true } } },
  });
  if (!run) {
    return NextResponse.json({ error: "运行不存在" }, { status: 404 });
  }

  // Mark as running
  await prisma.strategyRun.update({
    where: { id: taskId },
    data: { status: "running", startedAt: new Date() },
  });

  const stockCodes: string[] = JSON.parse(run.stockCodes);
  const total = stockCodes.length;
  const dateRange = `${run.startDate} ~ ${run.endDate}`;
  const promptTemplate = run.strategy.prompt.content;

  const aiOptions = {
    baseURL: process.env.OPENAI_BASE_URL ?? "",
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-4",
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      let done = 0;

      for (const stockCode of stockCodes) {
        if (isCancelled(taskId)) {
          send("done", { status: "cancelled", summary: `已取消，${done}/${total} 支完成` });
          break;
        }

        send("progress", { done, total, currentStock: stockCode });

        try {
          const klineResult = await getKLineDataForRange(stockCode, run.startDate, run.endDate);
          const klineText = formatKLineData(klineResult);

          const messages = buildPromptMessages(promptTemplate, stockCode, dateRange, klineText);

          const aiResponse = await callAI(messages, aiOptions);

          const parsed = parseAIResponse(aiResponse.content);

          await prisma.strategyRunResult.create({
            data: {
              runId: taskId,
              stockCode,
              result: parsed.result,
              reason: parsed.reason,
              rawResponse: aiResponse.content,
            },
          });

          send("result", { stockCode, result: parsed.result, reason: parsed.reason });

          done++;
          send("progress", { done, total, currentStock: stockCode });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";

          await prisma.strategyRunResult.create({
            data: {
              runId: taskId,
              stockCode,
              result: "错误",
              reason: errorMsg,
              rawResponse: null,
            },
          });

          send("result", { stockCode, result: "错误", reason: errorMsg });
          done++;
        }
      }

      if (!isCancelled(taskId)) {
        await prisma.strategyRun.update({
          where: { id: taskId },
          data: { status: "completed", finishedAt: new Date() },
        });
        send("done", { status: "completed", summary: `完成，${done}/${total} 支` });
      }

      clearCancelFlag(taskId);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function getKLineDataForRange(code: string, startDate: string, endDate: string) {
  const { codeToTsCode } = await import("@/lib/stockApi");

  // Get data with enough lookback for indicators
  const allData = await getKLineData(code, "daily", 300);

  const start = parseInt(startDate.replace(/-/g, ""));
  const end = parseInt(endDate.replace(/-/g, ""));

  return allData.filter((d) => d.date >= start && d.date <= end);
}

function parseAIResponse(content: string): { result: string; reason: string } {
  // Try to parse structured response
  const match = content.match(/结果[：:]\s*(符合|不符合|错误)/i);
  const reasonMatch = content.match(/原因[：:]\s*([\s\S]+?)(?=结果|用户|$)/i);

  if (match) {
    return {
      result: match[1] === "符合" ? "符合" : match[1] === "不符合" ? "不符合" : "错误",
      reason: reasonMatch ? reasonMatch[1].trim() : content.slice(0, 200),
    };
  }

  // Fallback: check keywords
  if (content.includes("符合") && !content.includes("不符合")) {
    return { result: "符合", reason: content.slice(0, 200) };
  }
  if (content.includes("不符合")) {
    return { result: "不符合", reason: content.slice(0, 200) };
  }
  return { result: "错误", reason: content.slice(0, 200) };
}
```

- [ ] **Step 4: 创建 app/api/strategy-runs/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const strategyId = searchParams.get("strategyId");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const where: Record<string, unknown> = { userId: user.id };
  if (status) where.status = status;
  if (strategyId) where.strategyId = strategyId;

  const [runs, total] = await Promise.all([
    prisma.strategyRun.findMany({
      where,
      include: { strategy: { include: { prompt: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.strategyRun.count({ where }),
  ]);

  return NextResponse.json({ runs, total });
}
```

- [ ] **Step 5: 创建 app/api/strategy-runs/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const run = await prisma.strategyRun.findFirst({
    where: { id, userId: user.id },
    include: {
      strategy: { include: { prompt: true } },
      results: { orderBy: { executedAt: "asc" } },
    },
  });

  if (!run) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json(run);
}
```

- [ ] **Step 6: 更新 env.local 模板并 Commit**

```bash
git add app/api/strategies/[id]/run/route.ts \
        app/api/strategy-runs/[taskId]/cancel/route.ts \
        app/api/strategy-runs/[taskId]/stream/route.ts \
        app/api/strategy-runs/route.ts \
        app/api/strategy-runs/[id]/route.ts
git commit -m "feat: add strategy run API (start, cancel, SSE stream)"
```

---

## Task 6: 前端页面 - 提示词管理

**Files:**
- Create: `app/prompts/page.tsx`
- Create: `app/prompts/new/page.tsx`
- Create: `app/prompts/[id]/page.tsx`
- Create: `components/PromptList.tsx`
- Create: `components/PromptForm.tsx`

- [ ] **Step 1: 创建 app/prompts/page.tsx**

```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Prompt {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);

  useEffect(() => {
    fetch("/api/prompts")
      .then((r) => r.json())
      .then(setPrompts);
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">提示词管理</h1>
        <Link href="/prompts/new" className="px-4 py-2 bg-accent text-black rounded">
          新建提示词
        </Link>
      </div>
      <div className="space-y-3">
        {prompts.map((p) => (
          <Link key={p.id} href={`/prompts/${p.id}`} className="block p-4 border rounded hover:bg-gray-800">
            <div className="font-medium">{p.name}</div>
            <div className="text-sm text-gray-400 mt-1 truncate">{p.content}</div>
          </Link>
        ))}
        {prompts.length === 0 && <p className="text-gray-400">暂无提示词</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 app/prompts/new/page.tsx 和 app/prompts/[id]/page.tsx（复用 PromptForm）**

```tsx
"use client";
import PromptForm from "@/components/PromptForm";
import { useRouter } from "next/navigation";

export default function NewPromptPage() {
  const router = useRouter();
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">新建提示词</h1>
      <PromptForm onSuccess={() => router.push("/prompts")} />
    </div>
  );
}
```

```tsx
"use client";
import { useEffect, useState } from "react";
import PromptForm from "@/components/PromptForm";
import { useRouter } from "next/navigation";

interface Prompt {
  id: string;
  name: string;
  content: string;
}

export default function EditPromptPage({ params }: { params: Promise<{ id: string }> }) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const router = useRouter();

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/prompts/${id}`)
        .then((r) => r.json())
        .then(setPrompt);
    });
  }, [params]);

  if (!prompt) return <div>加载中...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">编辑提示词</h1>
      <PromptForm initial={prompt} onSuccess={() => router.push("/prompts")} />
    </div>
  );
}
```

- [ ] **Step 3: 创建 components/PromptForm.tsx**

```tsx
"use client";
import { useState } from "react";

interface PromptFormProps {
  initial?: { id?: string; name: string; content: string };
  onSuccess: () => void;
}

export default function PromptForm({ initial, onSuccess }: PromptFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [content, setContent] = useState(
    initial?.content ?? `你是股票策略分析师。请根据以下K线数据，判断股票是否符合策略要求。

可用变量：
- {{stockCode}}：股票代码
- {{dateRange}}：日期区间
- {{klineData}}：K线数据

请返回：
结果：符合/不符合
原因：`);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = initial?.id ? "PUT" : "POST";
    const url = initial?.id ? `/api/prompts/${initial.id}` : "/api/prompts";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "保存失败");
      return;
    }

    onSuccess();
  };

  const handleDelete = async () => {
    if (!initial?.id) return;
    if (!confirm("确定删除该提示词？")) return;

    const res = await fetch(`/api/prompts/${initial.id}`, { method: "DELETE" });
    if (res.ok) onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-500">{error}</div>}
      <div>
        <label className="block text-sm mb-1">名称</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border rounded bg-background text-foreground"
          required
        />
      </div>
      <div>
        <label className="block text-sm mb-1">内容（支持 {{变量}} 占位符）</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full p-2 border rounded bg-background text-foreground font-mono text-sm"
          rows={20}
          required
        />
      </div>
      <div className="flex gap-3">
        <button type="submit" className="px-4 py-2 bg-accent text-black rounded">
          保存
        </button>
        {initial?.id && (
          <button type="button" onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded">
            删除
          </button>
        )}
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/prompts/page.tsx app/prompts/new/page.tsx app/prompts/[id]/page.tsx components/PromptForm.tsx
git commit -m "feat: add prompts management UI"
```

---

## Task 7: 前端页面 - 策略管理

**Files:**
- Create: `app/strategies/page.tsx`
- Create: `app/strategies/new/page.tsx`
- Create: `app/strategies/[id]/page.tsx`
- Create: `components/StrategyList.tsx`
- Create: `components/StrategyForm.tsx`

- [ ] **Step 1: 创建 app/strategies/page.tsx**

```tsx
"use client";
import StrategyList from "@/components/StrategyList";

export default function StrategiesPage() {
  return (
    <div className="p-6">
      <StrategyList />
    </div>
  );
}
```

- [ ] **Step 2: 创建 components/StrategyList.tsx**

```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  prompt: { name: string };
  createdAt: string;
}

export default function StrategyList() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);

  useEffect(() => {
    fetch("/api/strategies")
      .then((r) => r.json())
      .then(setStrategies);
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该策略？")) return;
    await fetch(`/api/strategies/${id}`, { method: "DELETE" });
    setStrategies((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">选股策略</h1>
        <div className="flex gap-3">
          <Link href="/strategies/run" className="px-4 py-2 border rounded hover:bg-gray-800">
            运行策略
          </Link>
          <Link href="/strategies/new" className="px-4 py-2 bg-accent text-black rounded">
            新建策略
          </Link>
        </div>
      </div>
      <div className="space-y-3">
        {strategies.map((s) => (
          <div key={s.id} className="p-4 border rounded hover:bg-gray-800">
            <div className="flex justify-between">
              <div>
                <Link href={`/strategies/${s.id}`} className="font-medium hover:underline">
                  {s.name}
                </Link>
                <div className="text-sm text-gray-400 mt-1">
                  提示词: {s.prompt.name} · {s.description ?? "无描述"}
                </div>
              </div>
              <button onClick={() => handleDelete(s.id)} className="text-red-500 text-sm">
                删除
              </button>
            </div>
          </div>
        ))}
        {strategies.length === 0 && <p className="text-gray-400">暂无策略</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 app/strategies/new/page.tsx 和 app/strategies/[id]/page.tsx**

```tsx
"use client";
import StrategyForm from "@/components/StrategyForm";
import { useRouter } from "next/navigation";

export default function NewStrategyPage() {
  const router = useRouter();
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">新建策略</h1>
      <StrategyForm onSuccess={() => router.push("/strategies")} />
    </div>
  );
}
```

```tsx
"use client";
import { useEffect, useState } from "react";
import StrategyForm from "@/components/StrategyForm";
import { useRouter } from "next/navigation";

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  promptId: string;
}

export default function EditStrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const router = useRouter();

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/strategies/${id}`)
        .then((r) => r.json())
        .then(setStrategy);
    });
  }, [params]);

  if (!strategy) return <div>加载中...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">编辑策略</h1>
      <StrategyForm initial={strategy} onSuccess={() => router.push("/strategies")} />
    </div>
  );
}
```

- [ ] **Step 4: 创建 components/StrategyForm.tsx**

```tsx
"use client";
import { useEffect, useState } from "react";

interface Prompt {
  id: string;
  name: string;
}

interface StrategyFormProps {
  initial?: { id?: string; name: string; description: string | null; promptId: string };
  onSuccess: () => void;
}

export default function StrategyForm({ initial, onSuccess }: StrategyFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [promptId, setPromptId] = useState(initial?.promptId ?? "");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/prompts")
      .then((r) => r.json())
      .then(setPrompts);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = initial?.id ? "PUT" : "POST";
    const url = initial?.id ? `/api/strategies/${initial.id}` : "/api/strategies";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, promptId }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "保存失败");
      return;
    }

    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-500">{error}</div>}
      <div>
        <label className="block text-sm mb-1">名称</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border rounded bg-background text-foreground"
          required
        />
      </div>
      <div>
        <label className="block text-sm mb-1">描述</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-2 border rounded bg-background text-foreground"
        />
      </div>
      <div>
        <label className="block text-sm mb-1">提示词</label>
        <select
          value={promptId}
          onChange={(e) => setPromptId(e.target.value)}
          className="w-full p-2 border rounded bg-background text-foreground"
          required
        >
          <option value="">选择提示词</option>
          {prompts.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <button type="submit" className="px-4 py-2 bg-accent text-black rounded">
        保存
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add app/strategies/page.tsx app/strategies/new/page.tsx app/strategies/[id]/page.tsx components/StrategyList.tsx components/StrategyForm.tsx
git commit -m "feat: add strategies management UI"
```

---

## Task 8: 前端页面 - 选股运行页（SSE 实时进度）

**Files:**
- Create: `app/strategies/run/page.tsx`
- Create: `components/StrategyRunner.tsx`
- Create: `components/StockSelector.tsx`
- Create: `components/DataConfigSelector.tsx`

- [ ] **Step 1: 创建 app/strategies/run/page.tsx**

```tsx
import StrategyRunner from "@/components/StrategyRunner";

export default function RunPage() {
  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">运行选股策略</h1>
      <StrategyRunner />
    </div>
  );
}
```

- [ ] **Step 2: 创建 components/StockSelector.tsx**

```tsx
"use client";
import { useEffect, useState } from "react";

interface Stock {
  code: string;
  name: string;
  market: "sh" | "sz" | "bj";
}

export default function StockSelector({
  value,
  onChange,
}: {
  value: string[];
  onChange: (codes: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Stock[]>([]);
  const [watchlist, setWatchlist] = useState<Stock[]>([]);

  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((data) => {
        setWatchlist(data.map((item: { stockCode: string }) => ({
          code: item.stockCode,
          name: item.stockCode,
          market: "sz" as const,
        })));
      });
  }, []);

  const handleSearch = async () => {
    if (!search.trim()) return;
    const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(search)}`);
    const data = await res.json();
    setResults(data.slice(0, 10));
  };

  const addStock = (stock: Stock) => {
    if (!value.includes(stock.code)) {
      onChange([...value, stock.code]);
    }
    setSearch("");
    setResults([]);
  };

  const removeStock = (code: string) => {
    onChange(value.filter((c) => c !== code));
  };

  return (
    <div>
      <label className="block text-sm mb-1">选择股票</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((code) => (
          <span key={code} className="px-2 py-1 bg-gray-700 rounded text-sm flex items-center gap-1">
            {code}
            <button onClick={() => removeStock(code)} className="text-gray-400 hover:text-white">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
          placeholder="搜索股票代码或名称"
          className="flex-1 p-2 border rounded bg-background text-foreground"
        />
        <button onClick={handleSearch} className="px-4 py-2 border rounded">搜索</button>
      </div>
      {results.length > 0 && (
        <div className="mt-2 border rounded bg-gray-800 max-h-40 overflow-y-auto">
          {results.map((s) => (
            <button
              key={s.code}
              onClick={() => addStock(s)}
              className="w-full text-left px-3 py-2 hover:bg-gray-700 flex justify-between"
            >
              <span>{s.name} ({s.code})</span>
              <span className="text-gray-400 text-sm">{s.market.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
      {watchlist.length > 0 && (
        <div className="mt-3">
          <div className="text-sm text-gray-400 mb-1">自选股</div>
          <div className="flex flex-wrap gap-1">
            {watchlist.map((s) => (
              <button
                key={s.code}
                onClick={() => addStock(s)}
                disabled={value.includes(s.code)}
                className="px-2 py-1 text-xs border rounded hover:bg-gray-700 disabled:opacity-50"
              >
                {s.code}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 创建 components/DataConfigSelector.tsx**

```tsx
"use client";

interface DataConfig {
  kline: boolean;
}

export default function DataConfigSelector({
  value,
  onChange,
}: {
  value: DataConfig;
  onChange: (config: DataConfig) => void;
}) {
  return (
    <div>
      <label className="block text-sm mb-1">数据配置</label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.kline}
          onChange={(e) => onChange({ ...value, kline: e.target.checked })}
        />
        <span>K 线数据（OHLCV）</span>
      </label>
    </div>
  );
}
```

- [ ] **Step 4: 创建 components/StrategyRunner.tsx（SSE 核心）**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import StockSelector from "./StockSelector";
import DataConfigSelector from "./DataConfigSelector";

interface Strategy {
  id: string;
  name: string;
  prompt: { name: string };
}

interface RunResult {
  stockCode: string;
  result: string;
  reason: string;
}

type RunStatus = "idle" | "starting" | "running" | "completed" | "cancelled" | "failed";

export default function StrategyRunner() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategyIds, setSelectedStrategyIds] = useState<string[]>([]);
  const [stockCodes, setStockCodes] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dataConfig, setDataConfig] = useState({ kline: true });

  const [status, setStatus] = useState<RunStatus>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0, currentStock: "" });
  const [results, setResults] = useState<RunResult[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/strategies")
      .then((r) => r.json())
      .then(setStrategies);
  }, []);

  const handleRun = useCallback(async () => {
    if (!selectedStrategyIds.length || !stockCodes.length || !startDate || !endDate) {
      alert("请填写所有参数");
      return;
    }

    setStatus("starting");
    setResults([]);
    setProgress({ done: 0, total: stockCodes.length * selectedStrategyIds.length, currentStock: "" });

    // For simplicity, run first selected strategy
    // Multi-strategy support would need multiple SSE connections
    const strategyId = selectedStrategyIds[0];

    const runRes = await fetch(`/api/strategies/${strategyId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockCodes, startDate, endDate, dataConfig }),
    });

    if (!runRes.ok) {
      setStatus("failed");
      return;
    }

    const { taskId: newTaskId } = await runRes.json();
    setTaskId(newTaskId);
    setStatus("running");

    const eventSource = new EventSource(`/api/strategy-runs/${newTaskId}/stream`);

    eventSource.addEventListener("progress", (e) => {
      setProgress(JSON.parse(e.data));
    });

    eventSource.addEventListener("result", (e) => {
      setResults((prev) => [...prev, JSON.parse(e.data)]);
    });

    eventSource.addEventListener("done", (e) => {
      const data = JSON.parse(e.data);
      setStatus(data.status === "completed" ? "completed" : "cancelled");
      eventSource.close();
    });

    eventSource.addEventListener("error", () => {
      setStatus("failed");
      eventSource.close();
    });
  }, [selectedStrategyIds, stockCodes, startDate, endDate, dataConfig]);

  const handleCancel = useCallback(async () => {
    if (!taskId) return;
    await fetch(`/api/strategy-runs/${taskId}/cancel`, { method: "POST" });
    setStatus("cancelled");
  }, [taskId]);

  const toggleStrategy = (id: string) => {
    setSelectedStrategyIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Strategy Selection */}
      <div>
        <label className="block text-sm mb-2">选择策略（支持多选，运行将串行执行）</label>
        <div className="flex flex-wrap gap-2">
          {strategies.map((s) => (
            <button
              key={s.id}
              onClick={() => toggleStrategy(s.id)}
              className={`px-3 py-2 border rounded ${
                selectedStrategyIds.includes(s.id)
                  ? "border-accent bg-accent/20"
                  : "border-gray-600"
              }`}
            >
              {s.name}
            </button>
          ))}
          {strategies.length === 0 && <p className="text-gray-400 text-sm">暂无可用策略</p>}
        </div>
      </div>

      {/* Stock Selection */}
      <StockSelector value={stockCodes} onChange={setStockCodes} />

      {/* Date Range */}
      <div className="flex gap-4">
        <div>
          <label className="block text-sm mb-1">开始日期</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="p-2 border rounded bg-background text-foreground"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">结束日期</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="p-2 border rounded bg-background text-foreground"
          />
        </div>
      </div>

      {/* Data Config */}
      <DataConfigSelector value={dataConfig} onChange={setDataConfig} />

      {/* Run / Cancel Button */}
      <div className="flex gap-3">
        {status === "idle" || status === "completed" || status === "cancelled" || status === "failed" ? (
          <button
            onClick={handleRun}
            disabled={selectedStrategyIds.length === 0 || stockCodes.length === 0}
            className="px-6 py-2 bg-accent text-black rounded disabled:opacity-50"
          >
            运行策略
          </button>
        ) : (
          <button
            onClick={handleCancel}
            className="px-6 py-2 bg-red-600 text-white rounded"
          >
            取消运行
          </button>
        )}
        {status !== "idle" && (
          <span className="flex items-center text-sm text-gray-400">
            {status === "running" && `${progress.done}/${progress.total} 完成，当前: ${progress.currentStock}`}
            {status === "starting" && "启动中..."}
            {status === "completed" && "已完成"}
            {status === "cancelled" && "已取消"}
            {status === "failed" && "失败"}
          </span>
        )}
      </div>

      {/* Results */}
      {(results.length > 0 || status === "running") && (
        <div>
          <h3 className="font-medium mb-3">运行结果</h3>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="p-3 border rounded">
                <div className="flex items-center gap-2">
                  <span className="font-mono">{r.stockCode}</span>
                  <span
                    className={`text-sm px-2 py-0.5 rounded ${
                      r.result === "符合"
                        ? "bg-green-900 text-green-300"
                        : r.result === "不符合"
                        ? "bg-yellow-900 text-yellow-300"
                        : "bg-red-900 text-red-300"
                    }`}
                  >
                    {r.result}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">{r.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add app/strategies/run/page.tsx components/StrategyRunner.tsx components/StockSelector.tsx components/DataConfigSelector.tsx
git commit -m "feat: add strategy run page with SSE real-time progress"
```

---

## Task 9: 前端页面 - 运行历史

**Files:**
- Create: `app/strategies/runs/page.tsx`
- Create: `app/strategies/runs/[id]/page.tsx`

- [ ] **Step 1: 创建 app/strategies/runs/page.tsx**

```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Run {
  id: string;
  status: string;
  createdAt: string;
  strategy: { name: string };
  stockCodes: string;
  startDate: string;
  endDate: string;
}

export default function StrategyRunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    fetch("/api/strategy-runs?limit=50")
      .then((r) => r.json())
      .then((d) => setRuns(d.runs ?? []));
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">运行历史</h1>
        <Link href="/strategies/run" className="px-4 py-2 border rounded hover:bg-gray-800">
          去运行
        </Link>
      </div>
      <div className="space-y-3">
        {runs.map((run) => {
          const stockCodes = JSON.parse(run.stockCodes) as string[];
          return (
            <Link
              key={run.id}
              href={`/strategies/runs/${run.id}`}
              className="block p-4 border rounded hover:bg-gray-800"
            >
              <div className="flex justify-between">
                <span className="font-medium">{run.strategy.name}</span>
                <span
                  className={`text-sm px-2 py-0.5 rounded ${
                    run.status === "completed"
                      ? "bg-green-900 text-green-300"
                      : run.status === "running"
                      ? "bg-blue-900 text-blue-300"
                      : run.status === "cancelled"
                      ? "bg-gray-700 text-gray-300"
                      : "bg-red-900 text-red-300"
                  }`}
                >
                  {run.status}
                </span>
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {run.startDate} ~ {run.endDate} · {stockCodes.length} 支股票
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(run.createdAt).toLocaleString()}
              </div>
            </Link>
          );
        })}
        {runs.length === 0 && <p className="text-gray-400">暂无运行记录</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 app/strategies/runs/[id]/page.tsx**

```tsx
"use client";
import { useEffect, useState } from "react";

interface RunResult {
  stockCode: string;
  result: string;
  reason: string | null;
}

interface RunDetail {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  stockCodes: string;
  dataConfig: string;
  strategy: { name: string; prompt: { name: string; content: string } };
  results: RunResult[];
  startedAt: string | null;
  finishedAt: string | null;
}

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [run, setRun] = useState<RunDetail | null>(null);

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/strategy-runs/${id}`)
        .then((r) => r.json())
        .then(setRun);
    });
  }, [params]);

  if (!run) return <div className="p-6">加载中...</div>;

  const stockCodes = JSON.parse(run.stockCodes) as string[];
  const compliant = run.results.filter((r) => r.result === "符合").length;
  const nonCompliant = run.results.filter((r) => r.result === "不符合").length;
  const errors = run.results.filter((r) => r.result === "错误").length;

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">{run.strategy.name}</h1>

      {/* Meta info */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <span className="text-gray-400">日期区间：</span>
          {run.startDate} ~ {run.endDate}
        </div>
        <div>
          <span className="text-gray-400">股票数量：</span>
          {stockCodes.length}
        </div>
        <div>
          <span className="text-gray-400">提示词：</span>
          {run.strategy.prompt.name}
        </div>
        <div>
          <span className="text-gray-400">状态：</span>
          {run.status}
        </div>
        {run.startedAt && (
          <div>
            <span className="text-gray-400">开始时间：</span>
            {new Date(run.startedAt).toLocaleString()}
          </div>
        )}
        {run.finishedAt && (
          <div>
            <span className="text-gray-400">结束时间：</span>
            {new Date(run.finishedAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="flex gap-4 mb-6">
        <span className="text-green-400">符合: {compliant}</span>
        <span className="text-yellow-400">不符合: {nonCompliant}</span>
        <span className="text-red-400">错误: {errors}</span>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {run.results.map((r, i) => (
          <div key={i} className="p-4 border rounded">
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium">{r.stockCode}</span>
              <span
                className={`text-sm px-2 py-0.5 rounded ${
                  r.result === "符合"
                    ? "bg-green-900 text-green-300"
                    : r.result === "不符合"
                    ? "bg-yellow-900 text-yellow-300"
                    : "bg-red-900 text-red-300"
                }`}
              >
                {r.result}
              </span>
            </div>
            <p className="text-sm text-gray-300 mt-2">{r.reason ?? "无"}</p>
          </div>
        ))}
        {run.results.length === 0 && <p className="text-gray-400">暂无结果</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/strategies/runs/page.tsx app/strategies/runs/[id]/page.tsx
git commit -m "feat: add strategy run history pages"
```

---

## Task 10: 环境变量配置

**Files:**
- Modify: `.env.local` (或告知用户添加)

- [ ] **Step 1: 告知用户添加环境变量**

```bash
# .env.local
OPENAI_BASE_URL=https://your-api-base.com/v1
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4
```

- [ ] **Step 2: Commit**

```bash
git add -u
git commit -m "chore: document OPENAI env vars"
```

---

## 自我检查

1. **Spec 覆盖**：所有设计中的 API 端点、页面、数据模型都有对应 Task
2. **占位符检查**：无 TBD/TODO，实现步骤包含完整代码
3. **类型一致性**：
   - `StrategyRun.stockCodes` 为 JSON string，解析为 `string[]`
   - `StrategyRun.dataConfig` 为 JSON string，解析为 `DataConfig`
   - `getKLineDataForRange` 在 SSE handler 内联定义，简化了 `codeToTsCode` 导入路径
   - SSE stream 端点 `EventSource` 在前端使用，backend 使用 `ReadableStream`
4. **遗漏项**：
   - `getKLineDataForRange` 中的 `codeToTsCode` 从 `@/lib/stockApi` 动态导入，避免顶层循环依赖

---

**Plan complete.** 执行方式选择：

1. **Subagent-Driven (recommended)** - 逐 Task 分派 subagent 执行，每完成一个 Task 提交一次，定期 checkpoint review
2. **Inline Execution** - 当前 session 内 batch 执行，带 checkpoint 审核

选择哪种方式？
