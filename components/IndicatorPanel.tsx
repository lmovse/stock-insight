"use client";

import type { IndicatorConfig } from "@/lib/types";

interface Props {
  config: IndicatorConfig;
  onChange: (c: IndicatorConfig) => void;
}

export default function IndicatorPanel({ config, onChange }: Props) {
  const toggle = (key: keyof IndicatorConfig) => {
    onChange({ ...config, [key]: !config[key as keyof IndicatorConfig] });
  };

  return (
    <div className="p-3 border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wide mb-3">
        Technical Indicators
      </div>
      <div className="flex flex-wrap gap-2">
        {([
          { key: "ma", label: "MA" },
          { key: "macd", label: "MACD" },
          { key: "kdj", label: "KDJ" },
          { key: "boll", label: "BOLL" },
          { key: "rsi", label: "RSI" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={`px-2 py-1 text-xs font-mono border transition-colors ${
              config[key]
                ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                : "bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}