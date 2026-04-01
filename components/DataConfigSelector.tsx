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
      <label className="block text-sm mb-1">数据配置</label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.kline}
          onChange={(e) => onChange({ ...value, kline: e.target.checked })}
        />
        <span>K 线数据（OHLCV）</span>
      </label>
    </div>
  );
}
