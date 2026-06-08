"use client";

interface DataConfig {
  open: boolean;
  high: boolean;
  low: boolean;
  close: boolean;
  volume: boolean;
}

export default function DataConfigSelector({
  value,
  onChange,
}: {
  value: DataConfig;
  onChange: (config: DataConfig) => void;
}) {
  const fields: { key: keyof DataConfig; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "high", label: "High" },
    { key: "low", label: "Low" },
    { key: "close", label: "Close" },
    { key: "volume", label: "Volume" },
  ];

  return (
    <div>
      <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium mb-3 block">
        数据配置
      </label>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {fields.map((f) => (
          <label key={f.key} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={value[f.key]}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.checked })}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${value[f.key] ? "bg-[var(--accent)] border-[var(--accent)]" : "bg-transparent border-[var(--border)]"}`}>
              {value[f.key] && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{f.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
