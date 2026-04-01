"use client";
import { useEffect, useState } from "react";
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

export default function StrategyRunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    fetch("/api/strategy-runs?limit=50")
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.runs)) setRuns(d.runs);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">运行历史</h1>
        <Link href="/strategies/run" className="px-4 py-2 border rounded hover:bg-gray-800">
          去运行
        </Link>
      </div>
      <div className="space-y-3">
        {runs.map((run) => {
          const stockCodes = JSON.parse(run.stockCodes) as string[];
          return (
            <Link
              key={run.id}
              href={`/strategies/runs/${run.id}`}
              className="block p-4 border rounded hover:bg-gray-800"
            >
              <div className="flex justify-between">
                <span className="font-medium">{run.strategy.name}</span>
                <span
                  className={`text-sm px-2 py-0.5 rounded ${
                    run.status === "completed"
                      ? "bg-green-900 text-green-300"
                      : run.status === "running"
                      ? "bg-blue-900 text-blue-300"
                      : run.status === "cancelled"
                      ? "bg-gray-700 text-gray-300"
                      : "bg-red-900 text-red-300"
                  }`}
                >
                  {run.status}
                </span>
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {run.startDate} ~ {run.endDate} · {stockCodes.length} 支股票
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(run.createdAt).toLocaleString()}
              </div>
            </Link>
          );
        })}
        {runs.length === 0 && <p className="text-gray-400">暂无运行记录</p>}
      </div>
    </div>
  );
}
