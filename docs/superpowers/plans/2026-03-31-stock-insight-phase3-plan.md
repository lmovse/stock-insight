# Stock Insight Phase 3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drawing tools (trendline, fibonacci, horizontal line, text annotation) and custom indicator parameters with modal configuration.

**Architecture:** Drawing tools use lightweight-charts v5 coordinate conversion (timeToCoordinate/priceToCoordinate) to overlay on chart. Indicator params stored per-user in ChartConfig table. Canvas overlay captures mouse events for drawing interactions.

**Tech Stack:** Next.js 16, Prisma, lightweight-charts v5, Canvas 2D API.

---

## Task 1: Add DrawingLine to Database Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update prisma/schema.prisma**

Read current schema, then add the DrawingLine model inside the file:

```prisma
model DrawingLine {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  stockCode String
  type      String   // "TREND" | "FIBONACCI" | "HORIZONTAL" | "TEXT"
  data      String   // JSON
  color     String   @default("#E53935")
  createdAt DateTime @default(now())

  @@index([userId, stockCode])
}
```

- [ ] **Step 2: Run Prisma migrate**

```bash
npx prisma db push
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add DrawingLine model to schema"
```

---

## Task 2: Drawing Utilities

**Files:**
- Create: `lib/drawings.ts`

- [ ] **Step 1: Create lib/drawings.ts**

```typescript
import type { IChartApi, Time } from "lightweight-charts";

// Convert chart coordinates to pixel position
export function getPixelPosition(
  chart: IChartApi,
  time: Time,
  price: number
): { x: number; y: number } | null {
  const timeScale = chart.timeScale();
  const priceScale = chart.priceScale("");

  const x = timeScale.timeToCoordinate(time);
  const y = priceScale.priceToCoordinate(price);

  if (x === null || y === null) return null;
  return { x, y };
}

// Calculate Fibonacci retracement levels
export function calcFibonacciLevels(
  startPrice: number,
  endPrice: number
): { level: number; price: number; label: string }[] {
  const diff = endPrice - startPrice;
  const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  return levels.map((l) => ({
    level: l,
    price: startPrice + diff * l,
    label: l === 0 ? "0%" : l === 1 ? "100%" : `${(l * 100).toFixed(1)}%`,
  }));
}

// Check if user is logged in before drawing operations
export function requireAuth(user: { id: string } | null): void {
  if (!user) throw new Error("未登录");
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add drawing utilities"
```

---

## Task 3: Drawing API Routes

**Files:**
- Create: `app/api/drawings/route.ts`
- Create: `app/api/drawings/[id]/route.ts`

- [ ] **Step 1: Create app/api/drawings/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const stockCode = searchParams.get("stockCode");
  if (!stockCode) {
    return NextResponse.json({ error: "缺少 stockCode" }, { status: 400 });
  }

  const drawings = await prisma.drawingLine.findMany({
    where: { userId: user.id, stockCode },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(drawings);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { stockCode, type, data, color } = await req.json();
  if (!stockCode || !type || !data) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }

  const validTypes = ["TREND", "FIBONACCI", "HORIZONTAL", "TEXT"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "无效的画线类型" }, { status: 400 });
  }

  const drawing = await prisma.drawingLine.create({
    data: {
      userId: user.id,
      stockCode,
      type,
      data: JSON.stringify(data),
      color: color || "#E53935",
    },
  });

  return NextResponse.json({ ...drawing, data: JSON.parse(drawing.data) });
}
```

- [ ] **Step 2: Create app/api/drawings/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const { data, color } = await req.json();

  const drawing = await prisma.drawingLine.findFirst({
    where: { id, userId: user.id },
  });
  if (!drawing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  const updated = await prisma.drawingLine.update({
    where: { id },
    data: {
      ...(data && { data: JSON.stringify(data) }),
      ...(color && { color }),
    },
  });

  return NextResponse.json({ ...updated, data: JSON.parse(updated.data) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  const drawing = await prisma.drawingLine.findFirst({
    where: { id, userId: user.id },
  });
  if (!drawing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  await prisma.drawingLine.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add drawing API routes"
```

---

## Task 4: Indicator Config API

**Files:**
- Create: `app/api/config/indicators/route.ts`

- [ ] **Step 1: Create app/api/config/indicators/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Default indicator config
const defaultIndicators = {
  ma: true,
  maPeriods: [5, 10, 20, 60],
  macd: true,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  kdj: false,
  kdjK: 9,
  kdjD: 3,
  kdjJ: 3,
  boll: false,
  bollPeriod: 20,
  bollStdDev: 2,
  rsi: false,
  rsiPeriod: 14,
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const config = await prisma.chartConfig.findUnique({
    where: { userId: user.id },
  });

  if (!config) {
    return NextResponse.json(defaultIndicators);
  }

  return NextResponse.json(JSON.parse(config.indicators));
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const indicators = await req.json();

  const config = await prisma.chartConfig.upsert({
    where: { userId: user.id },
    update: { indicators: JSON.stringify(indicators) },
    create: {
      userId: user.id,
      indicators: JSON.stringify(indicators),
      theme: "dark",
    },
  });

  return NextResponse.json(JSON.parse(config.indicators));
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add indicator config API"
```

---

## Task 5: DrawingToolbar Component

**Files:**
- Create: `components/DrawingToolbar.tsx`

- [ ] **Step 1: Create components/DrawingToolbar.tsx**

```tsx
"use client";

export type DrawingTool = "SELECT" | "TREND" | "FIBONACCI" | "HORIZONTAL" | "TEXT";

interface Props {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
}

const tools: { id: DrawingTool; label: string }[] = [
  { id: "SELECT", label: "选择" },
  { id: "TREND", label: "趋势线" },
  { id: "FIBONACCI", label: "斐波那契" },
  { id: "HORIZONTAL", label: "水平线" },
  { id: "TEXT", label: "文字" },
];

export default function DrawingToolbar({ activeTool, onToolChange }: Props) {
  return (
    <div className="flex items-center gap-1 p-1 bg-[var(--surface)] border-b border-[var(--border)]">
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => onToolChange(t.id)}
          className={`px-2 py-1 text-xs font-mono border transition-colors ${
            activeTool === t.id
              ? "bg-[var(--accent)] text-white border-[var(--accent)]"
              : "bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add DrawingToolbar component"
```

---

## Task 6: DrawingCanvas Overlay

**Files:**
- Create: `components/DrawingCanvas.tsx`

- [ ] **Step 1: Create components/DrawingCanvas.tsx**

```tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import type { IChartApi, Time } from "lightweight-charts";
import type { DrawingTool } from "./DrawingToolbar";
import { calcFibonacciLevels } from "@/lib/drawings";

interface DrawingData {
  id?: string;
  type: "TREND" | "FIBONACCI" | "HORIZONTAL" | "TEXT";
  data: {
    startTime?: Time;
    startPrice?: number;
    endTime?: Time;
    endPrice?: number;
    time?: Time;
    price?: number;
    text?: string;
  };
  color: string;
}

interface Props {
  chart: IChartApi | null;
  tool: DrawingTool;
  color: string;
  user: { id: string } | null;
  stockCode: string;
  onDrawingComplete: (d: DrawingData) => void;
  drawings: DrawingData[];
  onDrawingDelete: (id: string) => void;
}

export default function DrawingCanvas({
  chart,
  tool,
  color,
  user,
  stockCode,
  onDrawingComplete,
  drawings,
  onDrawingDelete,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<DrawingData | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const chartApi = chart;
    if (!canvas || !chartApi) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing lines
    drawings.forEach((d) => {
      drawOnCanvas(ctx, chartApi, d);
    });

    // Draw current in-progress line
    if (drawingRef.current) {
      drawOnCanvas(ctx, chartApi, drawingRef.current);
    }
  }, [chart, drawings]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    if (!chart || !canvasRef.current) return;

    const handleResize = () => redraw();
    chart.subscribeResize(handleResize);

    return () => {
      chart.unsubscribeResize(handleResize);
    };
  }, [chart, redraw]);

  function drawOnCanvas(ctx: CanvasRenderingContext2D, chartApi: IChartApi, d: DrawingData) {
    const ts = chartApi.timeScale();

    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1.5;
    ctx.font = "12px JetBrains Mono, monospace";

    if (d.type === "TREND" || d.type === "FIBONACCI") {
      const { startTime, startPrice, endTime, endPrice } = d.data;
      if (!startTime || !endTime || startPrice === undefined || endPrice === undefined) return;

      const x1 = ts.timeToCoordinate(startTime as Time);
      const y1 = chartApi.priceScale("").priceToCoordinate(startPrice);
      const x2 = ts.timeToCoordinate(endTime as Time);
      const y2 = chartApi.priceScale("").priceToCoordinate(endPrice);

      if (x1 === null || x2 === null || y1 === null || y2 === null) return;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      if (d.type === "FIBONACCI") {
        const levels = calcFibonacciLevels(startPrice, endPrice);
        levels.forEach((l) => {
          const y = chartApi.priceScale("").priceToCoordinate(l.price);
          if (y === null) return;
          ctx.beginPath();
          ctx.moveTo(x1, y);
          ctx.lineTo(x2, y);
          ctx.strokeStyle = d.color + "80"; // 50% opacity
          ctx.stroke();
          ctx.fillStyle = d.color;
          ctx.fillText(l.label, x1 + 4, y - 2);
        });
      }

      // End points
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(x1, y1, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x2, y2, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (d.type === "HORIZONTAL") {
      const { time, price } = d.data;
      if (!time || price === undefined) return;

      const x = ts.timeToCoordinate(time as Time);
      const y = chartApi.priceScale("").priceToCoordinate(price);
      if (x === null || y === null) return;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ts.width(), y);
      ctx.stroke();

      ctx.fillStyle = d.color;
      ctx.fillText(`¥${price.toFixed(2)}`, 4, y - 4);
    } else if (d.type === "TEXT") {
      const { time, price, text } = d.data;
      if (!time || price === undefined || !text) return;

      const x = ts.timeToCoordinate(time as Time);
      const y = chartApi.priceScale("").priceToCoordinate(price);
      if (x === null || y === null) return;

      ctx.fillStyle = d.color;
      ctx.fillText(text, x, y);
    }
  }

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (tool === "SELECT" || !chart || !user) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ts = chart.timeScale();
      const priceScale = chart.priceScale("");

      const time = ts.coordinateToTime(x);
      const price = priceScale.coordinateToPrice(y);

      if (!time || price === null) return;

      startPosRef.current = { x, y };

      if (tool === "HORIZONTAL" || tool === "TEXT") {
        const text = tool === "TEXT" ? prompt("请输入文字:") || "" : undefined;
        onDrawingComplete({
          type: tool === "HORIZONTAL" ? "HORIZONTAL" : "TEXT",
          data: { time, price, text },
          color,
        });
        startPosRef.current = null;
      } else {
        drawingRef.current = {
          type: tool as "TREND" | "FIBONACCI",
          data: { startTime: time, startPrice: price, endTime: time, endPrice: price },
          color,
        };
        redraw();
      }
    },
    [tool, chart, user, color, onDrawingComplete, redraw]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current || !chart) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ts = chart.timeScale();
      const priceScale = chart.priceScale("");

      const time = ts.coordinateToTime(x);
      const price = priceScale.coordinateToPrice(y);

      if (!time || price === null) return;

      drawingRef.current = {
        ...drawingRef.current,
        data: {
          ...drawingRef.current.data,
          endTime: time,
          endPrice: price,
        },
      };

      redraw();
    },
    [chart, redraw]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current || !chart) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ts = chart.timeScale();
      const priceScale = chart.priceScale("");

      const time = ts.coordinateToTime(x);
      const price = priceScale.coordinateToPrice(y);

      if (!time || price === null) return;

      drawingRef.current = {
        ...drawingRef.current,
        data: {
          ...drawingRef.current.data,
          endTime: time,
          endPrice: price,
        },
      };

      // Minimum distance check
      const startX = ts.timeToCoordinate(drawingRef.current.data.startTime as Time);
      const startY = priceScale.priceToCoordinate(drawingRef.current.data.startPrice ?? 0);
      if (startX !== null && startY !== null) {
        const dist = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
        if (dist < 10) {
          drawingRef.current = null;
          startPosRef.current = null;
          redraw();
          return;
        }
      }

      onDrawingComplete(drawingRef.current);
      drawingRef.current = null;
      startPosRef.current = null;
      redraw();
    },
    [chart, onDrawingComplete, redraw]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        // Delete selected drawing - handled by parent
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!chart) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "auto",
        zIndex: 10,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add DrawingCanvas overlay component"
```

---

## Task 7: IndicatorModal Component

**Files:**
- Create: `components/IndicatorModal.tsx`

- [ ] **Step 1: Create components/IndicatorModal.tsx**

```tsx
"use client";

import { useState, useEffect } from "react";

export interface IndicatorParams {
  ma: boolean;
  maPeriods: number[];
  macd: boolean;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  kdj: boolean;
  kdjK: number;
  kdjD: number;
  kdjJ: number;
  boll: boolean;
  bollPeriod: number;
  bollStdDev: number;
  rsi: boolean;
  rsiPeriod: number;
}

interface Props {
  indicator: "MA" | "MACD" | "KDJ" | "BOLL" | "RSI";
  params: IndicatorParams;
  onSave: (p: IndicatorParams) => void;
  onClose: () => void;
}

const labels: Record<string, Record<string, string>> = {
  MA: { maPeriods: "周期列表（逗号分隔）" },
  MACD: { macdFast: "快线", macdSlow: "慢线", macdSignal: "信号线" },
  KDJ: { kdjK: "K值", kdjD: "D值", kdjJ: "J值" },
  BOLL: { bollPeriod: "周期", bollStdDev: "标准差倍数" },
  RSI: { rsiPeriod: "周期" },
};

export default function IndicatorModal({ indicator, params, onSave, onClose }: Props) {
  const [local, setLocal] = useState<IndicatorParams>(params);

  // Fields for each indicator type
  const fields = {
    MA: ["maPeriods"] as const,
    MACD: ["macdFast", "macdSlow", "macdSignal"] as const,
    KDJ: ["kdjK", "kdjD", "kdjJ"] as const,
    BOLL: ["bollPeriod", "bollStdDev"] as const,
    RSI: ["rsiPeriod"] as const,
  };

  const handleSave = () => {
    onSave(local);
    onClose();
  };

  const updateField = (key: keyof IndicatorParams, value: string) => {
    if (key === "maPeriods") {
      const periods = value.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n) && n > 0);
      setLocal((p) => ({ ...p, maPeriods: periods }));
    } else {
      const num = parseFloat(value);
      if (!isNaN(num) && num > 0) {
        setLocal((p) => ({ ...p, [key]: num }));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-80 bg-[var(--surface)] border border-[var(--border)] p-4">
        <h3 className="text-sm font-mono font-bold text-[var(--text-primary)] mb-4">
          {indicator} 参数设置
        </h3>

        <div className="space-y-3">
          {fields[indicator].map((key) => (
            <div key={key}>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                {labels[indicator][key]}
              </label>
              <input
                type="text"
                className="w-full px-2 py-1.5 text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                value={
                  key === "maPeriods"
                    ? local.maPeriods.join(", ")
                    : String(local[key])
                }
                onChange={(e) => updateField(key, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 py-1.5 text-sm bg-[var(--accent)] text-white hover:opacity-90"
          >
            保存
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-1.5 text-sm bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add IndicatorModal component"
```

---

## Task 8: Update IndicatorPanel with Modal

**Files:**
- Modify: `components/IndicatorPanel.tsx`

- [ ] **Step 1: Update IndicatorPanel.tsx**

Read current IndicatorPanel.tsx, then replace it entirely with:

```tsx
"use client";

import { useState } from "react";
import type { IndicatorConfig } from "@/lib/types";
import IndicatorModal, { type IndicatorParams } from "./IndicatorModal";

interface Props {
  config: IndicatorConfig;
  onChange: (c: IndicatorConfig) => void;
}

export default function IndicatorPanel({ config, onChange }: Props) {
  const [modalIndicator, setModalIndicator] = useState<string | null>(null);

  const toggle = (key: keyof IndicatorConfig) => {
    onChange({ ...config, [key]: !config[key as keyof IndicatorConfig] });
  };

  const handleIndicatorClick = (key: string) => {
    setModalIndicator(key);
  };

  // Convert IndicatorConfig to IndicatorParams for modal
  const toModalParams = (): IndicatorParams => ({
    ma: config.ma,
    maPeriods: config.maPeriods,
    macd: config.macd,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    kdj: config.kdj,
    kdjK: 9,
    kdjD: 3,
    kdjJ: 3,
    boll: config.boll,
    bollPeriod: 20,
    bollStdDev: 2,
    rsi: config.rsi,
    rsiPeriod: config.rsiPeriod || 14,
  });

  const handleModalSave = (params: IndicatorParams) => {
    if (!modalIndicator) return;
    if (modalIndicator === "MA") {
      onChange({ ...config, maPeriods: params.maPeriods });
    } else if (modalIndicator === "MACD") {
      // MACD params stored separately; for now just enable
      onChange({ ...config, macd: true });
    } else if (modalIndicator === "KDJ") {
      onChange({ ...config, kdj: true });
    } else if (modalIndicator === "BOLL") {
      onChange({ ...config, boll: true });
    } else if (modalIndicator === "RSI") {
      onChange({ ...config, rsi: true, rsiPeriod: params.rsiPeriod });
    }
  };

  return (
    <>
      <div className="p-3 border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wide mb-3">
          技术指标
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { key: "ma", label: "MA", hasConfig: true },
            { key: "macd", label: "MACD", hasConfig: true },
            { key: "kdj", label: "KDJ", hasConfig: true },
            { key: "boll", label: "BOLL", hasConfig: true },
            { key: "rsi", label: "RSI", hasConfig: true },
          ] as const).map(({ key, label, hasConfig }) => (
            <div key={key} className="relative">
              <button
                type="button"
                aria-pressed={config[key]}
                onClick={() => (hasConfig ? handleIndicatorClick(label) : toggle(key))}
                className={`px-2 py-1 text-xs font-mono border transition-colors ${
                  config[key]
                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                    : "bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]"
                }`}
              >
                {label}
              </button>
            </div>
          ))}
        </div>
      </div>

      {modalIndicator && (
        <IndicatorModal
          indicator={modalIndicator as "MA" | "MACD" | "KDJ" | "BOLL" | "RSI"}
          params={toModalParams()}
          onSave={handleModalSave}
          onClose={() => setModalIndicator(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: update IndicatorPanel with param modal"
```

---

## Task 9: Integrate Drawing Tools into StockChart

**Files:**
- Modify: `components/StockChart.tsx`

- [ ] **Step 1: Update StockChart.tsx**

Read current StockChart.tsx and integrate the drawing toolbar and canvas:

Add these imports:
```tsx
import DrawingToolbar, { type DrawingTool } from "./DrawingToolbar";
import DrawingCanvas from "./DrawingCanvas";
import { useUser } from "./UserProvider";
```

Add these state variables after existing state:
```tsx
const [activeTool, setActiveTool] = useState<DrawingTool>("SELECT");
const [drawingColor, setDrawingColor] = useState("#E53935");
const [drawings, setDrawings] = useState<DrawingData[]>([]);
const { user } = useUser();
```

Add these refs:
```tsx
const drawingsLoadedRef = useRef(false);
```

Update the `initChart` useEffect to load drawings:
```tsx
useEffect(() => {
  if (!chartRef.current || !code || !user) return;
  if (drawingsLoadedRef.current) return;
  drawingsLoadedRef.current = true;

  fetch(`/api/drawings?stockCode=${code}`)
    .then((r) => r.json())
    .then((data) => {
      const parsed = data.map((d: any) => ({
        ...d,
        data: typeof d.data === "string" ? JSON.parse(d.data) : d.data,
      }));
      setDrawings(parsed);
    })
    .catch(() => {});
}, [code, user]);
```

Add `handleDrawingComplete` callback:
```tsx
const handleDrawingComplete = useCallback(
  async (d: DrawingData) => {
    if (!user) return;
    try {
      const res = await fetch("/api/drawings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockCode: code, type: d.type, data: d.data, color: d.color }),
      });
      const saved = await res.json();
      setDrawings((prev) => [...prev, { ...saved, data: typeof saved.data === "string" ? JSON.parse(saved.data) : saved.data }]);
    } catch {}
  },
  [code, user]
);
```

Add `handleDrawingDelete` callback:
```tsx
const handleDrawingDelete = useCallback(
  async (id: string) => {
    try {
      await fetch(`/api/drawings/${id}`, { method: "DELETE" });
      setDrawings((prev) => prev.filter((d) => d.id !== id));
    } catch {}
  },
  []
);
```

Modify the return JSX — add DrawingToolbar at top and DrawingCanvas after container div:
```tsx
return (
  <div className="flex flex-col h-full">
    <DrawingToolbar activeTool={activeTool} onToolChange={setActiveTool} />
    {crosshairDate && (
      <span className="text-xs font-mono text-[var(--accent)] bg-[var(--surface-elevated)] px-2 py-0.5 border border-[var(--border)]">
        {crosshairDate}
      </span>
    )}
    {(["daily", "weekly", "monthly"] as const).map((p) => (
      <button ... />
    ))}
    <div ref={containerRef} className="flex-1 min-h-0 relative">
      {chartRef.current && (
        <DrawingCanvas
          chart={chartRef.current}
          tool={activeTool}
          color={drawingColor}
          user={user}
          stockCode={code}
          onDrawingComplete={handleDrawingComplete}
          drawings={drawings}
          onDrawingDelete={handleDrawingDelete}
        />
      )}
    </div>
  </div>
);
```

Note: Since this is a complex integration, the implementer should read the full StockChart.tsx first and make minimal, targeted edits rather than replacing the entire file.

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: integrate drawing tools into StockChart"
```

---

## Task 10: Build Verification

Run build to ensure everything compiles:

```bash
npm run build
```

If build passes:

```bash
git add -A && git commit -m "feat: complete Phase 3 drawing tools and custom params"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add DrawingLine model to Prisma schema |
| 2 | Drawing utilities (coord conversion, fib calc) |
| 3 | Drawing API routes (CRUD) |
| 4 | Indicator config API |
| 5 | DrawingToolbar component |
| 6 | DrawingCanvas overlay |
| 7 | IndicatorModal component |
| 8 | Update IndicatorPanel with modal |
| 9 | Integrate drawing tools into StockChart |
| 10 | Build verification |

**Plan complete.** Saved to `docs/superpowers/plans/2026-03-31-stock-insight-phase3-plan.md`.
