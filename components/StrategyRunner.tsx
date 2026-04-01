"use client";
import { useCallback, useEffect, useState } from "react";
import StockSelector from "./StockSelector";
import DataConfigSelector from "./DataConfigSelector";

interface Strategy {
  id: string;
  name: string;
  prompt: { name: string };
}

interface RunResult {
  stockCode: string;
  result: string;
  reason: string;
}

type RunStatus = "idle" | "starting" | "running" | "completed" | "cancelled" | "failed";

export default function StrategyRunner() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategyIds, setSelectedStrategyIds] = useState<string[]>([]);
  const [stockCodes, setStockCodes] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 5);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [dataConfig, setDataConfig] = useState({ kline: true });

  const [status, setStatus] = useState<RunStatus>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0, currentStock: "" });
  const [results, setResults] = useState<RunResult[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/strategies")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setStrategies(data);
      })
      .catch(() => {});
  }, []);

  const handleRun = useCallback(async () => {
    if (!selectedStrategyIds.length || !stockCodes.length || !startDate || !endDate) {
      alert("请填写所有参数");
      return;
    }

    setStatus("starting");
    setResults([]);
    setProgress({ done: 0, total: stockCodes.length * selectedStrategyIds.length, currentStock: "" });

    const strategyId = selectedStrategyIds[0];

    const runRes = await fetch(`/api/strategies/${strategyId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockCodes, startDate, endDate, dataConfig }),
    });

    if (!runRes.ok) {
      setStatus("failed");
      return;
    }

    const { taskId: newTaskId } = await runRes.json();
    setTaskId(newTaskId);
    setStatus("running");

    const eventSource = new EventSource(`/api/strategy-runs/${newTaskId}/stream`);

    eventSource.addEventListener("progress", (e) => {
      setProgress(JSON.parse(e.data));
    });

    eventSource.addEventListener("result", (e) => {
      setResults((prev) => [...prev, JSON.parse(e.data)]);
    });

    eventSource.addEventListener("done", (e) => {
      const data = JSON.parse(e.data);
      setStatus(data.status === "completed" ? "completed" : "cancelled");
      eventSource.close();
    });

    eventSource.addEventListener("error", () => {
      setStatus("failed");
      eventSource.close();
    });
  }, [selectedStrategyIds, stockCodes, startDate, endDate, dataConfig]);

  const handleCancel = useCallback(async () => {
    if (!taskId) return;
    await fetch(`/api/strategy-runs/${taskId}/cancel`, { method: "POST" });
    setStatus("cancelled");
  }, [taskId]);

  const toggleStrategy = (id: string) => {
    setSelectedStrategyIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      {/* 策略选择 */}
      <div className="glass-card rounded-xl p-4">
        <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium mb-3 block">
          选择策略
        </label>
        <div className="flex flex-wrap gap-2">
          {strategies.map((s) => (
            <button
              key={s.id}
              onClick={() => toggleStrategy(s.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                selectedStrategyIds.includes(s.id) ? "pill-active" : "pill-inactive"
              }`}
            >
              {s.name}
            </button>
          ))}
          {strategies.length === 0 && (
            <p className="text-sm text-[var(--text-muted)]">暂无可用策略</p>
          )}
        </div>
      </div>

      {/* 股票选择 */}
      <div className="glass-card rounded-xl p-4">
        <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium mb-3 block">
          选择股票
        </label>
        <StockSelector value={stockCodes} onChange={setStockCodes} />
      </div>

      {/* 日期区间 */}
      <div className="glass-card rounded-xl p-4">
        <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium mb-3 block">
          日期区间
        </label>
        <div className="flex gap-4">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)]"
          />
          <span className="text-[var(--text-muted)] self-center">至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)]"
          />
        </div>
      </div>

      {/* 数据配置 */}
      <div className="glass-card rounded-xl p-4">
        <DataConfigSelector value={dataConfig} onChange={setDataConfig} />
      </div>

      {/* 运行按钮 + 状态 */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-4">
          {status === "idle" || status === "completed" || status === "cancelled" || status === "failed" ? (
            <button
              onClick={handleRun}
              disabled={selectedStrategyIds.length === 0 || stockCodes.length === 0}
              className="px-6 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 pill-active"
            >
              开始运行
            </button>
          ) : (
            <button
              onClick={handleCancel}
              className="px-6 py-2.5 rounded-lg text-sm font-bold bg-red-500 text-white transition-colors"
            >
              取消运行
            </button>
          )}

          {status !== "idle" && (
            <div className="flex-1">
              {status === "running" && (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  <span className="text-sm text-[var(--text-secondary)]">
                    {progress.done}/{progress.total} 完成，当前: {progress.currentStock}
                  </span>
                </div>
              )}
              {status === "starting" && <span className="text-sm text-[var(--text-muted)]">启动中...</span>}
              {status === "completed" && <span className="text-sm text-green-400">已完成</span>}
              {status === "cancelled" && <span className="text-sm text-yellow-400">已取消</span>}
              {status === "failed" && <span className="text-sm text-red-400">失败</span>}
            </div>
          )}
        </div>
      </div>

      {/* 结果 */}
      {results.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium mb-3 block">
            运行结果
          </label>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="result-item flex items-start gap-3 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--background)]">
                <span className="font-mono text-sm shrink-0 text-[var(--text-primary)]">{r.stockCode}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                  r.result === "符合"
                    ? "bg-green-500/20 text-green-400"
                    : r.result === "不符合"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-red-500/20 text-red-400"
                }`}>
                  {r.result}
                </span>
                <span className="text-xs text-[var(--text-muted)] truncate">{r.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
