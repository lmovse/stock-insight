"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Run {
  id: string;
  status: string;
  createdAt: string;
  strategy: { name: string };
  stockCodes: string;
  startDate: string;
  endDate: string;
}

const PAGE_SIZE = 10;

export default function StrategyRunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [stockCodeSearch, setStockCodeSearch] = useState("");
  const [strategyNameSearch, setStrategyNameSearch] = useState("");
  const [strategies, setStrategies] = useState<{ id: string; name: string }[]>([]);

  const fetchRuns = useCallback(() => {
    setLoading(true);
    const offset = page * PAGE_SIZE;
    let url = `/api/strategy-runs?limit=${PAGE_SIZE}&offset=${offset}`;
    if (stockCodeSearch) url += `&stockCode=${encodeURIComponent(stockCodeSearch)}`;
    if (strategyNameSearch) url += `&strategyName=${encodeURIComponent(strategyNameSearch)}`;

    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.runs)) {
          setRuns(d.runs);
          setTotal(d.total || 0);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, stockCodeSearch, strategyNameSearch]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    fetch("/api/strategies")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setStrategies(data); })
      .catch(() => {});
  }, []);

  const handleSearch = () => {
    setPage(0);
    fetchRuns();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: "bg-green-500/20 text-green-400",
      running: "bg-blue-500/20 text-blue-400",
      cancelled: "bg-gray-500/20 text-gray-400",
      failed: "bg-red-500/20 text-red-400",
      pending: "bg-yellow-500/20 text-yellow-400",
    };
    const labels: Record<string, string> = {
      completed: "已完成",
      running: "运行中",
      cancelled: "已取消",
      failed: "失败",
      pending: "等待中",
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status] || "bg-gray-500/20 text-gray-400"}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="h-[calc(100dvh-52px)] flex flex-col bg-[var(--background)] overflow-hidden p-4 animate-page-enter">
      <div className="mb-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">运行历史</h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">共 {total} 条记录</p>
          </div>
          <Link
            href="/strategies"
            className="px-3 py-1.5 text-sm rounded-lg pill-active text-center"
          >
            返回策略
          </Link>
        </div>
      </div>

      <div className="mb-4 shrink-0 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="搜索股票代码"
          value={stockCodeSearch}
          onChange={(e) => setStockCodeSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="px-3 py-2 text-sm rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] w-40"
        />
        <select
          value={strategyNameSearch}
          onChange={(e) => setStrategyNameSearch(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] w-40"
        >
          <option value="">全部策略</option>
          {strategies.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
        <button
          onClick={handleSearch}
          className="px-4 py-2 text-sm rounded-lg pill-active"
        >
          查询
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Desktop: Table view */}
        <div className="hidden md:block glass-card rounded-xl flex-1 overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10" style={{ background: 'var(--surface-solid)' }}>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">策略名称</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">股票数量</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">日期区间</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">状态</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">运行时间</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                        <span className="text-sm text-[var(--text-muted)]">加载中...</span>
                      </div>
                    </td>
                  </tr>
                ) : runs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8">
                      <span className="text-sm text-[var(--text-muted)]">暂无运行记录</span>
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => {
                    const stockCodes = JSON.parse(run.stockCodes) as string[];
                    return (
                      <tr key={run.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium text-[var(--text-primary)]">{run.strategy.name}</span>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                          {stockCodes.length} 支
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                          {run.startDate} ~ {run.endDate}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(run.status)}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-muted)] text-xs">
                          {new Date(run.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/strategies/runs/${run.id}`}
                            className="text-xs text-[var(--accent)] hover:underline"
                          >
                            查看详情
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
              <span className="text-xs text-[var(--text-muted)]">
                第 {page + 1} / {totalPages} 页，共 {total} 条
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile: Card view */}
        <div className="md:hidden flex-1 overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2">
              <div className="w-5 h-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
              <span className="text-sm text-[var(--text-muted)]">加载中...</span>
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-sm text-[var(--text-muted)]">暂无运行记录</span>
            </div>
          ) : (
            runs.map((run) => {
              const stockCodes = JSON.parse(run.stockCodes) as string[];
              return (
                <div key={run.id} className="glass-card rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--text-primary)] truncate">{run.strategy.name}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{new Date(run.createdAt).toLocaleString()}</p>
                    </div>
                    {getStatusBadge(run.status)}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                    <span>股票数量: <span className="text-[var(--text-primary)]">{stockCodes.length} 支</span></span>
                    <span>日期: <span className="text-[var(--text-primary)]">{run.startDate} ~ {run.endDate}</span></span>
                  </div>
                  <Link
                    href={`/strategies/runs/${run.id}`}
                    className="block text-center text-xs text-[var(--accent)] hover:underline py-1.5 border border-[var(--border)] rounded-lg hover:border-[var(--accent)] transition-colors"
                  >
                    查看详情
                  </Link>
                </div>
              );
            })
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 pb-4">
              <span className="text-xs text-[var(--text-muted)]">
                第 {page + 1} / {totalPages} 页
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}