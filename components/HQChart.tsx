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

  // Calculate price change
  const getChange = (data: KLineData) => {
    const prevClose = data.open; // approximate
    const change = data.close - prevClose;
    const changePercent = (change / prevClose) * 100;
    return { change, changePercent };
  };

  return (
    <div className="flex flex-col h-[500px]">
      {/* Period selector */}
      <div className="flex items-center gap-2 mb-2 shrink-0">
        {(["日K", "周K", "月K"] as const).map((label) => (
          <button
            key={label}
            className="px-3 py-1 text-xs font-mono border bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] transition-colors"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart container */}
      <div ref={containerRef} className="flex-1 relative bg-[#1a1a1a] rounded min-h-0">
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
