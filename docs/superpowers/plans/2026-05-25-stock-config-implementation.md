# 股票配置实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在系统配置页面添加股票配置功能，支持按用途（FIFTEEN_MIN/DAILY/REALTIME）分类管理 StockConfig

**Architecture:** 单页 Tab 结构，三个 Tab 对应三种 purpose，表格展示配置，支持批量操作和单个开关切换

**Tech Stack:** Next.js App Router, Tailwind CSS, Prisma/SQLite

---

## 文件结构

```
app/config/
└── page.tsx                        # 页面入口，三个 Tab
app/api/config/stocks/
├── route.ts                        # GET/POST/PATCH/DELETE
└── batch/route.ts                 # 批量操作 PATCH/DELETE
components/config/
├── StockConfigTabs.tsx             # Tab 切换容器
├── StockConfigTable.tsx            # 股票表格组件
└── StockConfigOperateModal.tsx     # 添加/批量操作弹窗
```

---

## Task 1: API 路由 - GET/POST/DELETE

**Files:**
- Create: `app/api/config/stocks/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/config/stocks?purpose=FIFTEEN_MIN
export async function GET(req: NextRequest) {
  const purpose = req.nextUrl.searchParams.get("purpose");
  if (!purpose) {
    return NextResponse.json({ error: "purpose required" }, { status: 400 });
  }

  const configs = await prisma.stockConfig.findMany({
    where: { purpose },
    include: { stockBasic: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(configs);
}

// POST /api/config/stocks
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { stockCodes, purpose } = body;

  if (!stockCodes || !Array.isArray(stockCodes) || !purpose) {
    return NextResponse.json({ error: "stockCodes and purpose required" }, { status: 400 });
  }

  // 过滤空值
  const codes = stockCodes.filter((c: string) => c.trim());
  if (codes.length === 0) {
    return NextResponse.json({ error: "no valid codes" }, { status: 400 });
  }

  // upsert 批量创建或更新
  await Promise.all(
    codes.map((code: string) =>
      prisma.stockConfig.upsert({
        where: { stockCode_purpose: { stockCode: code.trim(), purpose } },
        update: {},
        create: { stockCode: code.trim(), purpose, enabled: true },
      })
    )
  );

  return NextResponse.json({ success: true, count: codes.length });
}
```

- [ ] **Step 1: 创建 API 路由目录和文件**

```bash
mkdir -p app/api/config/stocks
```

- [ ] **Step 2: 实现 GET/POST 逻辑**（如上代码）

- [ ] **Step 3: 测试 GET**

Run: `curl "http://localhost:3000/api/config/stocks?purpose=FIFTEEN_MIN"`
Expected: 返回空数组 `[]`

- [ ] **Step 4: 测试 POST**

Run: `curl -X POST http://localhost:3000/api/config/stocks -H "Content-Type: application/json" -d '{"stockCodes":["600000.SH"],"purpose":"FIFTEEN_MIN"}'`
Expected: `{"success":true,"count":1}`

- [ ] **Step 5: 再次测试 GET**

Run: `curl "http://localhost:3000/api/config/stocks?purpose=FIFTEEN_MIN"`
Expected: 返回包含该配置的数组

- [ ] **Step 6: Commit**

```bash
git add app/api/config/stocks/route.ts
git commit -m "feat: add stock config API route with GET and POST"
```

---

## Task 2: API 路由 - 单个更新 / 批量操作

**Files:**
- Create: `app/api/config/stocks/[id]/route.ts`
- Create: `app/api/config/stocks/batch/route.ts`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p "app/api/config/stocks/[id]"
mkdir -p app/api/config/stocks/batch
```

- [ ] **Step 2: 单个更新 PATCH /api/config/stocks/:id**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/config/stocks/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { enabled } = body;

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled required" }, { status: 400 });
  }

  await prisma.stockConfig.update({
    where: { id },
    data: { enabled },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: 批量更新 PATCH /api/config/stocks/batch**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/config/stocks/batch
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { ids, enabled } = body;

  if (!ids || !Array.isArray(ids) || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "ids and enabled required" }, { status: 400 });
  }

  await prisma.stockConfig.updateMany({
    where: { id: { in: ids } },
    data: { enabled },
  });

  return NextResponse.json({ success: true, count: ids.length });
}
```

- [ ] **Step 4: 批量删除 DELETE /api/config/stocks/batch**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE /api/config/stocks/batch
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { ids } = body;

  if (!ids || !Array.isArray(ids)) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  await prisma.stockConfig.deleteMany({
    where: { id: { in: ids } },
  });

  return NextResponse.json({ success: true, count: ids.length });
}
```

- [ ] **Step 5: 测试 PATCH 单个**

Run: `curl -X PATCH http://localhost:3000/api/config/stocks/xxx -H "Content-Type: application/json" -d '{"enabled":false}'`
Expected: `{"success":true}`

- [ ] **Step 6: 测试 DELETE 单个（通过已有 ID）**

先 POST 创建一个配置获取其 ID，然后 DELETE 它

- [ ] **Step 7: Commit**

```bash
git add app/api/config/stocks/
git commit -m "feat: add stock config single/batch update and delete APIs"
```

---

## Task 3: 组件 - StockConfigOperateModal

**Files:**
- Create: `components/config/StockConfigOperateModal.tsx`

```tsx
"use client";

import { useState } from "react";

interface Props {
  purpose: string;
  purposeLabels: Record<string, string>;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StockConfigOperateModal({ purpose, purposeLabels, onClose, onSuccess }: Props) {
  const [codes, setCodes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const codeList = codes.split("\n").map((c) => c.trim()).filter(Boolean);
    if (codeList.length === 0) {
      setError("请输入至少一个股票代码");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/config/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockCodes: codeList, purpose }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "添加失败");
      }

      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "添加失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-dialog-enter">
      <div
        className="rounded-xl shadow-lg border overflow-hidden w-full max-w-md"
        style={{ background: "var(--surface-solid)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            添加股票 - {purposeLabels[purpose]}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <textarea
            value={codes}
            onChange={(e) => setCodes(e.target.value)}
            placeholder="输入股票代码，每行一个，如：&#10;600000.SH&#10;000001.SZ"
            rows={6}
            className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none font-mono"
          />
          {error && (
            <p className="text-xs mt-2" style={{ color: "var(--down-color)" }}>{error}</p>
          )}
        </div>

        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 pill-active"
          >
            {loading ? "添加中..." : "添加"}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 pill-inactive"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 1: 创建组件文件**

- [ ] **Step 2: Commit**

```bash
git add components/config/StockConfigOperateModal.tsx
git commit -m "feat: add StockConfigOperateModal component"
```

---

## Task 4: 组件 - StockConfigTable

**Files:**
- Create: `components/config/StockConfigTable.tsx`

```tsx
"use client";

import { useState } from "react";

interface StockConfig {
  id: string;
  stockCode: string;
  enabled: boolean;
  stockBasic?: { name: string } | null;
}

interface Props {
  configs: StockConfig[];
  onRefresh: () => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (ids: string[]) => void;
  onBatchToggle: (ids: string[], enabled: boolean) => void;
}

export default function StockConfigTable({
  configs,
  onRefresh,
  onToggle,
  onDelete,
  onBatchToggle,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filtered = configs.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.stockCode.toLowerCase().includes(q) ||
      c.stockBasic?.name?.toLowerCase().includes(q)
    );
  });

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`确定删除选中的 ${selected.size} 个配置？`)) return;
    await onDelete(Array.from(selected));
    setSelected(new Set());
    onRefresh();
  };

  const handleBatchToggle = async (enabled: boolean) => {
    if (selected.size === 0) return;
    await onBatchToggle(Array.from(selected), enabled);
    setSelected(new Set());
    onRefresh();
  };

  return (
    <div className="space-y-3">
      {/* 操作栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索股票代码/名称..."
          className="px-3 py-1.5 text-sm rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] w-48"
        />
        {selected.size > 0 && (
          <>
            <span className="text-xs text-[var(--text-muted)]">已选 {selected.size}</span>
            <button
              onClick={() => handleBatchToggle(true)}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              批量启用
            </button>
            <button
              onClick={() => handleBatchToggle(false)}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              批量停用
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-3 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              批量删除
            </button>
          </>
        )}
      </div>

      {/* 表格 */}
      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-[var(--text-muted)] text-sm">暂无数据</p>
        </div>
      ) : (
        <div className="border border-[var(--border)] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-elevated)]">
                <th className="w-10 px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="px-3 py-2 text-left text-[var(--text-muted)] font-medium">股票代码</th>
                <th className="px-3 py-2 text-left text-[var(--text-muted)] font-medium">股票名称</th>
                <th className="px-3 py-2 text-left text-[var(--text-muted)] font-medium">状态</th>
                <th className="px-3 py-2 text-right text-[var(--text-muted)] font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((config) => (
                <tr
                  key={config.id}
                  className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(config.id)}
                      onChange={() => toggleOne(config.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-[var(--text-primary)]">{config.stockCode}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{config.stockBasic?.name || "—"}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => onToggle(config.id, !config.enabled)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        config.enabled ? "bg-[var(--up-color)]" : "bg-[var(--text-muted)]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          config.enabled ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={async () => {
                        if (!confirm("确定删除？")) return;
                        await onDelete([config.id]);
                        onRefresh();
                      }}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 1: 创建组件文件**

- [ ] **Step 2: Commit**

```bash
git add components/config/StockConfigTable.tsx
git commit -m "feat: add StockConfigTable component with batch operations"
```

---

## Task 5: 组件 - StockConfigTabs

**Files:**
- Create: `components/config/StockConfigTabs.tsx`

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import StockConfigTable from "./StockConfigTable";
import StockConfigOperateModal from "./StockConfigOperateModal";

interface StockConfig {
  id: string;
  stockCode: string;
  enabled: boolean;
  stockBasic?: { name: string } | null;
}

const PURPOSES = ["FIFTEEN_MIN", "DAILY", "REALTIME"] as const;
const PURPOSE_LABELS: Record<string, string> = {
  FIFTEEN_MIN: "15分钟线",
  DAILY: "日线",
  REALTIME: "实时",
};

export default function StockConfigTabs() {
  const [activeTab, setActiveTab] = useState<string>(PURPOSES[0]);
  const [configs, setConfigs] = useState<StockConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/config/stocks?purpose=${activeTab}`);
      const data = await res.json();
      setConfigs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch configs:", e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleToggle = async (id: string, enabled: boolean) => {
    await fetch(`/api/config/stocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    setConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled } : c))
    );
  };

  const handleDelete = async (ids: string[]) => {
    await fetch("/api/config/stocks/batch", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  };

  const handleBatchToggle = async (ids: string[], enabled: boolean) => {
    await fetch("/api/config/stocks/batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, enabled }),
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] px-2 shrink-0">
        {PURPOSES.map((purpose) => (
          <button
            key={purpose}
            onClick={() => setActiveTab(purpose)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === purpose
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {PURPOSE_LABELS[purpose]}
          </button>
        ))}
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-between px-2 py-3 shrink-0">
        <span className="text-xs text-[var(--text-muted)]">
          共 {configs.length} 条配置
        </span>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 text-sm font-semibold rounded-lg pill-active transition-colors"
        >
          添加股票
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
          </div>
        ) : (
          <StockConfigTable
            configs={configs}
            onRefresh={fetchConfigs}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onBatchToggle={handleBatchToggle}
          />
        )}
      </div>

      {/* 添加弹窗 */}
      {showAddModal && (
        <StockConfigOperateModal
          purpose={activeTab}
          purposeLabels={PURPOSE_LABELS}
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchConfigs}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 1: 创建组件文件**

- [ ] **Step 2: Commit**

```bash
git add components/config/StockConfigTabs.tsx
git commit -m "feat: add StockConfigTabs component"
```

---

## Task 6: 页面 - /config

**Files:**
- Create: `app/config/page.tsx`

```tsx
"use client";

import StockConfigTabs from "@/components/config/StockConfigTabs";

export default function ConfigPage() {
  return (
    <div className="h-[calc(100dvh-52px)] flex flex-col bg-[var(--background)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] shrink-0">
        <h1 className="text-lg font-bold text-[var(--text-primary)]">系统配置</h1>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">管理股票分类配置</p>
      </div>

      {/* Tabs */}
      <div className="flex-1 min-h-0">
        <StockConfigTabs />
      </div>
    </div>
  );
}
```

- [ ] **Step 1: 创建页面文件**

```bash
mkdir -p app/config
```

- [ ] **Step 2: Commit**

```bash
git add app/config/page.tsx
git commit -m "feat: add system config page with stock config"
```

---

## Task 7: 导航入口 - Header 添加配置链接

**Files:**
- Modify: `components/Header.tsx:12-16`

- [ ] **Step 1: 在 navLinks 数组中添加配置入口**

在 `const navLinks = [...]` 中添加:

```typescript
{ href: "/config", label: "配置", icon: "config" },
```

- [ ] **Step 2: 添加 config 图标**

在 `NavIcon` 组件中添加:

```tsx
if (type === "config") {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
```

- [ ] **Step 3: 更新 isActive 函数**

```typescript
const isActive = (href: string) => {
  if (href === "/stock/600519") {
    return pathname.startsWith("/stock");
  }
  if (href === "/config") {
    return pathname.startsWith("/config");
  }
  return pathname.startsWith(href);
};
```

- [ ] **Step 4: Commit**

```bash
git add components/Header.tsx
git commit -m "feat: add config link to header navigation"
```

---

## Task 8: 浏览器测试

- [ ] **Step 1: 启动开发服务器**

Run: `npm run dev`

- [ ] **Step 2: 打开 /config 页面**

- [ ] **Step 3: 测试添加股票**

在 15分钟线 Tab 下，添加几个股票代码，确认添加成功

- [ ] **Step 4: 测试启用/停用**

点击开关，确认状态切换

- [ ] **Step 5: 测试批量操作**

勾选多个，点击批量启用/停用/删除

- [ ] **Step 6: 测试 Tab 切换**

切换到日线和实时，确认数据独立

- [ ] **Step 7: 测试搜索**

在表格中输入股票代码，确认过滤正常

---

## 实施检查清单

| 任务 | 状态 |
|------|------|
| Task 1: API GET/POST | ☐ |
| Task 2: API 单个/批量更新删除 | ☐ |
| Task 3: StockConfigOperateModal | ☐ |
| Task 4: StockConfigTable | ☐ |
| Task 5: StockConfigTabs | ☐ |
| Task 6: 页面 /config | ☐ |
| Task 7: Header 导航 | ☐ |
| Task 8: 浏览器测试 | ☐ |
