# 脚本策略模块实现计划

> **For agentic workers:** Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现脚本策略模块，用户可选择Python脚本运行策略，AI分析结果并展示，查看历史记录。

**Architecture:** 前端新增Tab切换到脚本策略页面，后端新增API执行Python脚本并存储结果，调用AI分析输出。

**Tech Stack:** Next.js App Router, Prisma (SQLite), child_process (Node.js), Python subprocess

---

## 文件结构

```
prisma/schema.prisma          # 新增 ScriptStrategy, ScriptRun 表
app/api/scripts/
├── strategies/
│   ├── route.ts              # GET/POST /api/scripts/strategies
│   └── [id]/
│       ├── route.ts          # GET/PUT/DELETE /api/scripts/strategies/[id]
│       └── run/
│           └── route.ts      # POST /api/scripts/strategies/[id]/run
├── runs/
│   ├── route.ts              # GET /api/scripts/runs
│   └── [id]/
│       └── route.ts          # GET /api/scripts/runs/[id]
app/strategies/
├── page.tsx                  # 修改：新增Tab切换
scripts/
├── screen_today_signals.py   # 重构：输出JSON格式
```

---

## Task 1: Prisma Schema 迁移

**Files:**
- Modify: `prisma/schema.prisma:234-281`

- [ ] **Step 1: 添加 ScriptStrategy 和 ScriptRun 模型**

在 `model Prompt` 后添加：

```prisma
model ScriptStrategy {
  id          String   @id @default(cuid())
  name        String
  description String?
  scriptPath  String
  params      String?
  createdAt   DateTime @default(now())

  runs        ScriptRun[]
}

model ScriptRun {
  id                String   @id @default(cuid())
  scriptStrategyId  String
  params            String
  result            String?
  analysis          String?
  status            String   @default("pending")
  error             String?
  createdAt         DateTime @default(now())
  finishedAt        DateTime?

  script            ScriptStrategy @relation(fields: [scriptStrategyId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: 运行 Prisma Migration**

```bash
npx prisma migrate dev --name add_script_strategy
```

- [ ] **Step 3: 提交**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add ScriptStrategy and ScriptRun models"
```

---

## Task 2: 基础 API - 脚本策略 CRUD

**Files:**
- Create: `app/api/scripts/strategies/route.ts`
- Create: `app/api/scripts/strategies/[id]/route.ts`

- [ ] **Step 1: 创建 GET/POST /api/scripts/strategies**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const strategies = await prisma.scriptStrategy.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(strategies);
}

export async function POST(req: NextRequest) {
  const { name, description, scriptPath, params } = await req.json();
  if (!name || !scriptPath) {
    return NextResponse.json({ error: "名称和脚本路径不能为空" }, { status: 400 });
  }

  const strategy = await prisma.scriptStrategy.create({
    data: { name, description, scriptPath, params },
  });

  return NextResponse.json(strategy);
}
```

- [ ] **Step 2: 创建 GET/PUT/DELETE /api/scripts/strategies/[id]**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const strategy = await prisma.scriptStrategy.findUnique({
    where: { id },
    include: { runs: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  if (!strategy) {
    return NextResponse.json({ error: "策略不存在" }, { status: 404 });
  }
  return NextResponse.json(strategy);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, description, scriptPath, params: scriptParams } = await req.json();
  const strategy = await prisma.scriptStrategy.update({
    where: { id },
    data: { name, description, scriptPath, params: scriptParams },
  });
  return NextResponse.json(strategy);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.scriptStrategy.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: 提交**

```bash
git add app/api/scripts/strategies/
git commit -m "feat: add scripts/strategies CRUD API"
```

---

## Task 3: 脚本执行 API

**Files:**
- Create: `app/api/scripts/strategies/[id]/run/route.ts`
- Create: `app/api/scripts/run/route.ts`
- Create: `app/api/scripts/runs/[id]/route.ts`

- [ ] **Step 1: 创建 /api/scripts/strategies/[id]/run**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spawn } from "child_process";
import path from "path";
import { promisify } from "util";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { date, ...extraParams } = await req.json();

  const strategy = await prisma.scriptStrategy.findUnique({ where: { id } });
  if (!strategy) {
    return NextResponse.json({ error: "策略不存在" }, { status: 404 });
  }

  // 创建运行记录
  const runParams = JSON.stringify({ date, ...extraParams });
  const run = await prisma.scriptRun.create({
    data: { scriptStrategyId: id, params: runParams, status: "running" },
  });

  // 异步执行脚本
  const scriptPath = path.join(process.cwd(), "scripts", strategy.scriptPath);
  const args = ["scripts/" + strategy.scriptPath];
  if (date) args.push("--date", date);

  const execPromise = new Promise<string>((resolve, reject) => {
    const proc = spawn("python", args, { cwd: process.cwd() });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });

    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Exit code ${code}`));
    });
    proc.on("error", reject);
  });

  // 立即返回，后台执行
  execPromise
    .then(async (result) => {
      await prisma.scriptRun.update({
        where: { id: run.id },
        data: { status: "completed", result, finishedAt: new Date() },
      });
    })
    .catch(async (err) => {
      await prisma.scriptRun.update({
        where: { id: run.id },
        data: { status: "failed", error: err.message, finishedAt: new Date() },
      });
    });

  return NextResponse.json({ runId: run.id });
}
```

- [ ] **Step 2: 创建 /api/scripts/runs 和 /api/scripts/runs/[id]**

```typescript
// app/api/scripts/runs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const strategyId = searchParams.get("strategyId");
  const limit = parseInt(searchParams.get("limit") || "20");

  const runs = await prisma.scriptRun.findMany({
    where: strategyId ? { scriptStrategyId: strategyId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json(runs);
}
```

```typescript
// app/api/scripts/runs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await prisma.scriptRun.findUnique({ where: { id } });
  if (!run) {
    return NextResponse.json({ error: "运行记录不存在" }, { status: 404 });
  }
  return NextResponse.json(run);
}
```

- [ ] **Step 3: 提交**

```bash
git add app/api/scripts/
git commit -m "feat: add script execution API"
```

---

## Task 4: 重构 screen_today_signals.py 输出 JSON

**Files:**
- Modify: `scripts/screen_today_signals.py`

- [ ] **Step 1: 重构为 JSON 输出**

将现有的 print 输出改为 JSON 格式：

```python
#!/usr/bin/env python3
"""
当日信号检测脚本 - 输出 JSON 格式
用法: python scripts/screen_today_signals.py --date 20260522
"""
import argparse
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import sys

DB_PATH = "prisma/dev.db"

# ... (保持现有的 get_stock_codes, get_15min_data, aggregate_to_30min, calc_macd, calc_kd 函数不变) ...

def find_today_signal(df_30min, today):
    # ... (保持现有逻辑不变) ...
    if dif_rising and k_rising and dif_now > dif_before and k_now > k_before:
        return {
            "tsCode": df_30min["tsCode"].iloc[-1],
            "minLow": round(recent.loc[min_low_idx, "low"], 2),
            "minLowTime": min_low_time,
            "difChange": round(dif_now - dif_before, 4),
            "kChange": round(k_now - k_before, 2),
            "currentPrice": round(after_data["close"].iloc[-1], 2),
        }
    return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", required=True, help="日期，如 20260522")
    args = parser.parse_args()
    today = args.date

    codes = get_stock_codes()
    signals = []
    for code in codes:
        try:
            df = get_15min_data(code, days=10)
            if df.empty or len(df) < 60:
                continue
            df = df[df["volume"] > 0]
            if len(df) < 60:
                continue
            df_30min = aggregate_to_30min(df)
            if len(df_30min) < 16:
                continue
            df_30min = calc_macid(df_30min)
            df_30min = calc_kd(df_30min)
            signal = find_today_signal(df_30min, today)
            if signal:
                signals.append(signal)
        except:
            pass

    # 输出 JSON
    result = {
        "success": True,
        "date": today,
        "count": len(signals),
        "data": signals,
        "summary": f"共找到 {len(signals)} 个信号"
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 复制到 scripts/ 目录**

```bash
cp jobs/screen_today_signals.py scripts/screen_today_signals.py
```

- [ ] **Step 3: 测试**

```bash
python scripts/screen_today_signals.py --date 20260522
```

应输出 JSON 格式结果。

- [ ] **Step 4: 提交**

```bash
git add scripts/screen_today_signals.py
git commit -m "refactor: screen_today_signals.py output JSON format"
```

---

## Task 5: 前端页面 - Tab 切换和脚本策略 UI

**Files:**
- Modify: `app/strategies/page.tsx`
- Create: `components/ScriptStrategyRunner.tsx`
- Create: `components/ScriptStrategyList.tsx`

- [ ] **Step 1: 添加 Tab 状态**

在 `StrategiesPage` 组件中添加：

```typescript
const [activeTab, setActiveTab] = useState<"ai" | "script">("ai");
```

- [ ] **Step 2: Tab 切换 UI**

在页面顶部添加：

```tsx
<div className="flex gap-2 mb-4">
  <button
    onClick={() => setActiveTab("ai")}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      activeTab === "ai" ? "pill-active" : "pill-inactive"
    }`}
  >
    AI 策略
  </button>
  <button
    onClick={() => setActiveTab("script")}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      activeTab === "script" ? "pill-active" : "pill-inactive"
    }`}
  >
    脚本策略
  </button>
</div>
```

- [ ] **Step 3: 根据 Tab 条件渲染**

```tsx
{activeTab === "ai" ? (
  /* 现有 AI 策略内容 */
) : (
  <ScriptStrategyList />
)}
```

- [ ] **Step 4: 创建 ScriptStrategyList 组件**

创建 `components/ScriptStrategyList.tsx`，包含：
- 脚本策略下拉选择
- 参数输入表单
- 运行按钮
- 历史运行记录列表

- [ ] **Step 5: 提交**

```bash
git add app/strategies/page.tsx components/ScriptStrategyList.tsx
git commit -m "feat: add script strategy tab to strategies page"
```

---

## Task 6: AI 分析集成

**Files:**
- Modify: `app/api/scripts/strategies/[id]/run/route.ts`
- Modify: `lib/ai.ts`

- [ ] **Step 1: 添加 AI 分析函数**

在 `lib/ai.ts` 添加：

```typescript
export async function analyzeScriptResult(
  strategyName: string,
  scriptResult: string,
  options: AIOptions
): Promise<string> {
  const analysisPrompt = `你是一个专业的股票策略分析师。请分析以下脚本运行结果：

## 策略名称
${strategyName}

## 原始结果
${scriptResult}

## 要求
1. 总结策略表现
2. 指出值得关注的信号
3. 提示潜在风险
4. 用 Markdown 格式输出

请用中文回复。`;

  const messages: AIMessage[] = [
    { role: "system", content: analysisPrompt },
    { role: "user", content: "请分析以上结果" },
  ];

  const response = await callAI(messages, options, undefined, 120000);
  return response.content;
}
```

- [ ] **Step 2: 执行脚本后调用 AI 分析**

在 `run/route.ts` 的 `execPromise.then` 中添加：

```typescript
.execPromise
  .then(async (result) => {
    // 获取 AI 配置
    const aiOptions = getAIOptions(); // 需根据项目现有方式获取

    // 调用 AI 分析
    const analysis = await analyzeScriptResult(
      strategy.name,
      result,
      aiOptions
    );

    await prisma.scriptRun.update({
      where: { id: run.id },
      data: { status: "completed", result, analysis, finishedAt: new Date() },
    });
  })
```

- [ ] **Step 3: 提交**

```bash
git add app/api/scripts/strategies/[id]/run/route.ts lib/ai.ts
git commit -m "feat: integrate AI analysis for script results"
```

---

## Task 7: 创建预置脚本策略数据

**Files:**
- Create: `prisma/seed.ts` 或使用 Migration SQL

- [ ] **Step 1: 添加预置脚本策略**

```typescript
// 在 prisma/seed.ts 中添加
import { prisma } from "@/lib/prisma";

async function main() {
  await prisma.scriptStrategy.createMany({
    data: [
      {
        name: "30分钟底背离信号",
        description: "检测30分钟K线创近期新低后DIF和KD同时上升的股票",
        scriptPath: "screen_today_signals.py",
        params: JSON.stringify({ days: 10 }),
      },
    ],
  });
}
```

- [ ] **Step 2: 运行 seed**

```bash
npx prisma db seed
```

- [ ] **Step 3: 提交**

```bash
git add prisma/seed.ts
git commit -m "feat: add default script strategy seed data"
```

---

## 依赖关系

```
Task 1 (Prisma Schema)
    ↓
Task 2 (CRUD API)
    ↓
Task 3 (执行API) ← Task 4 (JSON输出)
    ↓
Task 6 (AI分析) ← Task 5 (前端UI)
    ↓
Task 7 (Seed数据)
```

---

## 自检清单

- [ ] 所有 API endpoint 路径正确
- [ ] Prisma schema 包含所有必要字段
- [ ] screen_today_signals.py 输出有效 JSON
- [ ] 前端 Tab 切换正常
- [ ] AI 分析在脚本完成后执行
- [ ] 历史记录正确存储和展示
