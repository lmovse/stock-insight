"use client";

import { useEffect, useRef, useCallback } from "react";
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
  onCrosshairMove?: (data: { data: KLineData; index: number } | null) => void;
}

export default function HQChart({ code, klineData, indicators, onCrosshairMove }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ChartRenderer | null>(null);

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

  // Handle crosshair and notify parent
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
    onCrosshairMove?.(data ? { data, index: klineData.indexOf(data) } : null);
  }, [klineData, onCrosshairMove]);

  const handleMouseLeave = useCallback(() => {
    onCrosshairMove?.(null);
    rendererRef.current?.setCrosshair(null, null);
  }, [onCrosshairMove]);

  return (
    <div ref={containerRef} className="relative h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ touchAction: 'none' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
