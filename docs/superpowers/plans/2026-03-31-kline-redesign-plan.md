# K-Line Chart Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace TradingView Lightweight Charts with a native Canvas-based K-line chart implementation following Tonghuashun (同花顺) styling.

**Architecture:** Canvas-based layered rendering with React hooks integration. Single chart component manages multiple canvas layers for main K-line area, volume, and indicators.

**Tech Stack:** Pure Canvas 2D API (no chart library), React hooks, TypeScript.

---

## File Structure

```
lib/
  chartRenderer.ts    # Canvas rendering core
  indicators.ts      # Existing — may need updates

components/
  HQChart.tsx        # Main component (replaces StockChart)
  CrosshairInfo.tsx  # Crosshair info box overlay

app/stock/[code]/
  page.tsx           # Update to use HQChart
```

---

## Task 1: Remove TradingView Lightweight Charts

**Files:**
- Modify: `package.json`
- Modify: `components/StockChart.tsx`

- [ ] **Step 1: Remove lightweight-charts dependency**

```bash
npm uninstall lightweight-charts
```

- [ ] **Step 2: Remove StockChart.tsx**

```bash
rm components/StockChart.tsx
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: remove lightweight-charts dependency"
```

---

## Task 2: Create Chart Renderer Core

**Files:**
- Create: `lib/chartRenderer.ts`

- [ ] **Step 1: Create lib/chartRenderer.ts**

This is the core rendering engine. It contains all the canvas drawing logic.

```typescript
// lib/chartRenderer.ts

export interface KLineData {
  date: number;      // yyyymmdd format
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount?: number;
}

export interface ChartConfig {
  background: string;
  gridColor: string;
  upColor: string;     // #e53935
  downColor: string;   // #4caf50
  maColors: string[];  // [MA5, MA10, MA20, MA30, MA60]
}

export const DEFAULT_CONFIG: ChartConfig = {
  background: "#1a1a1a",
  gridColor: "#2a2a2a",
  upColor: "#e53935",
  downColor: "#4caf50",
  maColors: ["#ffffff", "#ffff00", "#cc66ff", "#66ff56", "#cc9966"],
};

export class ChartRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: KLineData[] = [];
  private visibleRange: { start: number; end: number } = { start: 0, end: 100 };
  private candleWidth: number = 8;
  private candleGap: number = 2;
  private scale: number = 1;
  private scrollOffset: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context not available");
    this.ctx = ctx;
  }

  setData(data: KLineData[]) {
    this.data = data;
    this.calculateVisibleRange();
    this.render();
  }

  setScale(scale: number) {
    this.scale = Math.max(0.5, Math.min(3, scale));
    this.calculateCandleWidth();
    this.calculateVisibleRange();
    this.render();
  }

  setScrollOffset(offset: number) {
    this.scrollOffset = offset;
    this.calculateVisibleRange();
    this.render();
  }

  private calculateCandleWidth() {
    const baseWidth = 8;
    this.candleWidth = baseWidth * this.scale;
    this.candleGap = Math.max(1, 2 * this.scale);
  }

  private calculateVisibleRange() {
    const totalWidth = this.canvas.width;
    const candleTotal = this.candleWidth + this.candleGap;
    const visibleCount = Math.floor(totalWidth / candleTotal);
    const maxOffset = Math.max(0, this.data.length - visibleCount);
    const offset = Math.max(0, Math.min(maxOffset, this.scrollOffset));
    this.visibleRange = {
      start: offset,
      end: Math.min(this.data.length, offset + visibleCount + 1),
    };
  }

  private render() {
    if (!this.ctx) return;
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    // Background
    this.ctx.fillStyle = DEFAULT_CONFIG.background;
    this.ctx.fillRect(0, 0, width, height);

    // Grid
    this.drawGrid();

    // K-lines
    this.drawCandles();

    // MA lines
    this.drawMALines();
  }

  private drawGrid() {
    const { width, height } = this.canvas;
    this.ctx.strokeStyle = DEFAULT_CONFIG.gridColor;
    this.ctx.lineWidth = 0.5;

    // Horizontal grid lines (5 lines)
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }
  }

  private drawCandles() {
    const { start, end } = this.visibleRange;
    const visibleData = this.data.slice(start, end);
    const { width, height } = this.canvas;
    const candleTotal = this.candleWidth + this.candleGap;

    // Calculate price range
    let minPrice = Infinity, maxPrice = -Infinity;
    visibleData.forEach((d) => {
      minPrice = Math.min(minPrice, d.low);
      maxPrice = Math.max(maxPrice, d.high);
    });
    const priceRange = maxPrice - minPrice;
    const priceHeight = height * 0.7; // Leave space for volume

    visibleData.forEach((d, i) => {
      const x = i * candleTotal + this.candleWidth / 2;
      const isUp = d.close >= d.open;
      const color = isUp ? DEFAULT_CONFIG.upColor : DEFAULT_CONFIG.downColor;

      // Y position
      const yHigh = priceHeight - ((d.high - minPrice) / priceRange) * priceHeight;
      const yLow = priceHeight - ((d.low - minPrice) / priceRange) * priceHeight;
      const yOpen = priceHeight - ((d.open - minPrice) / priceRange) * priceHeight;
      const yClose = priceHeight - ((d.close - minPrice) / priceRange) * priceHeight;

      // Draw wick
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x, yHigh);
      this.ctx.lineTo(x, yLow);
      this.ctx.stroke();

      // Draw body
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.abs(yClose - yOpen) || 1;
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x - this.candleWidth / 2, bodyTop, this.candleWidth, bodyHeight);
    });
  }

  private drawMALines() {
    // Calculate MA5, MA10, MA20, MA30, MA60
    const mas = [5, 10, 20, 30, 60];
    const { start, end } = this.visibleRange;
    const visibleData = this.data.slice(start, end);
    const { height } = this.canvas;
    const priceHeight = height * 0.7;

    let minPrice = Infinity, maxPrice = -Infinity;
    visibleData.forEach((d) => {
      minPrice = Math.min(minPrice, d.low);
      maxPrice = Math.max(maxPrice, d.high);
    });
    const priceRange = maxPrice - minPrice;
    const candleTotal = this.candleWidth + this.candleGap;

    mas.forEach((period, idx) => {
      if (visibleData.length < period) return;
      const color = DEFAULT_CONFIG.maColors[idx];

      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();

      let started = false;
      visibleData.forEach((d, i) => {
        if (i < period - 1) return;
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += visibleData[i - j].close;
        }
        const ma = sum / period;
        const x = (i - period + 1) * candleTotal + this.candleWidth / 2;
        const y = priceHeight - ((ma - minPrice) / priceRange) * priceHeight;

        if (!started) {
          this.ctx.moveTo(x, y);
          started = true;
        } else {
          this.ctx.lineTo(x, y);
        }
      });

      this.ctx.stroke();
    });
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.calculateVisibleRange();
    this.render();
  }

  // Get data at pixel position (for crosshair)
  getDataAtX(x: number): KLineData | null {
    const candleTotal = this.candleWidth + this.candleGap;
    const index = Math.floor(x / candleTotal) + this.visibleRange.start;
    if (index < 0 || index >= this.data.length) return null;
    return this.data[index];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add chart renderer core"
```

---

## Task 3: Create HQChart Component

**Files:**
- Create: `components/HQChart.tsx`

- [ ] **Step 1: Create components/HQChart.tsx**

```tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChartRenderer, type KLineData } from "@/lib/chartRenderer";

interface Props {
  code: string;
  klineData: KLineData[];
  indicators: {
    ma: boolean;
    maPeriods: number[];
    macd: boolean;
    kdj: boolean;
    boll: boolean;
    rsi: boolean;
  };
}

export default function HQChart({ code, klineData, indicators }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ChartRenderer | null>(null);
  const [crosshairData, setCrosshairData] = useState<KLineData | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const renderer = new ChartRenderer(canvasRef.current);
    rendererRef.current = renderer;

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        renderer.resize(width, height);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Update data
  useEffect(() => {
    if (!rendererRef.current || !klineData.length) return;
    rendererRef.current.setData(klineData);
  }, [klineData]);

  // Crosshair handling
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!rendererRef.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const data = rendererRef.current.getDataAtX(x);
    setCrosshairData(data);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setCrosshairData(null);
  }, []);

  // Format date
  const formatDate = (date: number) => {
    const s = String(date);
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Period selector */}
      <div className="flex items-center gap-2 mb-2">
        {(["日K", "周K", "月K"] as const).map((label, i) => (
          <button
            key={label}
            className="px-3 py-1 text-xs font-mono border bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] transition-colors"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart container */}
      <div ref={containerRef} className="flex-1 relative bg-[#1a1a1a] rounded">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* Crosshair info box */}
        {crosshairData && (
          <div className="absolute top-2 left-2 bg-[#1a1a1a] border border-[#2a2a2a] p-2 text-xs font-mono text-white z-10">
            <div className="text-[#888] mb-1">{formatDate(crosshairData.date)}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <span className="text-[#888]">开盘:</span>
              <span>{crosshairData.open.toFixed(2)}</span>
              <span className="text-[#888]">最高:</span>
              <span className="text-[#e53935]">{crosshairData.high.toFixed(2)}</span>
              <span className="text-[#888]">收盘:</span>
              <span>{crosshairData.close.toFixed(2)}</span>
              <span className="text-[#888]">最低:</span>
              <span className="text-[#4caf50]">{crosshairData.low.toFixed(2)}</span>
              <span className="text-[#888]">成交量:</span>
              <span>{(crosshairData.volume / 10000).toFixed(2)}万</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add HQChart component"
```

---

## Task 4: Update Stock Page to Use HQChart

**Files:**
- Modify: `app/stock/[code]/page.tsx`

- [ ] **Step 1: Update app/stock/[code]/page.tsx**

Read current page.tsx, then update the import and usage:

Change:
```tsx
import StockChart from "@/components/StockChart";
```

To:
```tsx
import HQChart from "@/components/HQChart";
```

Change the component usage from `<StockChart ... />` to `<HQChart ... />`.

The props interface matches (code, klineData, indicators).

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: update stock page to use HQChart"
```

---

## Task 5: Build Verification

```bash
npm run build
```

If build passes:

```bash
git add -A && git commit -m "feat: complete K-line chart redesign"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Remove TradingView Lightweight Charts |
| 2 | Create chart renderer core (lib/chartRenderer.ts) |
| 3 | Create HQChart component |
| 4 | Update stock page to use HQChart |
| 5 | Build verification |

**Note:** This is a simplified implementation. The chart renderer provides the foundation for K-line rendering with MA lines. Additional features (zoom/pan, volume sub-chart, MACD/KDJ/BOLL/RSI indicators, crosshair info box expansion) can be added in subsequent tasks based on priority.

**Plan complete.** Saved to `docs/superpowers/plans/2026-03-31-kline-redesign-plan.md`.
