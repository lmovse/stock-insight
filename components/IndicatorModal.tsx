"use client";

import { useState } from "react";

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
