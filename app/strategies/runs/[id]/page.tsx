"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

interface RunResult {
  stockCode: string;
  result: string;
  reason: string | null;
}

interface RunDetail {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  stockCodes: string;
  dataConfig: string;
  strategy: { name: string; prompt: { name: string; content: string } };
  results: RunResult[];
  startedAt: string | null;
  finishedAt: string | null;
}

type FilterTab = "all" | "compliant" | "non-compliant" | "error";

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [stockNames, setStockNames] = useState<Record<string, string>>({});
  const [selectedReason, setSelectedReason] = useState<{ code: string; name: string; reason: string } | null>(null);

  useEffect(() => {
    params.then(async ({ id }: { id: string }) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/strategy-runs/${id}`);
        const data = await res.json();
        setRun(data);

        const codes = data.results?.map((r: RunResult) => r.stockCode) || [];
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
      } finally {
        setLoading(false);
      }
    });
  }, [params]);

  if (loading) {
    return (
      <div className="h-[calc(100dvh-52px)] flex items-center justify-center bg-[var(--background)]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
          <span className="text-sm text-[var(--text-muted)]">加载中...</span>
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="h-[calc(100dvh-52px)] flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <p className="text-sm text-[var(--text-muted)] mb-4">运行记录不存在</p>
          <Link href="/strategies/runs" className="text-xs text-[var(--accent)] hover:underline">
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  const stockCodes = JSON.parse(run.stockCodes) as string[];
  const compliantCount = run.results.filter((r) => r.result === "符合").length;
  const nonCompliantCount = run.results.filter((r) => r.result === "不符合").length;
  const errorCount = run.results.filter((r) => r.result === "错误").length;

  const filteredResults = run.results.filter((r) => {
    if (filterTab === "all") return true;
    if (filterTab === "compliant") return r.result === "符合";
    if (filterTab === "non-compliant") return r.result === "不符合";
    if (filterTab === "error") return r.result === "错误";
    return true;
  });

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
    <div className="h-[calc(100dvh-52px)] flex flex-col bg-[var(--background)] overflow-hidden animate-page-enter">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center gap-3 mb-3">
          <Link
            href="/strategies/runs"
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            ← 返回
          </Link>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{run.strategy.name}</h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {run.startDate} ~ {run.endDate} · {stockCodes.length} 支股票
            </p>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(run.status)}
          </div>
        </div>
      </div>

      {/* Meta info */}
      <div className="shrink-0 px-4 py-3">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
          {run.startedAt && (
            <div>
              <span className="text-[var(--text-muted)]">开始：</span>
              <span className="text-[var(--text-secondary)]">{new Date(run.startedAt).toLocaleString()}</span>
            </div>
          )}
          {run.finishedAt && (
            <div>
              <span className="text-[var(--text-muted)]">结束：</span>
              <span className="text-[var(--text-secondary)]">{new Date(run.finishedAt).toLocaleString()}</span>
            </div>
          )}
          <div>
            <span className="text-[var(--text-muted)]">提示词：</span>
            <span className="text-[var(--text-secondary)]">{run.strategy.prompt.name}</span>
          </div>
        </div>
      </div>

      {/* Summary tabs */}
      <div className="shrink-0 px-4 py-2">
        <div className="flex gap-1">
          <button
            onClick={() => setFilterTab("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterTab === "all"
                ? "bg-accent/20 text-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            全部 ({run.results.length})
          </button>
          <button
            onClick={() => setFilterTab("compliant")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterTab === "compliant"
                ? "bg-green-500/20 text-green-400"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            符合 ({compliantCount})
          </button>
          <button
            onClick={() => setFilterTab("non-compliant")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterTab === "non-compliant"
                ? "bg-yellow-500/20 text-yellow-400"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            不符合 ({nonCompliantCount})
          </button>
          <button
            onClick={() => setFilterTab("error")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterTab === "error"
                ? "bg-red-500/20 text-red-400"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            错误 ({errorCount})
          </button>
        </div>
      </div>

      {/* Results table */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="glass-card rounded-xl flex-1 overflow-hidden flex flex-col mx-4 my-2">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10" style={{ background: 'var(--surface-solid)' }}>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">股票代码</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">股票名称</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">结果</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8">
                      <span className="text-sm text-[var(--text-muted)]">暂无结果</span>
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="px-4 py-3 font-mono text-[var(--text-primary)]">{r.stockCode}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{stockNames[r.stockCode] || "-"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            r.result === "符合"
                              ? "bg-green-500/20 text-green-400"
                              : r.result === "不符合"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {r.result}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.reason ? (
                          <button
                            onClick={() => setSelectedReason({ code: r.stockCode, name: stockNames[r.stockCode] || r.stockCode, reason: r.reason })}
                            className="text-xs text-[var(--accent)] hover:underline"
                          >
                            查看原因
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reason modal */}
      {selectedReason && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setSelectedReason(null)}
        >
          <div
            className="glass-card rounded-2xl w-full max-w-lg max-h-[80dvh] flex flex-col overflow-hidden animate-dialog-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">原因详情</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{selectedReason.code} · {selectedReason.name}</p>
              </div>
              <button
                onClick={() => setSelectedReason(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="text-sm text-[var(--text-secondary)] leading-relaxed prose max-w-none">
                <ReactMarkdown>{selectedReason.reason}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}