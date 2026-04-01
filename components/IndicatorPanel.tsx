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

  const indicators = [
    { key: "ma", label: "MA" },
    { key: "macd", label: "MACD" },
    { key: "kdj", label: "KDJ" },
    { key: "boll", label: "BOLL" },
    { key: "rsi", label: "RSI" },
  ] as const;

  return (
    <>
      <div className="flex items-center gap-4">
        <span className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">指标</span>
        <div className="flex items-center gap-2">
          {indicators.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={config[key]}
              onClick={() => toggle(key)}
              onDoubleClick={() => handleIndicatorClick(label)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                config[key]
                  ? "pill-active"
                  : "pill-inactive"
              }`}
            >
              {label}
            </button>
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
