"use client";
import { useEffect, useState } from "react";

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

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [run, setRun] = useState<RunDetail | null>(null);

  useEffect(() => {
    params.then(({ id }: { id: string }) => {
      fetch(`/api/strategy-runs/${id}`)
        .then((r) => r.json())
        .then(setRun);
    });
  }, [params]);

  if (!run) return <div className="p-6">加载中...</div>;

  const stockCodes = JSON.parse(run.stockCodes) as string[];
  const compliant = run.results.filter((r) => r.result === "符合").length;
  const nonCompliant = run.results.filter((r) => r.result === "不符合").length;
  const errors = run.results.filter((r) => r.result === "错误").length;

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">{run.strategy.name}</h1>

      {/* Meta info */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <span className="text-gray-400">日期区间：</span>
          {run.startDate} ~ {run.endDate}
        </div>
        <div>
          <span className="text-gray-400">股票数量：</span>
          {stockCodes.length}
        </div>
        <div>
          <span className="text-gray-400">提示词：</span>
          {run.strategy.prompt.name}
        </div>
        <div>
          <span className="text-gray-400">状态：</span>
          {run.status}
        </div>
        {run.startedAt && (
          <div>
            <span className="text-gray-400">开始时间：</span>
            {new Date(run.startedAt).toLocaleString()}
          </div>
        )}
        {run.finishedAt && (
          <div>
            <span className="text-gray-400">结束时间：</span>
            {new Date(run.finishedAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="flex gap-4 mb-6">
        <span className="text-green-400">符合: {compliant}</span>
        <span className="text-yellow-400">不符合: {nonCompliant}</span>
        <span className="text-red-400">错误: {errors}</span>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {run.results.map((r, i) => (
          <div key={i} className="p-4 border rounded">
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium">{r.stockCode}</span>
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
            <p className="text-sm text-gray-300 mt-2">{r.reason ?? "无"}</p>
          </div>
        ))}
        {run.results.length === 0 && <p className="text-gray-400">暂无结果</p>}
      </div>
    </div>
  );
}
