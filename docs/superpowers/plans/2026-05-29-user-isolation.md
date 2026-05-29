# 用户隔离实现计划

> **For agentic workers:** Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为策略、提示词、脚本策略、股票配置添加用户隔离，API 默认返回全局数据 + 当前用户私有数据

**Architecture:** 修改 Prisma schema 的 userId 字段（nullable → default "global"），API 层添加用户过滤逻辑，迁移现有 NULL 数据到 'global'

**Tech Stack:** Next.js App Router, Prisma (SQLite), TypeScript

---

## 文件结构

```
prisma/schema.prisma          # 修改 userId 字段
app/api/strategies/route.ts    # GET/POST 用户过滤
app/api/strategies/[id]/route.ts  # PUT/DELETE 所有权验证
app/api/prompts/route.ts      # GET/POST 用户过滤
app/api/scripts/strategies/route.ts  # GET/POST 用户过滤
app/api/scripts/strategies/[id]/route.ts  # PUT/DELETE 所有权验证
app/api/config/stocks/route.ts  # GET/POST 用户过滤
```

---

## Task 1: Prisma Schema 变更

**Files:**
- Modify: `prisma/schema.prisma:218-245`

- [ ] **Step 1: 修改 Strategy.userId**

将 `userId String?` 改为 `userId String @default("global")`

```prisma
model Strategy {
  id          String   @id @default(cuid())
  userId      String   @default("global")  // global 或用户ID
  name        String
  description String?
  criteria    String?
  promptId    String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  prompt      Prompt        @relation(fields: [promptId], references: [id])
  runs        StrategyRun[]

  @@index([userId])
}
```

- [ ] **Step 2: 修改 Prompt.userId**

将 `userId String?` 改为 `userId String @default("global")`

```prisma
model Prompt {
  id        String   @id @default(cuid())
  userId    String   @default("global")  // global 或用户ID
  name      String
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  strategies Strategy[]

  @@index([userId])
}
```

- [ ] **Step 3: 添加 ScriptStrategy.userId**

在 `model ScriptStrategy` 中添加 `userId String @default("global")`

```prisma
model ScriptStrategy {
  id          String   @id @default(cuid())
  userId      String   @default("global")  // 新增
  name        String
  description String?
  scriptPath  String
  params      String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  runs        ScriptRun[]
}
```

- [ ] **Step 4: 添加 StockConfig.userId**

在 `model StockConfig` 中添加 `userId String?`

```prisma
model StockConfig {
  id        String   @id @default(cuid())
  userId    String?  // 用户专属配置，null 表示系统级
  stockCode String   // 格式: "600000.SH" / "000001.SZ"
  purpose   String   // "FIFTEEN_MIN" | "DAILY" | "REALTIME"
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now())

  @@unique([userId, stockCode, purpose])  // 修改唯一约束
  @@index([userId])
}
```

- [ ] **Step 5: 应用 Schema 变更**

```bash
npx prisma db push --skip-generate
npx prisma generate
```

- [ ] **Step 6: 提交**

```bash
git add prisma/schema.prisma
git commit -m "feat: add userId fields for user isolation"
```

---

## Task 2: 数据迁移

**Files:**
- Create: `prisma/migrations/user_isolation_data/migration.sql`

- [ ] **Step 1: 创建迁移 SQL**

将现有的 NULL userId 迁移为 'global'

```sql
-- 迁移 Strategy 数据
UPDATE "Strategy" SET "userId" = 'global' WHERE "userId" IS NULL;

-- 迁移 Prompt 数据
UPDATE "Prompt" SET "userId" = 'global' WHERE "userId" IS NULL;
```

- [ ] **Step 2: 执行迁移**

```bash
npx prisma db execute --file=prisma/migrations/user_isolation_data/migration.sql
```

- [ ] **Step 3: 提交**

```bash
git add prisma/migrations/
git commit -m "chore: migrate NULL userId to 'global'"
```

---

## Task 3: Strategy API 用户过滤

**Files:**
- Modify: `app/api/strategies/route.ts:1-80`
- Modify: `app/api/strategies/[id]/route.ts:1-60`

- [ ] **Step 1: 修改 GET/POST /api/strategies**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const GLOBAL_USER_ID = "global";

function getUserFilter(userId: string | undefined) {
  return {
    OR: [
      { userId: GLOBAL_USER_ID },  // 全局数据
      { userId: userId || GLOBAL_USER_ID },  // 用户私有数据
    ]
  };
}

export async function GET() {
  const user = await getCurrentUser();
  const currentUserId = user?.id || GLOBAL_USER_ID;

  const strategies = await prisma.strategy.findMany({
    where: getUserFilter(currentUserId),
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(strategies);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { name, description, criteria, promptId } = await req.json();
  if (!name || !promptId) {
    return NextResponse.json({ error: "名称和提示词不能为空" }, { status: 400 });
  }

  const strategy = await prisma.strategy.create({
    data: {
      userId: user.id,  // 使用当前用户ID
      name,
      description,
      criteria,
      promptId,
    },
  });

  return NextResponse.json(strategy);
}
```

- [ ] **Step 2: 修改 GET/PUT/DELETE /api/strategies/[id]**

添加所有权验证：用户只能访问/修改 global 或自己的策略

```typescript
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const currentUserId = user?.id || GLOBAL_USER_ID;
  const { id } = await params;

  const strategy = await prisma.strategy.findUnique({
    where: { id },
    include: { runs: { orderBy: { createdAt: "desc" }, take: 10 } },
  });

  if (!strategy) {
    return NextResponse.json({ error: "策略不存在" }, { status: 404 });
  }

  // 验证访问权限
  if (strategy.userId !== GLOBAL_USER_ID && strategy.userId !== currentUserId) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  return NextResponse.json(strategy);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const currentUserId = user.id;
  const { id } = await params;

  const existing = await prisma.strategy.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "策略不存在" }, { status: 404 });
  }

  // 验证所有权
  if (existing.userId !== GLOBAL_USER_ID && existing.userId !== currentUserId) {
    return NextResponse.json({ error: "无权修改" }, { status: 403 });
  }

  const { name, description, criteria, promptId } = await req.json();
  const strategy = await prisma.strategy.update({
    where: { id },
    data: { name, description, criteria, promptId },
  });
  return NextResponse.json(strategy);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const currentUserId = user.id;
  const { id } = await params;

  const existing = await prisma.strategy.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "策略不存在" }, { status: 404 });
  }

  // 验证所有权
  if (existing.userId !== GLOBAL_USER_ID && existing.userId !== currentUserId) {
    return NextResponse.json({ error: "无权删除" }, { status: 403 });
  }

  await prisma.strategy.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: 提交**

```bash
git add app/api/strategies/route.ts app/api/strategies/[id]/route.ts
git commit -m "feat: add user isolation to strategy APIs"
```

---

## Task 4: Prompt API 用户过滤

**Files:**
- Modify: `app/api/prompts/route.ts:1-60`

- [ ] **Step 1: 修改 GET/POST /api/prompts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const GLOBAL_USER_ID = "global";

export async function GET() {
  const user = await getCurrentUser();
  const currentUserId = user?.id || GLOBAL_USER_ID;

  const prompts = await prisma.prompt.findMany({
    where: {
      OR: [
        { userId: GLOBAL_USER_ID },
        { userId: currentUserId },
      ]
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(prompts);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { name, content } = await req.json();
  if (!name || !content) {
    return NextResponse.json({ error: "名称和内容不能为空" }, { status: 400 });
  }

  const prompt = await prisma.prompt.create({
    data: {
      userId: user.id,
      name,
      content,
    },
  });

  return NextResponse.json(prompt);
}
```

- [ ] **Step 2: 提交**

```bash
git add app/api/prompts/route.ts
git commit -m "feat: add user isolation to prompt APIs"
```

---

## Task 5: ScriptStrategy API 用户过滤

**Files:**
- Modify: `app/api/scripts/strategies/route.ts:1-60`
- Modify: `app/api/scripts/strategies/[id]/route.ts:1-80`

- [ ] **Step 1: 修改 GET/POST /api/scripts/strategies**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const GLOBAL_USER_ID = "global";

export async function GET() {
  const user = await getCurrentUser();
  const currentUserId = user?.id || GLOBAL_USER_ID;

  const strategies = await prisma.scriptStrategy.findMany({
    where: {
      OR: [
        { userId: GLOBAL_USER_ID },
        { userId: currentUserId },
      ]
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(strategies);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { name, description, scriptPath, params } = await req.json();
  if (!name || !scriptPath) {
    return NextResponse.json({ error: "名称和脚本路径不能为空" }, { status: 400 });
  }

  const strategy = await prisma.scriptStrategy.create({
    data: {
      userId: user.id,
      name,
      description,
      scriptPath,
      params,
    },
  });

  return NextResponse.json(strategy);
}
```

- [ ] **Step 2: 修改 /api/scripts/strategies/[id]**

添加所有权验证（与 Strategy 类似）

```typescript
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const currentUserId = user?.id || GLOBAL_USER_ID;
  const { id } = await params;

  const strategy = await prisma.scriptStrategy.findUnique({
    where: { id },
    include: { runs: { orderBy: { createdAt: "desc" }, take: 10 } },
  });

  if (!strategy) {
    return NextResponse.json({ error: "策略不存在" }, { status: 404 });
  }

  if (strategy.userId !== GLOBAL_USER_ID && strategy.userId !== currentUserId) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  return NextResponse.json(strategy);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const currentUserId = user.id;
  const { id } = await params;

  const existing = await prisma.scriptStrategy.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "策略不存在" }, { status: 404 });
  }

  if (existing.userId !== GLOBAL_USER_ID && existing.userId !== currentUserId) {
    return NextResponse.json({ error: "无权修改" }, { status: 403 });
  }

  const { name, description, scriptPath, params: scriptParams } = await req.json();
  const strategy = await prisma.scriptStrategy.update({
    where: { id },
    data: { name, description, scriptPath, params: scriptParams },
  });
  return NextResponse.json(strategy);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const currentUserId = user.id;
  const { id } = await params;

  const existing = await prisma.scriptStrategy.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "策略不存在" }, { status: 404 });
  }

  if (existing.userId !== GLOBAL_USER_ID && existing.userId !== currentUserId) {
    return NextResponse.json({ error: "无权删除" }, { status: 403 });
  }

  await prisma.scriptStrategy.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: 提交**

```bash
git add app/api/scripts/strategies/route.ts app/api/scripts/strategies/[id]/route.ts
git commit -m "feat: add user isolation to script strategy APIs"
```

---

## Task 6: StockConfig API 用户过滤

**Files:**
- Modify: `app/api/config/stocks/route.ts:1-80`

- [ ] **Step 1: 修改 GET/POST /api/config/stocks**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const GLOBAL_USER_ID = "global";

function codeToTsCode(code: string): string {
  if (code.includes(".")) return code;
  const c = code.startsWith("0") || code.startsWith("3") ? "SZ" : code.startsWith("4") || code.startsWith("8") ? "BJ" : "SH";
  return `${code}.${c}`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const currentUserId = user?.id || GLOBAL_USER_ID;
  const purpose = req.nextUrl.searchParams.get("purpose");

  if (!purpose) {
    return NextResponse.json({ error: "purpose required" }, { status: 400 });
  }

  const configs = await prisma.stockConfig.findMany({
    where: {
      purpose,
      OR: [
        { userId: GLOBAL_USER_ID },
        { userId: currentUserId },
      ]
    },
    orderBy: { createdAt: "desc" },
  });

  const stockCodes = configs.map((c) => c.stockCode);
  const stockBasics = await prisma.stockBasic.findMany({
    where: { tsCode: { in: stockCodes } },
  });
  const stockBasicMap = new Map(stockBasics.map((s) => [s.tsCode, s]));

  const result = configs.map((config) => ({
    ...config,
    stockBasic: stockBasicMap.get(config.stockCode) || null,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json();
  const { stockCodes, purpose } = body;

  if (!stockCodes || !Array.isArray(stockCodes) || !purpose) {
    return NextResponse.json({ error: "stockCodes and purpose required" }, { status: 400 });
  }

  const codes = stockCodes.filter((c: string) => c.trim());
  if (codes.length === 0) {
    return NextResponse.json({ error: "no valid codes" }, { status: 400 });
  }

  const userId = user.id;

  await Promise.all(
    codes.map((code: string) => {
      const tsCode = codeToTsCode(code.trim());
      return prisma.stockConfig.upsert({
        where: {
          userId_stockCode_purpose: {
            userId,
            stockCode: tsCode,
            purpose,
          }
        },
        update: {},
        create: { userId, stockCode: tsCode, purpose, enabled: true },
      });
    })
  );

  return NextResponse.json({ success: true, count: codes.length });
}
```

- [ ] **Step 2: 提交**

```bash
git add app/api/config/stocks/route.ts
git commit -m "feat: add user isolation to stock config APIs"
```

---

## 依赖关系

```
Task 1 (Schema)
    ↓
Task 2 (Data Migration)
    ↓
Task 3 (Strategy API) ─┐
    ↓                  │
Task 4 (Prompt API) ──┤
    ↓                  │
Task 5 (Script API) ──┤
    ↓                  │
Task 6 (StockConfig) ──┘
```

---

## 自检清单

- [ ] Schema 变更正确
- [ ] 数据迁移成功（NULL → 'global'）
- [ ] GET APIs 返回 global + 当前用户数据
- [ ] POST 操作使用当前用户 ID
- [ ] PUT/DELETE 验证所有权
- [ ] 全局数据 (userId='global') 可被所有用户读取
- [ ] TypeScript 编译通过
