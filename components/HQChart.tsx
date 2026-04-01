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

    // Resize using getBoundingClientRect for accurate dimensions
    const doResize = () => {
      if (!containerRef.current || !rendererRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) {
        rendererRef.current.resize(width, height);
      }
    };

    doResize();

    const resizeObserver = new ResizeObserver(() => {
      doResize();
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
    rendererRef.current.resetScroll();
  }, [klineData]);

  // Update indicator settings
  useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.setSettings({
      ma: indicators.ma,
      maPeriods: indicators.maPeriods,
      macd: indicators.macd,
      kdj: indicators.kdj,
      boll: indicators.boll,
      rsi: indicators.rsi,
    });
  }, [indicators]);

  // Handle theme changes
  useEffect(() => {
    if (!rendererRef.current) return;

    const theme = document.documentElement.getAttribute("data-theme") as "dark" | "light" || "dark";
    rendererRef.current.setTheme(theme);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === "data-theme") {
          const newTheme = document.documentElement.getAttribute("data-theme") as "dark" | "light" || "dark";
          rendererRef.current?.setTheme(newTheme);
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  // Crosshair handling
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!rendererRef.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    rendererRef.current.setCrosshair(x, y);
    const data = rendererRef.current.getDataAtX(x);
    setCrosshairData(data);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setCrosshairData(null);
    rendererRef.current?.setCrosshair(null, null);
  }, []);

  // Format date
  const formatDate = (date: number) => {
    const s = String(date);
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  };

  return (
    <div ref={containerRef} className="relative h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {/* Crosshair info box */}
      {crosshairData && (
        <div className="absolute top-4 left-4 bg-[var(--surface)]/95 backdrop-blur-md rounded-2xl p-4 text-sm shadow-xl border border-[var(--border)]">
          <div className="text-[var(--text-muted)] mb-3 font-medium">{formatDate(crosshairData.date)}</div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-6">
              <span className="text-[var(--text-secondary)]">开盘</span>
              <span className="font-mono font-medium">{crosshairData.open.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-[var(--text-secondary)]">最高</span>
              <span className="font-mono font-medium text-[var(--up-color)]">{crosshairData.high.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-[var(--text-secondary)]">收盘</span>
              <span className="font-mono font-medium">{crosshairData.close.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-[var(--text-secondary)]">最低</span>
              <span className="font-mono font-medium text-[var(--down-color)]">{crosshairData.low.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-6 pt-2 border-t border-[var(--border-subtle)]">
              <span className="text-[var(--text-secondary)]">成交量</span>
              <span className="font-mono font-medium">{(crosshairData.volume / 10000).toFixed(2)}万</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
