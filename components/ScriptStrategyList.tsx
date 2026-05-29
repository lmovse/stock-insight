"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ScriptStrategy {
  id: string;
  name: string;
  description: string | null;
  scriptPath: string;
  params: string | null;
  createdAt: string;
}

interface ScriptRun {
  id: string;
  scriptStrategyId: string;
  params: string;
  result: string | null;
  analysis: string | null;
  status: string;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

interface HistoryCardProps {
  run: ScriptRun;
  resultData: { count?: number; summary?: string; date?: string } | null;
}

function HistoryCard({ run, resultData }: HistoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  // Parse params for display
  let paramsObj: Record<string, unknown> = {};
  try {
    paramsObj = run.params ? JSON.parse(run.params) : {};
  } catch {
    // ignore
  }

  return (
    <div className="glass-card rounded-xl p-4">
      {/* Header - always visible */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
            run.status === "completed" ? "bg-green-500/20 text-green-400" :
            run.status === "failed" ? "bg-red-500/20 text-red-400" :
            "bg-yellow-500/20 text-yellow-400"
          }`}>
            {run.status === "completed" ? "完成" :
             run.status === "failed" ? "失败" : "运行中"}
          </span>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="text-xs text-[var(--text-primary)]">
              {new Date(run.createdAt).toLocaleString()}
            </span>
            {resultData && (
              <span className="text-xs text-[var(--accent)] font-medium">
                {resultData.count} 个信号
              </span>
            )}
            {paramsObj.date && (
              <span className="text-xs text-[var(--text-muted)]">
                日期: {paramsObj.date}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">
            {run.finishedAt ? `耗时 ${Math.round((new Date(run.finishedAt).getTime() - new Date(run.createdAt).getTime()) / 1000)}s` : ""}
          </span>
          <span className="text-xs text-[var(--text-muted)]">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          {run.error && (
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 mb-3">
              {run.error}
            </div>
          )}

          {run.analysis && (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-[var(--text-muted)] mb-2">AI 分析</h4>
              <div className="text-xs text-[var(--text-secondary)] prose prose-sm max-w-none [&_hr]:border-[var(--border)] [&_hr]:opacity-50">
                {(() => {
                  try {
                    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.analysis}</ReactMarkdown>;
                  } catch {
                    return <pre>{run.analysis}</pre>;
                  }
                })()}
              </div>
            </div>
          )}

          {run.result && (
            <div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRawJson(!showRawJson);
                }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] mb-2 flex items-center gap-1"
              >
                {showRawJson ? "▼" : "▶"} 原始 JSON
              </button>
              {showRawJson && (
                <pre className="text-xs text-[var(--text-secondary)] bg-[var(--background)] p-3 rounded-lg overflow-x-auto max-h-64">
                  {run.result}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ScriptStrategyList() {
  const [strategies, setStrategies] = useState<ScriptStrategy[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [dateError, setDateError] = useState<string>("");
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [running, setRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<ScriptRun | null>(null);
  const [history, setHistory] = useState<ScriptRun[]>([]);
  const [polling, setPolling] = useState(false);
  const pollingRef = useRef(false);
  const selectedStrategyIdRef = useRef(selectedStrategyId);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Memoize parsed result to avoid re-parsing on every render
  const parsedResult = useMemo(() => {
    if (!currentRun?.result) return null;
    try {
      return JSON.parse(currentRun.result);
    } catch {
      return null;
    }
  }, [currentRun?.result]);

  // Keep ref in sync with state
  useEffect(() => {
    selectedStrategyIdRef.current = selectedStrategyId;
  }, [selectedStrategyId]);

  // Clear polling interval when selectedStrategyId changes or component unmounts
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      pollingRef.current = false;
    };
  }, [selectedStrategyId]);

  useEffect(() => {
    fetchStrategies();
  }, []);

  useEffect(() => {
    if (selectedStrategyId) {
      fetchHistory(selectedStrategyId);
    }
  }, [selectedStrategyId]);

  const fetchStrategies = () => {
    const controller = new AbortController();
    fetch("/api/scripts/strategies", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setStrategies(data);
          if (data.length > 0 && !selectedStrategyId) {
            setSelectedStrategyId(data[0].id);
          }
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch strategies:", err);
        }
      });
    return controller;
  };

  const fetchHistory = (strategyId: string) => {
    const controller = new AbortController();
    fetch(`/api/scripts/runs?strategyId=${strategyId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setHistory(data);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch history:", err);
        }
      });
    return controller;
  };

  const pollRunStatus = useCallback((runId: string) => {
    // Prevent multiple simultaneous polls
    if (pollingRef.current) return;
    pollingRef.current = true;
    setPolling(true);
    const currentStrategyId = selectedStrategyIdRef.current;
    intervalRef.current = setInterval(async () => {
      try {
        const controller = new AbortController();
        const res = await fetch(`/api/scripts/runs/${runId}`, { signal: controller.signal });
        const data: ScriptRun = await res.json();
        setCurrentRun(data);
        if (data.status === "completed" || data.status === "failed") {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          pollingRef.current = false;
          setPolling(false);
          setRunning(false);
          const strategyId = selectedStrategyIdRef.current;
          if (strategyId) {
            fetchHistory(strategyId);
          }
        }
      } catch (err) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        pollingRef.current = false;
        setPolling(false);
        setRunning(false);
        console.error("Polling error:", err);
      }
    }, 2000);
  }, []);

  const handleRun = async () => {
    if (!selectedStrategyId || pollingRef.current) return;
    if (!date.trim()) {
      setDateError("请输入日期参数");
      return;
    }
    setDateError("");
    setRunning(true);
    setCurrentRun(null);

    try {
      const controller = new AbortController();
      const res = await fetch(`/api/scripts/strategies/${selectedStrategyId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.runId) {
        pollRunStatus(data.runId);
      } else {
        pollingRef.current = false;
        setRunning(false);
      }
    } catch (err) {
      pollingRef.current = false;
      setRunning(false);
      console.error("Failed to run strategy:", err);
    }
  };

  const selectedStrategy = strategies.find((s) => s.id === selectedStrategyId);

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Controls */}
      <div className="glass-card rounded-xl p-4 shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">选择策略</label>
            <select
              value={selectedStrategyId}
              onChange={(e) => setSelectedStrategyId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)]"
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">日期参数</label>
            <input
              type="text"
              value={date}
              onChange={(e) => { setDate(e.target.value); setDateError(""); }}
              placeholder="YYYYMMDD，如 20250529"
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
            {dateError && (
              <p className="mt-1 text-xs text-red-400">{dateError}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleRun}
          disabled={running || !selectedStrategyId}
          className="px-5 py-2 rounded-lg text-sm font-semibold pill-active disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? (polling ? "运行中..." : "启动中...") : "运行"}
        </button>
      </div>

      {/* Current Run Result */}
      {currentRun && (
        <div className="glass-card rounded-xl p-4 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-[var(--text-primary)]">运行结果</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              currentRun.status === "completed" ? "bg-green-500/20 text-green-400" :
              currentRun.status === "failed" ? "bg-red-500/20 text-red-400" :
              "bg-yellow-500/20 text-yellow-400"
            }`}>
              {currentRun.status === "completed" ? "完成" :
               currentRun.status === "failed" ? "失败" : "运行中"}
            </span>
          </div>
          {currentRun.error && (
            <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {currentRun.error}
            </div>
          )}
          {currentRun.result && parsedResult?.data && (
            <div className="mb-3 text-xs text-[var(--text-secondary)]">
              <h4 className="text-xs font-medium text-[var(--text-muted)] mb-2">信号列表 ({parsedResult.count} 个)</h4>
              <div className="overflow-x-auto max-h-64">
                {(() => {
                  const items = parsedResult.data.slice(0, 50);
                  const md = [
                    "| 代码 | 最低价 | dif变化 | k变化 | 当前价 |",
                    "| --- | --- | --- | --- | --- |",
                    ...items.map((item: Record<string, unknown>) =>
                      `| ${item.tsCode} | ${item.minLow} | +${Number(item.difChange).toFixed(4)} | +${Number(item.kChange).toFixed(2)} | ${item.currentPrice} |`
                    )
                  ].join("\n");
                  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>;
                })()}
              </div>
            </div>
          )}
          {currentRun.analysis && (
            <div>
              <h4 className="text-xs font-medium text-[var(--text-muted)] mb-2">AI 分析</h4>
              <div className="text-xs text-[var(--text-secondary)] leading-relaxed prose prose-sm max-w-none [&_hr]:border-[var(--border)] [&_hr]:opacity-50">
                {(() => {
                  try {
                    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentRun.analysis}</ReactMarkdown>;
                  } catch {
                    return <pre>{currentRun.analysis}</pre>;
                  }
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] shrink-0">运行历史</h3>
        {history.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-[var(--text-muted)]">暂无运行记录</p>
          </div>
        ) : (
          history.map((run) => {
            // Parse result JSON for display
            let resultData: { count?: number; summary?: string; date?: string } | null = null;
            if (run.result) {
              try {
                resultData = JSON.parse(run.result);
              } catch {
                // ignore parse errors
              }
            }
            return (
              <HistoryCard key={run.id} run={run} resultData={resultData} />
            );
          })
        )}
      </div>
    </div>
  );
}
