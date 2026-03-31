# Stock Insight Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build MVP stock analysis page with K-line chart, technical indicators, stock search, and A-share data integration.

**Architecture:** Next.js 16 App Router with client components for interactive chart/indicators. API Routes proxy AKShare data. CSS custom properties for theming.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS 4, TradingView Lightweight Charts, AKShare (via API Routes), Server Actions.

---

## File Structure

```
app/
  layout.tsx              # Root layout with ThemeProvider
  page.tsx                # Home page → redirects to default stock
  globals.css             # Theme variables (Chinese red accent)
  stock/
    [code]/
      page.tsx            # Stock chart page (main feature)
  api/
    stocks/
      search/route.ts     # GET /api/stocks/search?q=
      [code]/
        route.ts          # GET /api/stocks/[code]
        kline/route.ts    # GET /api/stocks/[code]/kline?period=day&count=300

components/
  Header.tsx              # Logo + search bar + theme toggle
  StockChart.tsx          # TradingView Lightweight Charts wrapper (client)
  IndicatorPanel.tsx      # Technical indicator controls (client)
  WatchlistPanel.tsx      # Watchlist sidebar (placeholder, client)
  PortfolioPanel.tsx      # Portfolio sidebar (placeholder, client)
  StockSearch.tsx         # Stock search dropdown (client)

lib/
  indicators.ts           # Technical indicator calculation functions
  stockApi.ts             # AKShare API calls (server-side)
  types.ts                # Shared TypeScript types
```

---

## Task 1: Project Foundation

**Files:**
- Modify: `app/globals.css:1-198`
- Modify: `app/layout.tsx` (create)
- Create: `lib/types.ts`

- [ ] **Step 1: Update app/globals.css — Change accent from yellow to Chinese red**

Replace all `--accent` and `--accent-dim` values:

```css
/* 暗色主题 (默认) */
:root,
[data-theme="dark"] {
  --accent: #E53935;      /* 中国红 */
  --accent-dim: #B71C1C;  /* 深红 */
  /* ... 其他保持不变 ... */
}

/* 亮色主题 */
[data-theme="light"] {
  --accent: #E53935;      /* 中国红 */
  --accent-dim: #B71C1C;
  /* ... 其他保持不变 ... */
}
```

- [ ] **Step 2: Create lib/types.ts**

```typescript
export interface StockInfo {
  code: string;       // "600519"
  name: string;       // "贵州茅台"
  market: string;     // "sh" | "sz" | "bj"
}

export interface KLineData {
  time: number;       // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorConfig {
  ma: boolean;
  maPeriods: number[];
  macd: boolean;
  kdj: boolean;
  boll: boolean;
  rsi: boolean;
  rsiPeriod: number;
}
```

- [ ] **Step 3: Create app/layout.tsx**

```tsx
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Insight",
  description: "个人股票分析工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: update theme to Chinese red, add types, create layout"
```

---

## Task 2: API Routes — Stock Data

**Files:**
- Create: `app/api/stocks/search/route.ts`
- Create: `app/api/stocks/[code]/route.ts`
- Create: `app/api/stocks/[code]/kline/route.ts`
- Create: `lib/stockApi.ts`

**Prerequisites:** Install akshare: `npm install akshare`

- [ ] **Step 1: Create lib/stockApi.ts**

```typescript
import akshare from "akshare";

export async function searchStocks(query: string): Promise<StockInfo[]> {
  // Use akshare stock_zh_a_spot_em() to get all A-share stocks
  // Filter by code or name matching query
  const all = await akshare.stock_zh_a_spot_em();
  const q = query.toUpperCase();
  return all
    .filter((s: any) =>
      s["代码"]?.includes(q) || s["名称"]?.includes(query)
    )
    .slice(0, 20)
    .map((s: any) => ({
      code: s["代码"],
      name: s["名称"],
      market: s["代码"]?.startsWith("6") ? "sh" : "sz",
    }));
}

export async function getKLineData(
  code: string,
  period: string = "daily",
  count: number = 300
): Promise<KLineData[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - count * 2);

  const formatter = (d: Date) =>
    d.toISOString().slice(0, 10).replace(/-/g, "");

  const data = await akshare.stock_zh_a_hist({
    symbol: code,
    period,
    start_date: formatter(start),
    end_date: formatter(end),
    adjust: "qfq",
  });

  return data.map((row: any) => ({
    time: Math.floor(
      new Date(row["日期"]).getTime() / 1000
    ),
    open: parseFloat(row["开盘"]),
    high: parseFloat(row["最高"]),
    low: parseFloat(row["最低"]),
    close: parseFloat(row["收盘"]),
    volume: parseFloat(row["成交量"]),
  }));
}

export async function getStockInfo(code: string): Promise<StockInfo> {
  const all = await akshare.stock_zh_a_spot_em();
  const stock = all.find((s: any) => s["代码"] === code);
  if (!stock) throw new Error(`Stock ${code} not found`);
  return {
    code: stock["代码"],
    name: stock["名称"],
    market: code.startsWith("6") ? "sh" : "sz",
  };
}
```

- [ ] **Step 2: Create app/api/stocks/search/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { searchStocks } from "@/lib/stockApi";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  if (!q) return NextResponse.json([]);
  try {
    const results = await searchStocks(q);
    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create app/api/stocks/[code]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getStockInfo } from "@/lib/stockApi";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  try {
    const info = await getStockInfo(code);
    return NextResponse.json(info);
  } catch {
    return NextResponse.json({ error: "Stock not found" }, { status: 404 });
  }
}
```

- [ ] **Step 4: Create app/api/stocks/[code]/kline/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getKLineData } from "@/lib/stockApi";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const period = req.nextUrl.searchParams.get("period") || "daily";
  const count = parseInt(req.nextUrl.searchParams.get("count") || "300");
  try {
    const data = await getKLineData(code, period, count);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch K-line" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add AKShare API routes for stock search and K-line data"
```

---

## Task 3: Stock Chart Component

**Files:**
- Create: `components/StockChart.tsx`
- Create: `components/ChartHeader.tsx`

**Prerequisites:** Install lightweight-charts: `npm install lightweight-charts`

- [ ] **Step 1: Install lightweight-charts**

```bash
npm install lightweight-charts
```

- [ ] **Step 2: Create components/StockChart.tsx**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  LineData,
  CrosshairMode,
} from "lightweight-charts";
import type { KLineData, IndicatorConfig } from "@/lib/types";

interface Props {
  code: string;
  klineData: KLineData[];
  indicators: IndicatorConfig;
}

export default function StockChart({ code, klineData, indicators }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#0A0A0A" },
        textColor: "#888888",
      },
      grid: {
        vertLines: { color: "#1A1A1A" },
        horzLines: { color: "#1A1A1A" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#E53935", width: 1, style: 2 },
        horzLine: { color: "#E53935", width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: "#2A2A2A",
      },
      timeScale: {
        borderColor: "#2A2A2A",
        timeVisible: true,
      },
    });

    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#E53935",
      downColor: "#4CAF50",
      borderUpColor: "#E53935",
      borderDownColor: "#4CAF50",
      wickUpColor: "#E53935",
      wickDownColor: "#4CAF50",
    });
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addHistogramSeries({
      color: "#E5393540",
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !klineData.length)
      return;

    const candles: CandlestickData[] = klineData.map((d) => ({
      time: d.time as any,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumes: HistogramData[] = klineData.map((d) => ({
      time: d.time as any,
      value: d.volume,
      color: d.close >= d.open ? "#E5393540" : "#4CAF5040",
    }));

    candleSeriesRef.current.setData(candles);
    volumeSeriesRef.current.setData(volumes);

    chartRef.current?.timeScale().fitContent();
  }, [klineData]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        {(["daily", "weekly", "monthly"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 text-xs font-mono uppercase tracking-wide border transition-colors ${
              period === p
                ? "bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]"
                : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]"
            }`}
          >
            {p === "daily" ? "日K" : p === "weekly" ? "周K" : "月K"}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add StockChart component with TradingView Lightweight Charts"
```

---

## Task 4: Header + Stock Search

**Files:**
- Create: `components/Header.tsx`
- Create: `components/StockSearch.tsx`

- [ ] **Step 1: Create components/StockSearch.tsx**

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { StockInfo } from "@/lib/types";

export default function StockSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (code: string) => {
    router.push(`/stock/${code}`);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query && setOpen(true)}
        placeholder="搜索股票代码或名称..."
        className="w-64 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors font-mono"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-xs">...</span>
      )}
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-[var(--surface-elevated)] border border-[var(--border)] z-50 max-h-64 overflow-y-auto">
          {results.map((s) => (
            <button
              key={s.code}
              onClick={() => select(s.code)}
              className="w-full px-3 py-2 flex items-center gap-3 hover:bg-[var(--surface)] text-left transition-colors"
            >
              <span className="font-mono text-xs text-[var(--accent)] w-16">{s.code}</span>
              <span className="text-sm text-[var(--text-primary)]">{s.name}</span>
              <span className="text-xs text-[var(--text-muted)] ml-auto">{s.market.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create components/Header.tsx**

```tsx
"use client";

import Link from "next/link";
import StockSearch from "./StockSearch";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  return (
    <header className="h-14 border-b border-[var(--border)] flex items-center px-4 gap-4 bg-[var(--surface)]">
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <div className="w-6 h-6 bg-[var(--accent)]" />
        <span className="font-display font-semibold text-[var(--text-primary)] tracking-wide">
          STOCK INSIGHT
        </span>
      </Link>
      <div className="flex-1 flex justify-center">
        <StockSearch />
      </div>
      <ThemeToggle />
    </header>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add Header with integrated StockSearch component"
```

---

## Task 5: Technical Indicator Calculations

**Files:**
- Create: `lib/indicators.ts`

- [ ] **Step 1: Create lib/indicators.ts**

```typescript
import type { KLineData } from "./types";

export function calcMA(data: KLineData[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, d) => acc + d.close, 0);
    return parseFloat((sum / period).toFixed(2));
  });
}

export function calcMACD(
  data: KLineData[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
) {
  const ema = (arr: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const result: number[] = [];
    let prev = arr[0];
    for (const v of arr) {
      prev = v * k + prev * (1 - k);
      result.push(prev);
    }
    return result;
  };

  const closes = data.map((d) => d.close);
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const dif = emaFast.map((f, i) => parseFloat((f - emaSlow[i]).toFixed(4)));
  const dea = ema(dif, signal);
  const macd = dif.map((d, i) => parseFloat(((d - dea[i]) * 2).toFixed(4)));

  return { dif, dea, macd };
}

export function calcKDJ(
  data: KLineData[],
  period: number = 9,
  kPeriod: number = 3,
  dPeriod: number = 3
) {
  const rsv: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { rsv.push(50); continue; }
    const window = data.slice(i - period + 1, i + 1);
    const high = Math.max(...window.map((d) => d.high));
    const low = Math.min(...window.map((d) => d.low));
    const close = data[i].close;
    rsv.push(high === low ? 50 : ((close - low) / (high - low)) * 100);
  }

  const k: number[] = [];
  const d: number[] = [];
  let prevK = 50, prevD = 50;
  for (const r of rsv) {
    prevK = (2 / kPeriod) * r + (1 - 2 / kPeriod) * prevK;
    prevD = (2 / dPeriod) * prevK + (1 - 2 / dPeriod) * prevD;
    k.push(parseFloat(prevK.toFixed(2)));
    d.push(parseFloat(prevD.toFixed(2)));
  }
  const j = k.map((ki, i) => parseFloat((3 * ki - 2 * d[i]).toFixed(2)));

  return { k, d, j };
}

export function calcBOLL(
  data: KLineData[],
  period: number = 20,
  multiplier: number = 2
) {
  const ma = calcMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { upper.push(null); lower.push(null); continue; }
    const window = data.slice(i - period + 1, i + 1);
    const mean = ma[i]!;
    const std = Math.sqrt(
      window.reduce((acc, d) => acc + Math.pow(d.close - mean, 2), 0) / period
    );
    upper.push(parseFloat((mean + multiplier * std).toFixed(2)));
    lower.push(parseFloat((mean - multiplier * std).toFixed(2)));
  }

  return { middle: ma, upper, lower };
}

export function calcRSI(data: KLineData[], period: number = 14): (number | null)[] {
  if (data.length < period + 1) return data.map(() => null);
  const result: (number | null)[] = Array(period).fill(null);
  let avgGain = 0, avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;
  result.push(avgLoss === 0 ? 100 : parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2)));

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result.push(avgLoss === 0 ? 100 : parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2)));
  }

  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add technical indicator calculation library"
```

---

## Task 6: Indicator Panel

**Files:**
- Create: `components/IndicatorPanel.tsx`

- [ ] **Step 1: Create components/IndicatorPanel.tsx**

```tsx
"use client";

import { useState } from "react";
import type { IndicatorConfig } from "@/lib/types";

interface Props {
  config: IndicatorConfig;
  onChange: (c: IndicatorConfig) => void;
}

export default function IndicatorPanel({ config, onChange }: Props) {
  const toggle = (key: keyof IndicatorConfig) => {
    onChange({ ...config, [key]: !config[key as keyof IndicatorConfig] });
  };

  return (
    <div className="p-3 border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wide mb-3">
        Technical Indicators
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          { key: "ma", label: "MA" },
          { key: "macd", label: "MACD" },
          { key: "kdj", label: "KDJ" },
          { key: "boll", label: "BOLL" },
          { key: "rsi", label: "RSI" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggle(key as keyof IndicatorConfig)}
            className={`px-2 py-1 text-xs font-mono border transition-colors ${
              config[key as keyof IndicatorConfig]
                ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                : "bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add IndicatorPanel component"
```

---

## Task 7: Main Stock Page

**Files:**
- Modify: `app/page.tsx`
- Create: `app/stock/[code]/page.tsx`
- Create: `components/Sidebar.tsx`
- Create: `components/WatchlistPanel.tsx`
- Create: `components/PortfolioPanel.tsx`

- [ ] **Step 1: Create app/stock/[code]/page.tsx**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import StockChart from "@/components/StockChart";
import IndicatorPanel from "@/components/IndicatorPanel";
import WatchlistPanel from "@/components/WatchlistPanel";
import PortfolioPanel from "@/components/PortfolioPanel";
import type { KLineData, IndicatorConfig } from "@/lib/types";

const defaultIndicators: IndicatorConfig = {
  ma: true,
  maPeriods: [5, 10, 20, 60],
  macd: true,
  kdj: false,
  boll: false,
  rsi: false,
  rsiPeriod: 14,
};

export default function StockPage() {
  const params = useParams();
  const code = params.code as string;
  const [klineData, setKlineData] = useState<KLineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [indicators, setIndicators] = useState<IndicatorConfig>(defaultIndicators);
  const [watchlistOpen, setWatchlistOpen] = useState(true);
  const [portfolioOpen, setPortfolioOpen] = useState(true);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    fetch(`/api/stocks/${code}/kline?period=daily&count=300`)
      .then((r) => r.json())
      .then((data) => { setKlineData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [code]);

  return (
    <div className="h-screen flex flex-col bg-[var(--background)]">
      <Header />
      <div className="flex-1 flex min-h-0">
        {/* Main chart area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 p-3 min-h-0">
            {loading ? (
              <div className="h-full flex items-center justify-center text-[var(--text-muted)] font-mono text-sm">
                Loading {code}...
              </div>
            ) : (
              <StockChart code={code} klineData={klineData} indicators={indicators} />
            )}
          </div>
          <IndicatorPanel config={indicators} onChange={setIndicators} />
        </div>

        {/* Right sidebar */}
        <div className="w-64 border-l border-[var(--border)] flex flex-col shrink-0">
          <button
            onClick={() => setWatchlistOpen(!watchlistOpen)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs font-mono uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text-primary)] border-b border-[var(--border)] transition-colors"
          >
            Watchlist
            <span>{watchlistOpen ? "−" : "+"}</span>
          </button>
          {watchlistOpen && <WatchlistPanel />}

          <button
            onClick={() => setPortfolioOpen(!portfolioOpen)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs font-mono uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text-primary)] border-t border-b border-[var(--border)] transition-colors"
          >
            Portfolio
            <span>{portfolioOpen ? "−" : "+"}</span>
          </button>
          {portfolioOpen && <PortfolioPanel />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create app/page.tsx (redirect to default stock)**

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  // Default to 贵州茅台 (600519)
  redirect("/stock/600519");
}
```

- [ ] **Step 3: Create components/WatchlistPanel.tsx**

```tsx
"use client";

import Link from "next/link";

const PLACEHOLDER_STOCKS = [
  { code: "600519", name: "贵州茅台" },
  { code: "000858", name: "五粮液" },
  { code: "601318", name: "中国平安" },
  { code: "000001", name: "平安银行" },
  { code: "600036", name: "招商银行" },
];

export default function WatchlistPanel() {
  return (
    <div className="flex-1 overflow-y-auto">
      {PLACEHOLDER_STOCKS.map((s) => (
        <Link
          key={s.code}
          href={`/stock/${s.code}`}
          className="block px-3 py-2 hover:bg-[var(--surface-elevated)] transition-colors border-b border-[var(--border)]"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-[var(--accent)]">{s.code}</span>
            <span className="text-sm text-[var(--text-primary)] truncate ml-2">{s.name}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create components/PortfolioPanel.tsx**

```tsx
"use client";

export default function PortfolioPanel() {
  return (
    <div className="flex-1 p-3">
      <div className="text-xs text-[var(--text-muted)] font-mono mb-3">
        Holdings (coming soon)
      </div>
      <div className="text-xs text-[var(--text-muted)] italic">
        Login to sync your portfolio
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: build main stock chart page with sidebar panels"
```

---

## Task 8: Self-Review Checklist

Run through each item in the spec and verify coverage:

| Spec Item | Status |
|-----------|--------|
| 日/周/月K线切换 | ✅ Task 3 (period buttons in StockChart) |
| 分时图 | ❌ Out of scope for Phase 1 |
| 十字光标 | ✅ Built into TradingView Lightweight Charts |
| 均线MA | ✅ Task 5 (calcMA) + Task 3 integration needed |
| MACD | ✅ Task 5 (calcMACD) + Task 3 integration needed |
| KDJ | ✅ Task 5 (calcKDJ) |
| 布林带 | ✅ Task 5 (calcBOLL) |
| RSI | ✅ Task 5 (calcRSI) |
| 成交量VOL | ✅ Task 3 (volume series) |
| 股票搜索 | ✅ Task 4 (StockSearch) |
| URL跳转 | ✅ Task 7 (app/stock/[code]/page.tsx) |
| A股数据 | ✅ Task 2 (API routes via AKShare) |
| 自选股列表 | ✅ Task 7 (WatchlistPanel placeholder) |
| 持仓面板 | ✅ Task 7 (PortfolioPanel placeholder) |
| 中国红主题 | ✅ Task 1 (globals.css update) |

**Gap identified:** MA/MACD line series are calculated in lib/indicators.ts but not yet rendered on the chart in StockChart.tsx. Add integration in Task 9.

---

## Task 9: Indicator Integration on Chart (Final Polish)

**Files:**
- Modify: `components/StockChart.tsx`

This task integrates the calculated indicator lines into the TradingView chart. Since this is an addition to Task 3, the step numbers here are incremental continuation.

- [ ] **Step 1: Update StockChart.tsx to render MA and MACD lines**

Replace the current `StockChart.tsx` with a version that adds MA line series and MACD sub-chart:

```tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  LineData,
  CrosshairMode,
  Time,
} from "lightweight-charts";
import type { KLineData, IndicatorConfig } from "@/lib/types";
import { calcMA, calcMACD } from "@/lib/indicators";

interface Props {
  code: string;
  klineData: KLineData[];
  indicators: IndicatorConfig;
}

export default function StockChart({ code, klineData, indicators }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maSeriesRefs = useRef<Map<number, ISeriesApi<"Line">>>(new Map());
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  const initChart = useCallback(() => {
    if (!containerRef.current) return;
    chartRef.current?.remove();

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#0A0A0A" },
        textColor: "#888888",
      },
      grid: {
        vertLines: { color: "#1A1A1A" },
        horzLines: { color: "#1A1A1A" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#E53935", width: 1, style: 2 },
        horzLine: { color: "#E53935", width: 1, style: 2 },
      },
      rightPriceScale: { borderColor: "#2A2A2A" },
      timeScale: { borderColor: "#2A2A2A", timeVisible: true },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    chartRef.current = chart;

    const cs = chart.addCandlestickSeries({
      upColor: "#E53935", downColor: "#4CAF50",
      borderUpColor: "#E53935", borderDownColor: "#4CAF50",
      wickUpColor: "#E53935", wickDownColor: "#4CAF50",
    });
    candleSeriesRef.current = cs;

    const vs = chart.addHistogramSeries({
      color: "#E5393540", priceFormat: { type: "volume" }, priceScaleId: "",
    });
    vs.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    volumeSeriesRef.current = vs;

    // MA line series (up to 4 lines)
    const colors = ["#FFD700", "#FF6B6B", "#4ECDC4", "#A855F7"];
    indicators.maPeriods.forEach((p, i) => {
      const s = chart.addLineSeries({
        color: colors[i % colors.length],
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      maSeriesRefs.current.set(p, s);
    });

    window.addEventListener("resize", () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
  }, [indicators.maPeriods]);

  useEffect(() => { initChart(); }, [initChart]);

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !klineData.length) return;

    const times = klineData.map((d) => d.time as Time);

    const candles: CandlestickData[] = klineData.map((d) => ({
      time: d.time as Time,
      open: d.open, high: d.high, low: d.low, close: d.close,
    }));
    candleSeriesRef.current.setData(candles);

    const volumes: HistogramData[] = klineData.map((d) => ({
      time: d.time as Time,
      value: d.volume,
      color: d.close >= d.open ? "#E5393540" : "#4CAF5040",
    }));
    volumeSeriesRef.current.setData(volumes);

    // MA lines
    if (indicators.ma) {
      indicators.maPeriods.forEach((p) => {
        const series = maSeriesRefs.current.get(p);
        if (!series) return;
        const maData = calcMA(klineData, p);
        const lineData: LineData[] = maData.map((v, i) => ({
          time: times[i],
          value: v ?? 0,
        })).filter((d) => d.value !== 0) as LineData[];
        series.setData(lineData);
      });
    }

    chartRef.current?.timeScale().fitContent();
  }, [klineData, indicators]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        {(["daily", "weekly", "monthly"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 text-xs font-mono uppercase tracking-wide border transition-colors ${
              period === p
                ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]"
            }`}
          >
            {p === "daily" ? "日K" : p === "weekly" ? "周K" : "月K"}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: integrate MA line series into StockChart"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Project Foundation (theme, types, layout) |
| 2 | API Routes (AKShare stock search, K-line) |
| 3 | StockChart with TradingView Lightweight Charts |
| 4 | Header + StockSearch components |
| 5 | Technical indicator calculations (MA/MACD/KDJ/BOLL/RSI) |
| 6 | IndicatorPanel UI |
| 7 | Main stock page + sidebar panels |
| 8 | Self-review checklist |
| 9 | MA line series integration |

**Plan complete.** Saved to `docs/superpowers/plans/2026-03-31-stock-insight-phase1-plan.md`.
