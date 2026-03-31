"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  CrosshairMode,
  Time,
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
      time: d.time as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumes: HistogramData[] = klineData.map((d) => ({
      time: d.time as Time,
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