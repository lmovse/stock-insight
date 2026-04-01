"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  prompt: { name: string };
  createdAt: string;
}

export default function StrategyList() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);

  useEffect(() => {
    fetch("/api/strategies")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setStrategies(data);
      })
      .catch(() => {});
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该策略？")) return;
    await fetch(`/api/strategies/${id}`, { method: "DELETE" });
    setStrategies((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">选股策略</h1>
        <div className="flex gap-3">
          <Link href="/strategies/run" className="px-4 py-2 border rounded hover:bg-gray-800">
            运行策略
          </Link>
          <Link href="/strategies/new" className="px-4 py-2 bg-accent text-black rounded">
            新建策略
          </Link>
        </div>
      </div>
      <div className="space-y-3">
        {strategies.map((s) => (
          <div key={s.id} className="p-4 border rounded hover:bg-gray-800">
            <div className="flex justify-between">
              <div>
                <Link href={`/strategies/${s.id}`} className="font-medium hover:underline">
                  {s.name}
                </Link>
                <div className="text-sm text-gray-400 mt-1">
                  提示词: {s.prompt.name} · {s.description ?? "无描述"}
                </div>
              </div>
              <button onClick={() => handleDelete(s.id)} className="text-red-500 text-sm">
                删除
              </button>
            </div>
          </div>
        ))}
        {strategies.length === 0 && <p className="text-gray-400">暂无策略</p>}
      </div>
    </div>
  );
}
