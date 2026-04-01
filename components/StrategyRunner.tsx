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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dataConfig, setDataConfig] = useState({ kline: true });

  const [status, setStatus] = useState<RunStatus>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0, currentStock: "" });
  const [results, setResults] = useState<RunResult[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/strategies")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setStrategies(data);
        }
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
    <div className="space-y-6">
      {/* Strategy Selection */}
      <div>
        <label className="block text-sm mb-2">选择策略（支持多选，运行将串行执行）</label>
        <div className="flex flex-wrap gap-2">
          {strategies.map((s) => (
            <button
              key={s.id}
              onClick={() => toggleStrategy(s.id)}
              className={`px-3 py-2 border rounded ${
                selectedStrategyIds.includes(s.id)
                  ? "border-accent bg-accent/20"
                  : "border-gray-600"
              }`}
            >
              {s.name}
            </button>
          ))}
          {strategies.length === 0 && <p className="text-gray-400 text-sm">暂无可用策略</p>}
        </div>
      </div>

      {/* Stock Selection */}
      <StockSelector value={stockCodes} onChange={setStockCodes} />

      {/* Date Range */}
      <div className="flex gap-4">
        <div>
          <label className="block text-sm mb-1">开始日期</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="p-2 border rounded bg-background text-foreground"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">结束日期</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="p-2 border rounded bg-background text-foreground"
          />
        </div>
      </div>

      {/* Data Config */}
      <DataConfigSelector value={dataConfig} onChange={setDataConfig} />

      {/* Run / Cancel Button */}
      <div className="flex gap-3">
        {status === "idle" || status === "completed" || status === "cancelled" || status === "failed" ? (
          <button
            onClick={handleRun}
            disabled={selectedStrategyIds.length === 0 || stockCodes.length === 0}
            className="px-6 py-2 bg-accent text-black rounded disabled:opacity-50"
          >
            运行策略
          </button>
        ) : (
          <button
            onClick={handleCancel}
            className="px-6 py-2 bg-red-600 text-white rounded"
          >
            取消运行
          </button>
        )}
        {status !== "idle" && (
          <span className="flex items-center text-sm text-gray-400">
            {status === "running" && `${progress.done}/${progress.total} 完成，当前: ${progress.currentStock}`}
            {status === "starting" && "启动中..."}
            {status === "completed" && "已完成"}
            {status === "cancelled" && "已取消"}
            {status === "failed" && "失败"}
          </span>
        )}
      </div>

      {/* Results */}
      {(results.length > 0 || status === "running") && (
        <div>
          <h3 className="font-medium mb-3">运行结果</h3>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="p-3 border rounded">
                <div className="flex items-center gap-2">
                  <span className="font-mono">{r.stockCode}</span>
                  <span
                    className={`text-sm px-2 py-0.5 rounded ${
                      r.result === "符合"
                        ? "bg-green-900 text-green-300"
                        : r.result === "不符合"
                        ? "bg-yellow-900 text-yellow-300"
                        : "bg-red-900 text-red-300"
                    }`}
                  >
                    {r.result}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">{r.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
