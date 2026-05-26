"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface RunResult {
  id: string;
  stockCode: string;
  status: string;
  result: string | null;
  reason: string | null;
}

interface RunDetail {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  stockCodes: string;
  strategy: { name: string; prompt: { name: string; content: string } };
  results: RunResult[];
  startedAt: string | null;
  finishedAt: string | null;
}

interface AILogEntry {
  id: string;
  runId: string;
  stockCode: string;
  messages: { role: string; content: string }[];
  response: string;
  timestamp: number;
}

type FilterTab = "all" | "compliant" | "non-compliant" | "error" | "waiting" | "running";

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [stockNames, setStockNames] = useState<Record<string, string>>({});
  const [selectedReason, setSelectedReason] = useState<{ code: string; name: string; reason: string } | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [showAILogs, setShowAILogs] = useState(false);
  const [aiLogs, setAILogs] = useState<AILogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<AILogEntry | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchRun = useCallback(async (id: string, currentStockNames: Record<string, string>) => {
    try {
      const res = await fetch(`/api/strategy-runs/${id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setRun(data);

      const codes = data.results?.map((r: RunResult) => r.stockCode) || [];
      const newNames = { ...currentStockNames };
      await Promise.all(
        codes.map(async (code: string) => {
          if (!newNames[code]) {
            try {
              const r = await fetch(`/api/stocks/${code}`);
              if (r.ok) {
                const info = await r.json();
                newNames[code] = info.name || code;
              }
            } catch {}
          }
        })
      );
      setStockNames(newNames);
    } catch (err) {
      console.error("Failed to fetch run:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAILogs = useCallback(async (id: string) => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/ai-logs?runId=${id}`);
      const data = await res.json();
      setAILogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch AI logs:", err);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    params.then(({ id }) => {
      setRunId(id);
      setLoading(true);
      setStockNames({});
      fetchRun(id, {});
    });
  }, [params, fetchRun]);

  useEffect(() => {
    if (!runId || !run) return;
    if (run.status !== "running") return;

    const interval = setInterval(() => {
      fetchRun(runId, stockNames);
    }, 3000);

    return () => clearInterval(interval);
  }, [runId, run, fetchRun, stockNames]);

  const openAILogs = async () => {
    if (runId) {
      await fetchAILogs(runId);
      setShowAILogs(true);
    }
  };

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
  const getStatus = (r: RunResult) => r.status || "waiting";
  const compliantCount = run.results.filter((r) => getStatus(r) === "compliant").length;
  const nonCompliantCount = run.results.filter((r) => getStatus(r) === "non-compliant").length;
  const errorCount = run.results.filter((r) => getStatus(r) === "error").length;
  const waitingCount = run.results.filter((r) => ["waiting", ""].includes(getStatus(r)) || !r.status).length;
  const runningCount = run.results.filter((r) => getStatus(r) === "running").length;

  const filteredResults = run.results.filter((r) => {
    const status = getStatus(r);
    if (filterTab === "all") return true;
    if (filterTab === "compliant") return status === "compliant";
    if (filterTab === "non-compliant") return status === "non-compliant";
    if (filterTab === "error") return status === "error";
    if (filterTab === "waiting") return status === "waiting" || status === "" || !r.status;
    if (filterTab === "running") return status === "running";
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

  const getResultBadge = (r: RunResult) => {
    const status = r.status || "waiting";
    if (status === "waiting") {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">等待中</span>;
    }
    if (status === "running") {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">运行中</span>;
    }
    const result = r.result || "";
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full ${
          result === "符合"
            ? "bg-green-500/20 text-green-400"
            : result === "不符合"
            ? "bg-yellow-500/20 text-yellow-400"
            : "bg-red-500/20 text-red-400"
        }`}
      >
        {result}
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
            {run.status === "running" && (
              <span className="text-xs text-[var(--text-muted)] animate-pulse">自动刷新中</span>
            )}
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
          <button
            onClick={openAILogs}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            AI 日志
          </button>
        </div>
      </div>

      {/* Summary tabs */}
      <div className="shrink-0 px-4 py-2">
        <div className="flex gap-1 flex-wrap">
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
            onClick={() => setFilterTab("waiting")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterTab === "waiting"
                ? "bg-gray-500/20 text-gray-400"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            等待中 ({waitingCount})
          </button>
          <button
            onClick={() => setFilterTab("running")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterTab === "running"
                ? "bg-blue-500/20 text-blue-400"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            运行中 ({runningCount})
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
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">状态</th>
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
                  filteredResults.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="px-4 py-3 font-mono text-[var(--text-primary)]">{r.stockCode}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{stockNames[r.stockCode] || "-"}</td>
                      <td className="px-4 py-3">{getResultBadge(r)}</td>
                      <td className="px-4 py-3">
                        {r.reason ? (
                          <button
                            onClick={() => { const reason = r.reason; if (reason) setSelectedReason({ code: r.stockCode, name: stockNames[r.stockCode] || r.stockCode, reason }); }}
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
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedReason.reason}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Logs modal */}
      {showAILogs && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowAILogs(false)}
        >
          <div
            className="glass-card rounded-2xl w-full max-w-4xl max-h-[85dvh] flex flex-col overflow-hidden animate-dialog-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">AI 日志</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">共 {aiLogs.length} 条记录</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => runId && fetchAILogs(runId)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-white/5 transition-colors"
                >
                  刷新
                </button>
                <button
                  onClick={() => setShowAILogs(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden flex min-h-0">
              {/* Log list */}
              <div className="w-1/3 border-r border-[var(--border)] overflow-y-auto">
                {logsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="w-5 h-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                  </div>
                ) : aiLogs.length === 0 ? (
                  <div className="flex items-center justify-center h-32">
                    <span className="text-sm text-[var(--text-muted)]">暂无日志</span>
                  </div>
                ) : (
                  aiLogs.map((log) => (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`px-4 py-3 border-b border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors ${
                        selectedLog?.id === log.id ? "bg-[var(--surface-hover)]" : ""
                      }`}
                    >
                      <div className="text-xs font-mono text-[var(--text-primary)]">{log.stockCode}</div>
                      <div className="text-xs text-[var(--text-muted)] mt-1">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* Log detail */}
              <div className="w-2/3 overflow-y-auto p-4">
                {selectedLog ? (
                  <div className="space-y-4">
                    <div className="text-xs text-[var(--text-muted)]">
                      {selectedLog.stockCode} · {new Date(selectedLog.timestamp).toLocaleString()}
                    </div>
                    <div>
                      <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">请求</h3>
                      <div className="space-y-2">
                        {selectedLog.messages.map((msg, idx) => (
                          <div key={idx} className="text-xs">
                            <span className="text-[var(--accent)] font-medium">{msg.role}:</span>
                            <pre className="mt-1 p-2 rounded bg-[var(--background)] text-[var(--text-secondary)] whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                              {msg.content}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">响应</h3>
                      <pre className="p-2 rounded bg-[var(--background)] text-[var(--text-secondary)] whitespace-pre-wrap break-all text-xs max-h-64 overflow-y-auto">
                        {selectedLog.response}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-sm text-[var(--text-muted)]">点击左侧日志查看详情</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}