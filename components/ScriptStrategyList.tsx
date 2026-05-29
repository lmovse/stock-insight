"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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

export default function ScriptStrategyList() {
  const [strategies, setStrategies] = useState<ScriptStrategy[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [dateError, setDateError] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<ScriptRun | null>(null);
  const [history, setHistory] = useState<ScriptRun[]>([]);
  const [polling, setPolling] = useState(false);
  const pollingRef = useRef(false);
  const selectedStrategyIdRef = useRef(selectedStrategyId);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    selectedStrategyIdRef.current = selectedStrategyId;
  }, [selectedStrategyId]);

  // Clear polling interval when selectedStrategyId changes
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
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
          {currentRun.result && (
            <div className="mb-3">
              <pre className="text-xs text-[var(--text-secondary)] bg-[var(--background)] p-3 rounded-lg overflow-x-auto max-h-64">
                {currentRun.result}
              </pre>
            </div>
          )}
          {currentRun.analysis && (
            <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {currentRun.analysis}
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
          history.map((run) => (
            <div key={run.id} className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    run.status === "completed" ? "bg-green-500/20 text-green-400" :
                    run.status === "failed" ? "bg-red-500/20 text-red-400" :
                    "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {run.status === "completed" ? "完成" :
                     run.status === "failed" ? "失败" : "运行中"}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(run.createdAt).toLocaleString()}
                  </span>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {run.finishedAt ? `耗时 ${Math.round((new Date(run.finishedAt).getTime() - new Date(run.createdAt).getTime()) / 1000)}s` : ""}
                </span>
              </div>
              {run.params && (
                <div className="text-xs text-[var(--text-muted)] mb-2">
                  参数: {run.params}
                </div>
              )}
              {run.error && (
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 mb-2">
                  {run.error}
                </div>
              )}
              {run.result && (
                <pre className="text-xs text-[var(--text-secondary)] bg-[var(--background)] p-2 rounded-lg overflow-x-auto max-h-32">
                  {run.result}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
