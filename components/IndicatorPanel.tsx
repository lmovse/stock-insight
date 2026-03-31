"use client";

import { useState } from "react";
import type { IndicatorConfig } from "@/lib/types";
import IndicatorModal, { type IndicatorParams } from "./IndicatorModal";

interface Props {
  config: IndicatorConfig;
  onChange: (c: IndicatorConfig) => void;
}

export default function IndicatorPanel({ config, onChange }: Props) {
  const [modalIndicator, setModalIndicator] = useState<string | null>(null);

  const toggle = (key: keyof IndicatorConfig) => {
    onChange({ ...config, [key]: !config[key as keyof IndicatorConfig] });
  };

  const handleIndicatorClick = (key: string) => {
    setModalIndicator(key);
  };

  const toModalParams = (): IndicatorParams => ({
    ma: config.ma,
    maPeriods: config.maPeriods,
    macd: config.macd,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    kdj: config.kdj,
    kdjK: 9,
    kdjD: 3,
    kdjJ: 3,
    boll: config.boll,
    bollPeriod: 20,
    bollStdDev: 2,
    rsi: config.rsi,
    rsiPeriod: config.rsiPeriod || 14,
  });

  const handleModalSave = (params: IndicatorParams) => {
    if (!modalIndicator) return;
    if (modalIndicator === "MA") {
      onChange({ ...config, maPeriods: params.maPeriods });
    } else if (modalIndicator === "MACD") {
      onChange({ ...config, macd: true });
    } else if (modalIndicator === "KDJ") {
      onChange({ ...config, kdj: true });
    } else if (modalIndicator === "BOLL") {
      onChange({ ...config, boll: true });
    } else if (modalIndicator === "RSI") {
      onChange({ ...config, rsi: true, rsiPeriod: params.rsiPeriod });
    }
  };

  return (
    <>
      <div className="p-3 border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wide mb-3">
          技术指标
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { key: "ma", label: "MA", hasConfig: true },
            { key: "macd", label: "MACD", hasConfig: true },
            { key: "kdj", label: "KDJ", hasConfig: true },
            { key: "boll", label: "BOLL", hasConfig: true },
            { key: "rsi", label: "RSI", hasConfig: true },
          ] as const).map(({ key, label, hasConfig }) => (
            <div key={key} className="relative">
              <button
                type="button"
                aria-pressed={config[key]}
                onClick={() => (hasConfig ? handleIndicatorClick(label) : toggle(key))}
                className={`px-2 py-1 text-xs font-mono border transition-colors ${
                  config[key]
                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                    : "bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]"
                }`}
              >
                {label}
              </button>
            </div>
          ))}
        </div>
      </div>

      {modalIndicator && (
        <IndicatorModal
          indicator={modalIndicator as "MA" | "MACD" | "KDJ" | "BOLL" | "RSI"}
          params={toModalParams()}
          onSave={handleModalSave}
          onClose={() => setModalIndicator(null)}
        />
      )}
    </>
  );
}
