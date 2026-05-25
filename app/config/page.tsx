"use client";

import StockConfigTabs from "@/components/config/StockConfigTabs";

export default function ConfigPage() {
  return (
    <div className="h-[calc(100dvh-52px)] flex flex-col bg-[var(--background)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] shrink-0">
        <h1 className="text-lg font-bold text-[var(--text-primary)]">系统配置</h1>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">管理股票分类配置</p>
      </div>

      {/* Tabs */}
      <div className="flex-1 min-h-0">
        <StockConfigTabs />
      </div>
    </div>
  );
}
