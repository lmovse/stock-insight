"use client";

import { useState } from "react";

interface StockConfig {
  id: string;
  stockCode: string;
  enabled: boolean;
  stockBasic?: { name: string } | null;
}

interface Props {
  configs: StockConfig[];
  onRefresh: () => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (ids: string[]) => void;
  onBatchToggle: (ids: string[], enabled: boolean) => void;
}

export default function StockConfigTable({
  configs,
  onRefresh,
  onToggle,
  onDelete,
  onBatchToggle,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filtered = configs.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.stockCode.toLowerCase().includes(q) ||
      c.stockBasic?.name?.toLowerCase().includes(q)
    );
  });

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`确定删除选中的 ${selected.size} 个配置？`)) return;
    await onDelete(Array.from(selected));
    setSelected(new Set());
    onRefresh();
  };

  const handleBatchToggle = async (enabled: boolean) => {
    if (selected.size === 0) return;
    await onBatchToggle(Array.from(selected), enabled);
    setSelected(new Set());
    onRefresh();
  };

  return (
    <div className="glass-card rounded-xl flex-1 flex flex-col mx-4 my-4">
      {/* 搜索操作栏 */}
      <div className="shrink-0 flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索股票代码/名称..."
          className="px-3 py-2 text-sm rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] w-40"
        />
        {selected.size > 0 && (
          <>
            <span className="text-xs text-[var(--text-muted)]">已选 {selected.size}</span>
            <button
              onClick={() => handleBatchToggle(true)}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              批量启用
            </button>
            <button
              onClick={() => handleBatchToggle(false)}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              批量停用
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-3 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              批量删除
            </button>
          </>
        )}
      </div>

      {/* 表格 */}
      <div className="overflow-auto flex-1 max-h-[calc(100dvh-220px)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10" style={{ background: 'var(--surface-solid)' }}>
            <tr className="border-b border-[var(--border)]">
              <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">股票代码</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">股票名称</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">状态</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8">
                  <span className="text-sm text-[var(--text-muted)]">暂无数据</span>
                </td>
              </tr>
            ) : (
              filtered.map((config) => (
                <tr
                  key={config.id}
                  className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(config.id)}
                      onChange={() => toggleOne(config.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--text-primary)]">{config.stockCode}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{config.stockBasic?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onToggle(config.id, !config.enabled)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          onToggle(config.id, !config.enabled);
                        }
                      }}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        config.enabled ? "bg-[var(--up-color)]" : "bg-[var(--text-muted)]"
                      }`}
                      role="switch"
                      aria-checked={config.enabled}
                      tabIndex={0}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          config.enabled ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={async () => {
                        if (!confirm("确定删除？")) return;
                        await onDelete([config.id]);
                        onRefresh();
                      }}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
