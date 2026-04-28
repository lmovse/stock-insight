"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

interface Run {
  id: string;
  status: string;
  createdAt: string;
  strategy: { name: string };
  stockCodes: string;
  startDate: string;
  endDate: string;
}

interface RunDetail {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  stockCodes: string;
  strategy: { name: string; prompt: { name: string; content: string } };
  results: { stockCode: string; result: string; reason: string | null }[];
  startedAt: string | null;
  finishedAt: string | null;
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

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [stockNames, setStockNames] = useState<Record<string, string>>({});

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

  const handleViewDetail = async (runId: string) => {
    setSelectedRunId(runId);
    setDetailLoading(true);
    setRunDetail(null);
    try {
      const res = await fetch(`/api/strategy-runs/${runId}`);
      if (res.ok) {
        const data = await res.json();
        setRunDetail(data);
        // Fetch stock names
        const codes = data.results?.map((r: { stockCode: string }) => r.stockCode) || [];
        const names: Record<string, string> = {};
        await Promise.all(
          codes.map(async (code: string) => {
            if (!names[code]) {
              try {
                const r = await fetch(`/api/stocks/${code}`);
                if (r.ok) {
                  const info = await r.json();
                  names[code] = info.name || code;
                }
              } catch {}
            }
          })
        );
        setStockNames(names);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedRunId(null);
    setRunDetail(null);
    setStockNames({});
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
            className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
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
        <div className="glass-card rounded-xl flex-1 overflow-hidden flex flex-col">
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
                          <button
                            onClick={() => handleViewDetail(run.id)}
                            className="text-xs text-[var(--accent)] hover:underline"
                          >
                            查看详情
                          </button>
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
      </div>

      {/* Detail Modal */}
      {selectedRunId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={closeDetail}
        >
          <div
            className="glass-card rounded-2xl w-full max-w-2xl max-h-[80dvh] flex flex-col overflow-hidden animate-dialog-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">运行详情</h2>
              <button
                onClick={closeDetail}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12 gap-3">
                  <div className="w-6 h-6 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                  <span className="text-sm text-[var(--text-muted)]">加载中...</span>
                </div>
              ) : runDetail ? (
                <>
                  <div className="flex gap-4 mb-4">
                    <span className="text-green-400 text-sm">
                      符合: {runDetail.results.filter((r) => r.result === "符合").length}
                    </span>
                    <span className="text-yellow-400 text-sm">
                      不符合: {runDetail.results.filter((r) => r.result === "不符合").length}
                    </span>
                    <span className="text-red-400 text-sm">
                      错误: {runDetail.results.filter((r) => r.result === "错误").length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {runDetail.results.map((r, i) => (
                      <div key={i} className="result-item flex flex-wrap gap-2 p-3 rounded-lg bg-[var(--background)]">
                        <span className="font-mono text-xs shrink-0 text-[var(--text-primary)]">{stockNames[r.stockCode] || r.stockCode}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                          r.result === "符合" ? "bg-green-500/20 text-green-400" :
                          r.result === "不符合" ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-red-500/20 text-red-400"
                        }`}>
                          {r.result}
                        </span>
                        <div className="w-full text-xs text-[var(--text-muted)] leading-relaxed prose">
                          {r.reason ? (
                            <ReactMarkdown>{r.reason}</ReactMarkdown>
                          ) : "无"}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--text-muted)] text-center py-8">加载失败</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
