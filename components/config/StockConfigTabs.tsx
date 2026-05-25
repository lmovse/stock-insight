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
    const res = await fetch("/api/config/stocks/batch", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      alert("删除失败");
      return;
    }
    fetchConfigs();
  };

  const handleBatchToggle = async (ids: string[], enabled: boolean) => {
    const res = await fetch("/api/config/stocks/batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, enabled }),
    });
    if (!res.ok) {
      alert("操作失败");
      return;
    }
    fetchConfigs();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-4 pt-4 shrink-0">
        {PURPOSES.map((purpose) => (
          <button
            key={purpose}
            onClick={() => setActiveTab(purpose)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === purpose
                ? "bg-accent/20 text-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            {PURPOSE_LABELS[purpose]}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 text-sm font-semibold rounded-lg pill-active transition-colors self-center"
        >
          添加股票
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 mt-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
              <span className="text-sm text-[var(--text-muted)]">加载中...</span>
            </div>
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
