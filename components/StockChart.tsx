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
import { calcMA } from "@/lib/indicators";

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
    maSeriesRefs.current.clear();
    indicators.maPeriods.forEach((p, i) => {
      const s = chart.addLineSeries({
        color: colors[i % colors.length],
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      maSeriesRefs.current.set(p, s);
    });

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