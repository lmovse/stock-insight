"use client";

import { useState, useEffect, useCallback } from "react";
import StockConfigTable from "./StockConfigTable";
import StockConfigOperateModal from "./StockConfigOperateModal";

interface StockConfig {
  id: string;
  stockCode: string;
  enabled: boolean;
  stockBasic?: { name: string } | null;
}

const PURPOSES = ["FIFTEEN_MIN", "DAILY", "REALTIME"] as const;
const PURPOSE_LABELS: Record<string, string> = {
  FIFTEEN_MIN: "15分钟线",
  DAILY: "日线",
  REALTIME: "实时",
};

export default function StockConfigTabs() {
  const [activeTab, setActiveTab] = useState<string>(PURPOSES[0]);
  const [configs, setConfigs] = useState<StockConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/config/stocks?purpose=${activeTab}`);
      const data = await res.json();
      setConfigs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch configs:", e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleToggle = async (id: string, enabled: boolean) => {
    await fetch(`/api/config/stocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    setConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled } : c))
    );
  };

  const handleDelete = async (ids: string[]) => {
    await fetch("/api/config/stocks/batch", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  };

  const handleBatchToggle = async (ids: string[], enabled: boolean) => {
    await fetch("/api/config/stocks/batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, enabled }),
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] px-2 shrink-0">
        {PURPOSES.map((purpose) => (
          <button
            key={purpose}
            onClick={() => setActiveTab(purpose)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === purpose
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {PURPOSE_LABELS[purpose]}
          </button>
        ))}
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-between px-2 py-3 shrink-0">
        <span className="text-xs text-[var(--text-muted)]">
          共 {configs.length} 条配置
        </span>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 text-sm font-semibold rounded-lg pill-active transition-colors"
        >
          添加股票
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
          </div>
        ) : (
          <StockConfigTable
            configs={configs}
            onRefresh={fetchConfigs}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onBatchToggle={handleBatchToggle}
          />
        )}
      </div>

      {/* 添加弹窗 */}
      {showAddModal && (
        <StockConfigOperateModal
          purpose={activeTab}
          purposeLabels={PURPOSE_LABELS}
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchConfigs}
        />
      )}
    </div>
  );
}
