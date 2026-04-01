"use client";

import { useState, useEffect } from "react";
import StrategyRunner from "@/components/StrategyRunner";
import Link from "next/link";

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  prompt: { name: string };
  createdAt: string;
}

interface Run {
  id: string;
  status: string;
  createdAt: string;
  strategy: { name: string };
  stockCodes: string;
  startDate: string;
  endDate: string;
}

type Tab = "list" | "run" | "history";

export default function StrategiesPage() {
  const [tab, setTab] = useState<Tab>("list");
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPromptId, setNewPromptId] = useState("");
  const [prompts, setPrompts] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchStrategies();
    fetchRuns();
  }, []);

  const fetchStrategies = () => {
    fetch("/api/strategies")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setStrategies(data);
      })
      .catch(() => {});
  };

  const fetchRuns = () => {
    fetch("/api/strategy-runs?limit=20")
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.runs)) setRuns(d.runs);
      })
      .catch(() => {});
  };

  const fetchPrompts = () => {
    fetch("/api/prompts")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPrompts(data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
          if (data.length > 0 && !newPromptId) setNewPromptId(data[0].id);
        }
      })
      .catch(() => {});
  };

  const handleCreate = async () => {
    if (!newName || !newPromptId) return;
    const res = await fetch("/api/strategies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, description: newDesc, promptId: newPromptId }),
    });
    if (res.ok) {
      setShowNewForm(false);
      setNewName("");
      setNewDesc("");
      fetchStrategies();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该策略？")) return;
    await fetch(`/api/strategies/${id}`, { method: "DELETE" });
    fetchStrategies();
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "list", label: "策略列表" },
    { key: "run", label: "运行" },
    { key: "history", label: "历史" },
  ];

  return (
    <div className="h-[calc(100vh-52px)] flex flex-col bg-[var(--background)] overflow-hidden p-4 gap-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-[var(--surface)] rounded-xl p-1 shrink-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === t.key ? "bg-accent text-black" : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* 策略列表 */}
        {tab === "list" && (
          <div className="h-full flex flex-col gap-4">
            <div className="flex justify-between items-center shrink-0">
              <p className="text-sm text-[var(--text-muted)]">共 {strategies.length} 个策略</p>
              <button
                onClick={() => { fetchPrompts(); setShowNewForm(true); }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: "var(--accent)", color: "black" }}
              >
                新建策略
              </button>
            </div>

            {/* 新建表单 */}
            {showNewForm && (
              <div className="glass-card rounded-xl p-4 shrink-0">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="策略名称"
                    className="px-3 py-2 rounded-lg text-sm bg-[var(--background)] border border-[var(--border)] text-foreground"
                  />
                  <select
                    value={newPromptId}
                    onChange={(e) => setNewPromptId(e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm bg-[var(--background)] border border-[var(--border)] text-foreground"
                  >
                    {prompts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="策略描述（可选）"
                  className="w-full px-3 py-2 mb-3 rounded-lg text-sm bg-[var(--background)] border border-[var(--border)] text-foreground"
                />
                <div className="flex gap-2">
                  <button onClick={handleCreate} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--accent)", color: "black" }}>
                    创建
                  </button>
                  <button onClick={() => setShowNewForm(false)} className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] hover:bg-white/5">
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* 策略列表 */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {strategies.map((s) => (
                <div key={s.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-medium truncate">{s.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent shrink-0">
                        {s.prompt.name}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
                      {s.description || "无描述"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <Link
                      href={`/strategies/${s.id}`}
                      className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] hover:bg-white/5 transition-colors"
                    >
                      编辑
                    </Link>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
              {strategies.length === 0 && (
                <div className="h-full flex items-center justify-center">
                  <p className="text-[var(--text-muted)]">暂无策略，点击上方新建</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 运行 */}
        {tab === "run" && (
          <div className="h-full overflow-y-auto">
            <StrategyRunner />
          </div>
        )}

        {/* 历史 */}
        {tab === "history" && (
          <div className="h-full overflow-y-auto space-y-2">
            {runs.map((run) => {
              const stockCodes = JSON.parse(run.stockCodes) as string[];
              return (
                <Link
                  key={run.id}
                  href={`/strategies/runs/${run.id}`}
                  className="glass-card rounded-xl p-4 flex items-center justify-between hover:bg-white/5 transition-colors block"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{run.strategy.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                        run.status === "completed" ? "bg-green-500/20 text-green-400" :
                        run.status === "running" ? "bg-blue-500/20 text-blue-400" :
                        run.status === "cancelled" ? "bg-gray-500/20 text-gray-400" :
                        "bg-red-500/20 text-red-400"
                      }`}>
                        {run.status === "completed" ? "已完成" :
                         run.status === "running" ? "运行中" :
                         run.status === "cancelled" ? "已取消" : "失败"}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {run.startDate} ~ {run.endDate} · {stockCodes.length} 支股票
                    </p>
                  </div>
                  <span className="text-xs text-[var(--text-muted)] shrink-0 ml-4">
                    {new Date(run.createdAt).toLocaleDateString()}
                  </span>
                </Link>
              );
            })}
            {runs.length === 0 && (
              <div className="h-full flex items-center justify-center">
                <p className="text-[var(--text-muted)]">暂无运行记录</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
