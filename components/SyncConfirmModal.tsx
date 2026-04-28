"use client";

import { useState } from "react";

interface Props {
  cutoffDate: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export default function SyncConfirmModal({ cutoffDate, onConfirm, onClose }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "暂无数据";
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return `${year}-${month}-${day}`;
  };

  const handleConfirm = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/stocks/sync", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "同步失败");
      }
      onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-dialog-enter">
      <div className="w-80 rounded-xl shadow-lg border overflow-hidden" style={{ background: 'var(--surface-solid)', borderColor: 'var(--border)', animation: 'none' }}>
        <div className="p-4">
          <h3 className="text-sm font-mono font-bold text-[var(--text-primary)] mb-4">
            同步股票数据
          </h3>

          <div className="mb-4">
            <p className="text-xs text-[var(--text-muted)] mb-1">
              当前数据库股票数据截止日期
            </p>
            <p className="text-lg font-mono" style={{ color: 'var(--accent)' }}>
              {formatDate(cutoffDate)}
            </p>
          </div>

          <p className="text-xs text-[var(--text-muted)] mb-4">
            确定要同步股票数据至最新吗？这可能需要几分钟时间。
          </p>

          {error && (
            <p className="text-xs mb-3" style={{ color: 'var(--down-color)' }}>{error}</p>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleConfirm}
              disabled={syncing}
              className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 pill-active"
            >
              {syncing ? "同步中..." : "确定同步"}
            </button>
            <button
              onClick={onClose}
              disabled={syncing}
              className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 pill-inactive"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
