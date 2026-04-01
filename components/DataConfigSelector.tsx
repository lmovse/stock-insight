"use client";

interface DataConfig {
  kline: boolean;
}

export default function DataConfigSelector({
  value,
  onChange,
}: {
  value: DataConfig;
  onChange: (config: DataConfig) => void;
}) {
  return (
    <div>
      <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium mb-3 block">
        数据配置
      </label>
      <label className="flex items-center gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={value.kline}
          onChange={(e) => onChange({ ...value, kline: e.target.checked })}
          className="sr-only"
        />
        <div className={`w-10 h-5 rounded-full transition-colors relative ${value.kline ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value.kline ? "translate-x-5" : "translate-x-0.5"}`} />
        </div>
        <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">K 线数据（OHLCV）</span>
      </label>
    </div>
  );
}
