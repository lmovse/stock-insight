"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import StrategyRunner from "@/components/StrategyRunner";

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  criteria: string | null;
  prompt: { id: string; name: string };
  createdAt: string;
}

type DialogContent =
  | { type: "run" }
  | null;

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCriteria, setNewCriteria] = useState("");
  const [newPromptId, setNewPromptId] = useState("");
  const [prompts, setPrompts] = useState<{ id: string; name: string }[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCriteria, setEditCriteria] = useState("");
  const [editPromptId, setEditPromptId] = useState("");

  const [dialog, setDialog] = useState<DialogContent>(null);

  useEffect(() => {
    fetchStrategies();
    fetchPrompts();
  }, []);

  useEffect(() => {
    if (dialog) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [dialog]);

  const fetchStrategies = () => {
    fetch("/api/strategies")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setStrategies(data); })
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
      body: JSON.stringify({ name: newName, description: newDesc, criteria: newCriteria, promptId: newPromptId }),
    });
    if (res.ok) {
      setShowNewForm(false);
      setNewName("");
      setNewDesc("");
      setNewCriteria("");
      fetchStrategies();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该策略？")) return;
    await fetch(`/api/strategies/${id}`, { method: "DELETE" });
    fetchStrategies();
  };

  const handleEdit = (s: Strategy) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditDesc(s.description || "");
    setEditCriteria((s as unknown as { criteria?: string }).criteria || "");
    setEditPromptId(s.prompt?.id || "");
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName || !editPromptId) return;
    const res = await fetch(`/api/strategies/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDesc, criteria: editCriteria, promptId: editPromptId }),
    });
    if (res.ok) {
      setEditingId(null);
      fetchStrategies();
    }
  };

  const openRunDialog = () => setDialog({ type: "run" });

  return (
    <div className="h-[calc(100dvh-52px)] flex flex-col bg-[var(--background)] overflow-hidden p-4 gap-4 animate-page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 shrink-0">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">选股策略</h1>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={openRunDialog}
            className="px-4 py-2 rounded-lg text-sm font-semibold pill-active"
          >
            立即运行
          </button>
          <Link
            href="/strategies/runs"
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            运行历史
          </Link>
          <button
            onClick={() => { fetchPrompts(); setShowNewForm(true); }}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            新建策略
          </button>
        </div>
      </div>

      {/* 新建表单 */}
      {showNewForm && (
        <div className="glass-card rounded-xl p-5 shrink-0 form-slide-enter">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">策略名称</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="输入策略名称"
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">提示词</label>
              <select
                value={newPromptId}
                onChange={(e) => setNewPromptId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)]"
              >
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">策略描述 <span className="text-[var(--text-muted)] opacity-60">（可选）</span></label>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="简要描述策略逻辑"
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">策略条件 <span className="text-[var(--text-muted)] opacity-60">（支持 Markdown）</span></label>
            <textarea
              value={newCriteria}
              onChange={(e) => setNewCriteria(e.target.value)}
              placeholder="描述选股条件，如：&#10;1. 均线多头排列（MA5 > MA10 > MA20）&#10;2. 成交量放大至5日均量的1.5倍以上"
              rows={6}
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none leading-relaxed"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-5 py-2 rounded-lg text-sm font-semibold pill-active">创建</button>
            <button onClick={() => setShowNewForm(false)} className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] text-[var(--text-secondary)] hover:bg-white/5 transition-colors">取消</button>
          </div>
        </div>
      )}

      {/* 策略列表 */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {strategies.map((s) => (
          <div key={s.id} className={`glass-card rounded-xl p-4 transition-all duration-300 ${editingId === s.id ? 'border-[var(--accent)]' : ''}`}>
            {editingId === s.id ? (
              /* 编辑表单 */
              <div className="form-slide-enter overflow-visible">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">编辑策略</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">名称</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">提示词</label>
                    <select
                      value={editPromptId}
                      onChange={(e) => setEditPromptId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)]"
                    >
                      {prompts.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">描述</label>
                    <input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">策略条件</label>
                    <textarea
                      value={editCriteria}
                      onChange={(e) => setEditCriteria(e.target.value)}
                      placeholder="支持 Markdown 格式"
                      rows={6}
                      className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)] resize-none leading-relaxed"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={handleSaveEdit} className="px-5 py-2 rounded-lg text-sm font-semibold pill-active">保存</button>
                  <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] text-[var(--text-secondary)] hover:bg-white/5 transition-colors">取消</button>
                </div>
              </div>
            ) : (
              /* 显示状态 */
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--text-primary)]">{s.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-muted)] text-[var(--accent)] shrink-0">
                      {s.prompt?.name}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{s.description || "无描述"}</p>
                  {s.criteria && (
                    <div className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed prose">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.criteria}</ReactMarkdown>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <button
                    onClick={() => handleEdit(s)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {strategies.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <p className="text-[var(--text-muted)]">暂无策略，点击上方新建</p>
          </div>
        )}
      </div>

      {/* Dialog backdrop */}
      {dialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setDialog(null); }}
        >
          <div
            className="glass-card rounded-2xl w-full max-w-[95vw] sm:max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden animate-dialog-enter"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  立即运行
                </h2>
              </div>
              <button
                onClick={() => setDialog(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            {/* Dialog content */}
            <div className="flex-1 overflow-y-auto p-6">
              {dialog.type === "run" && <StrategyRunner />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
