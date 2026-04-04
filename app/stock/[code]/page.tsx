"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import HQChart from "@/components/HQChart";
import IndicatorPanel from "@/components/IndicatorPanel";
import { calcMA } from "@/lib/indicators";
import type { KLineData, IndicatorConfig, StockInfo } from "@/lib/types";

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
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<IndicatorConfig>(defaultIndicators);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!code) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/stocks/${code}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/stocks/${code}/kline?period=${period}&count=300`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
    ]).then(([info, kline]) => {
      if (info) setStockInfo(info);
      setKlineData(kline);
      setLoading(false);
    }).catch((e) => {
      console.error(`[StockPage] Failed to load ${code}:`, e);
      setLoading(false);
    });
  }, [code, period]);

  const lastData = klineData.length > 0 ? klineData[klineData.length - 1] : null;
  const prevData = klineData.length > 1 ? klineData[klineData.length - 2] : null;
  const priceChange = lastData && prevData ? lastData.close - prevData.close : 0;
  const pricePercent = lastData && prevData && prevData.close !== 0
    ? ((lastData.close - prevData.close) / prevData.close * 100).toFixed(2)
    : '0.00';
  const isUp = priceChange >= 0;

  // Selected candle data for info panels
  const displayIndex = selectedIndex ?? (klineData.length - 1);
  const displayData = displayIndex >= 0 && displayIndex < klineData.length ? klineData[displayIndex] : null;
  const displayPrev = displayIndex > 0 ? klineData[displayIndex - 1] : null;
  const displayChange = displayData && displayPrev ? displayData.close - displayPrev.close : 0;
  const displayChangePct = displayPrev && displayPrev.close !== 0 ? (displayChange / displayPrev.close) * 100 : 0;
  const displayAmplitude = displayPrev && displayPrev.close !== 0 ? ((displayData!.high - displayData!.low) / displayPrev.close) * 100 : 0;
  const displayIsUp = displayChange >= 0;

  // MA values for display candle
  const maValues = useMemo(() => {
    if (!klineData.length || !displayData) return { MA5: null, MA10: null, MA20: null, MA60: null };
    const ma5 = calcMA(klineData, 5);
    const ma10 = calcMA(klineData, 10);
    const ma20 = calcMA(klineData, 20);
    const ma60 = calcMA(klineData, 60);
    return {
      MA5: ma5[displayIndex],
      MA10: ma10[displayIndex],
      MA20: ma20[displayIndex],
      MA60: ma60[displayIndex],
    };
  }, [klineData, displayIndex]);

  const formatAmount = (v: number) => {
    if (v >= 100000000) return (v / 100000000).toFixed(2) + "亿";
    if (v >= 10000) return (v / 10000).toFixed(2) + "万";
    return v.toFixed(2);
  };

  return (
    <div className="flex flex-col bg-[var(--background)] animate-page-enter" style={{ height: 'calc(100dvh - 52px)' }}>

      {/* Stock info strip - sticky */}
      <div className="info-strip shrink-0 px-3 sm:px-5 py-3 relative sticky top-0 z-10 bg-[var(--background)]">
        {/* Left accent bar */}
        <div className="accent-bar absolute left-0 top-3 bottom-3" />

        <div className="flex flex-wrap items-center gap-3 sm:gap-5 pl-3">
          {/* Stock name */}
          <div>
            <div className="text-sm font-bold text-[var(--text-primary)] leading-tight">
              {stockInfo?.name || code}
            </div>
            <div className="text-xs text-[var(--text-muted)] font-mono hidden sm:block">{code}</div>
          </div>

          <div className="w-px h-6 sm:h-8 bg-[var(--border)] hidden sm:block" />

          {/* Price + change */}
          <div className="flex items-baseline gap-2 sm:gap-3">
            <span className={`text-xl sm:text-2xl font-bold font-mono ${isUp ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]'}`}>
              {lastData?.close.toFixed(2) || '--'}
            </span>
            <span className={`text-xs sm:text-sm font-semibold px-1.5 sm:px-2 py-0.5 rounded-lg font-mono ${isUp ? 'badge-up' : 'badge-down'}`}>
              {isUp ? '+' : ''}{priceChange.toFixed(2)} ({isUp ? '+' : ''}{pricePercent}%)
            </span>
          </div>

          <div className="w-px h-6 sm:h-8 bg-[var(--border)] hidden sm:block" />

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-1 w-full sm:w-auto">
            {[
              { label: '开盘', value: lastData?.open.toFixed(2) },
              { label: '最高', value: lastData?.high.toFixed(2) },
              { label: '最低', value: lastData?.low.toFixed(2) },
              { label: '成交量', value: lastData?.volume ? (lastData.volume / 1000000).toFixed(2) + '万' : '--' },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col">
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">{label}</span>
                <span className="text-xs font-semibold font-mono text-[var(--text-secondary)]">{value || '--'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main area */}
      <main className="flex-1 flex flex-col min-h-0 p-4 gap-3 overflow-y-auto">
        {/* Chart */}
        <div className="flex-1 rounded-2xl overflow-hidden flex flex-col min-h-[200px]"
          style={{ background: 'var(--surface-solid, var(--surface))', border: '1px solid var(--border-subtle)' }}
        >
          {/* Period selector */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-subtle)] shrink-0">
            {(["daily", "weekly", "monthly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-mono uppercase tracking-wide border transition-colors rounded-lg ${
                  period === p
                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                    : "bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]"
                }`}
              >
                {p === "daily" ? "日K" : p === "weekly" ? "周K" : "月K"}
              </button>
            ))}
          </div>

          {/* OHLCV info panel */}
          {displayData && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-4 gap-y-1 px-4 py-2 border-b border-[var(--border-subtle)] shrink-0">
              {[
                { label: '开盘', value: displayData.open.toFixed(2), color: '' },
                { label: '最高', value: displayData.high.toFixed(2), color: 'var(--up-color)' },
                { label: '收盘', value: displayData.close.toFixed(2), color: '' },
                { label: '最低', value: displayData.low.toFixed(2), color: 'var(--down-color)' },
                { label: '涨跌', value: `${displayIsUp ? '+' : ''}${displayChange.toFixed(2)}`, color: displayIsUp ? 'var(--up-color)' : 'var(--down-color)' },
                { label: '振幅', value: `${displayAmplitude.toFixed(2)}%`, color: '' },
                { label: '成交量', value: `${(displayData.volume / 10000).toFixed(2)}万`, color: '' },
                { label: '成交额', value: formatAmount(displayData.amount ?? 0), color: '' },
                { label: '日期', value: `${String(displayData.date).slice(4, 6)}/${String(displayData.date).slice(6, 8)}`, color: '' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
                  <span className="text-xs font-mono font-medium" style={{ color: color || 'var(--text-primary)' }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* MA info panel */}
          {indicators.ma && (
            <div className="flex items-center gap-4 px-4 py-2 shrink-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider shrink-0">均线</span>
              {indicators.maPeriods.includes(5) && (
                <span className="text-xs font-mono shrink-0">
                  <span style={{ color: '#bbbbbb' }}>MA5</span>
                  <span className="ml-1" style={{ color: '#bbbbbb' }}>{maValues.MA5?.toFixed(2) ?? '-'}</span>
                </span>
              )}
              {indicators.maPeriods.includes(10) && (
                <span className="text-xs font-mono shrink-0">
                  <span style={{ color: '#d4a017' }}>MA10</span>
                  <span className="ml-1" style={{ color: '#d4a017' }}>{maValues.MA10?.toFixed(2) ?? '-'}</span>
                </span>
              )}
              {indicators.maPeriods.includes(20) && (
                <span className="text-xs font-mono shrink-0">
                  <span style={{ color: '#9333ea' }}>MA20</span>
                  <span className="ml-1" style={{ color: '#9333ea' }}>{maValues.MA20?.toFixed(2) ?? '-'}</span>
                </span>
              )}
              {indicators.maPeriods.includes(60) && (
                <span className="text-xs font-mono shrink-0">
                  <span style={{ color: '#c2410c' }}>MA60</span>
                  <span className="ml-1" style={{ color: '#c2410c' }}>{maValues.MA60?.toFixed(2) ?? '-'}</span>
                </span>
              )}
            </div>
          )}
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-9 h-9 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                <span className="text-sm text-[var(--text-muted)]">加载中 {code}...</span>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-[var(--text-muted)]">
              错误: {error}
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <HQChart code={code} klineData={klineData} indicators={indicators} onCrosshairMove={(info) => setSelectedIndex(info ? info.index : null)} />
            </div>
          )}
        </div>

        {/* Indicator bar */}
        <div className="shrink-0 glass-card rounded-xl px-4 py-3 max-h-[120px] overflow-y-auto">
          <IndicatorPanel config={indicators} onChange={setIndicators} />
        </div>
      </main>
    </div>
  );
}
