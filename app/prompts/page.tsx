"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Prompt {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState(`你是股票策略分析师。请根据以下K线数据，判断股票是否符合策略要求。

可用变量：
- {{stockCode}}：股票代码
- {{dateRange}}：日期区间
- {{klineData}}：K线数据

请返回：
结果：符合/不符合
原因：`);

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = () => {
    fetch("/api/prompts")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPrompts(data);
      })
      .catch(() => {});
  };

  const handleCreate = async () => {
    if (!newName || !newContent) return;
    const res = await fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, content: newContent }),
    });
    if (res.ok) {
      setShowNewForm(false);
      setNewName("");
      setNewContent("");
      fetchPrompts();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该提示词？")) return;
    const res = await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchPrompts();
    } else {
      const data = await res.json();
      alert(data.error || "删除失败");
    }
  };

  return (
    <div className="h-[calc(100vh-52px)] flex flex-col bg-[var(--background)] overflow-hidden p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-lg font-bold">提示词管理</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">管理 AI 策略分析提示词模板</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: "var(--accent)", color: "black" }}
        >
          新建提示词
        </button>
      </div>

      {/* 新建表单 */}
      {showNewForm && (
        <div className="glass-card rounded-xl p-4 mb-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">新建提示词</span>
            <button onClick={() => setShowNewForm(false)} className="text-xs text-[var(--text-muted)] hover:text-white">
              取消
            </button>
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="提示词名称"
            className="w-full px-3 py-2 mb-3 rounded-lg text-sm bg-[var(--background)] border border-[var(--border)] text-foreground"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            className="w-full px-3 py-2 mb-3 rounded-lg text-sm bg-[var(--background)] border border-[var(--border)] text-foreground font-mono resize-none"
            rows={12}
            placeholder="提示词内容..."
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "var(--accent)", color: "black" }}
            >
              创建
            </button>
          </div>
        </div>
      )}

      {/* 提示词列表 */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {prompts.map((p) => (
          <div key={p.id} className="glass-card rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] font-mono leading-relaxed bg-black/20 rounded-lg p-2 max-h-24 overflow-hidden">
                  {p.content.slice(0, 200)}...
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/prompts/${p.id}`}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] hover:bg-white/5 transition-colors"
                >
                  编辑
                </Link>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        ))}
        {prompts.length === 0 && !showNewForm && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-[var(--text-muted)]">暂无提示词</p>
              <button
                onClick={() => setShowNewForm(true)}
                className="mt-2 text-sm underline hover:text-white"
              >
                新建一个
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
