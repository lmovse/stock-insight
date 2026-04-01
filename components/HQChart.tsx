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
  const [crosshairData, setCrosshairData] = useState<{ data: KLineData; index: number } | null>(null);

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
    setCrosshairData(data ? { data, index: klineData.indexOf(data) } : null);
  }, [klineData]);

  const handleMouseLeave = useCallback(() => {
    setCrosshairData(null);
    rendererRef.current?.setCrosshair(null, null);
  }, []);

  // Format date
  const formatDate = (date: number) => {
    const s = String(date);
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  };

  const formatAmount = (v: number) => {
    if (v >= 100000000) return (v / 100000000).toFixed(2) + "亿";
    if (v >= 10000) return (v / 10000).toFixed(2) + "万";
    return v.toFixed(2);
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
      {crosshairData && (() => {
        const { data: d, index } = crosshairData;
        const prev = klineData[index - 1];
        const change = prev ? d.close - prev.close : 0;
        const changePct = prev && prev.close !== 0 ? (change / prev.close) * 100 : 0;
        const amplitude = prev && prev.close !== 0 ? ((d.high - d.low) / prev.close) * 100 : 0;
        const indValues = rendererRef.current?.getIndicatorValuesAt(index) ?? {};

        return (
          <div className="absolute top-4 left-4 bg-[var(--surface)]/95 backdrop-blur-md rounded-2xl p-4 text-sm shadow-xl border border-[var(--border)] min-w-[200px]">
            <div className="text-[var(--text-muted)] mb-3 font-medium">{formatDate(d.date)}</div>

            {/* OHLCV */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-6">
                <span className="text-[var(--text-secondary)]">开盘</span>
                <span className="font-mono font-medium">{d.open.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-[var(--text-secondary)]">最高</span>
                <span className="font-mono font-medium text-[var(--up-color)]">{d.high.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-[var(--text-secondary)]">收盘</span>
                <span className="font-mono font-medium">{d.close.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-[var(--text-secondary)]">最低</span>
                <span className="font-mono font-medium text-[var(--down-color)]">{d.low.toFixed(2)}</span>
              </div>
            </div>

            {/* Change */}
            <div className="flex items-center justify-between gap-6 mt-2 pt-2 border-t border-[var(--border-subtle)]">
              <span className="text-[var(--text-secondary)]">涨跌</span>
              <span className={`font-mono font-medium ${change >= 0 ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]'}`}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)} ({change >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
              </span>
            </div>

            <div className="flex items-center justify-between gap-6">
              <span className="text-[var(--text-secondary)]">振幅</span>
              <span className="font-mono font-medium">{amplitude.toFixed(2)}%</span>
            </div>

            {/* Volume + Amount */}
            <div className="flex items-center justify-between gap-6 mt-2 pt-2 border-t border-[var(--border-subtle)]">
              <span className="text-[var(--text-secondary)]">成交量</span>
              <span className="font-mono font-medium">{(d.volume / 10000).toFixed(2)}万</span>
            </div>
            {d.amount !== undefined && (
              <div className="flex items-center justify-between gap-6">
                <span className="text-[var(--text-secondary)]">成交额</span>
                <span className="font-mono font-medium">{formatAmount(d.amount)}</span>
              </div>
            )}

            {/* MA values */}
            {Object.entries(indValues).filter(([k]) => k.startsWith('MA')).length > 0 && (
              <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
                <div className="text-[var(--text-muted)] text-xs mb-1 font-medium">均线</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {Object.entries(indValues).filter(([k]) => k.startsWith('MA')).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4">
                      <span className="text-[var(--text-secondary)] text-xs">{k}</span>
                      <span className="font-mono font-medium text-xs">{v !== null ? (v as number).toFixed(2) : '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MACD */}
            {indValues["DIF"] !== undefined && (
              <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
                <div className="text-[var(--text-muted)] text-xs mb-1 font-medium">MACD</div>
                <div className="grid grid-cols-3 gap-2">
                  {[['DIF', 'DIF'], ['DEA', 'DEA'], ['MACD', 'MACD']].map(([k, label]) => (
                    <div key={k} className="flex flex-col items-center">
                      <span className="text-[var(--text-secondary)] text-xs">{label}</span>
                      <span className="font-mono font-medium text-xs">{(indValues[k] as number | null)?.toFixed(3) ?? '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* KDJ */}
            {indValues["K"] !== undefined && (
              <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
                <div className="text-[var(--text-muted)] text-xs mb-1 font-medium">KDJ</div>
                <div className="grid grid-cols-3 gap-2">
                  {[['K', 'K'], ['D', 'D'], ['J', 'J']].map(([k, label]) => (
                    <div key={k} className="flex flex-col items-center">
                      <span className="text-[var(--text-secondary)] text-xs">{label}</span>
                      <span className="font-mono font-medium text-xs">{(indValues[k] as number | null)?.toFixed(2) ?? '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* RSI */}
            {indValues["RSI"] !== undefined && (
              <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
                <div className="text-[var(--text-muted)] text-xs mb-1 font-medium">RSI</div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--text-secondary)] text-xs">RSI(14)</span>
                  <span className="font-mono font-medium text-xs">{(indValues["RSI"] as number | null)?.toFixed(2) ?? '-'}</span>
                </div>
              </div>
            )}

            {/* BOLL */}
            {indValues["BOLL-M"] !== undefined && (
              <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
                <div className="text-[var(--text-muted)] text-xs mb-1 font-medium">布林带</div>
                <div className="grid grid-cols-3 gap-2">
                  {[['BOLL-U', 'U'], ['BOLL-M', 'M'], ['BOLL-L', 'L']].map(([k, label]) => (
                    <div key={k} className="flex flex-col items-center">
                      <span className="text-[var(--text-secondary)] text-xs">{label}</span>
                      <span className="font-mono font-medium text-xs">{(indValues[k] as number | null)?.toFixed(2) ?? '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
