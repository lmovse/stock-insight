"use client";

import { useEffect, useState } from "react";

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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");

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

  const handleEdit = (p: Prompt) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditContent(p.content);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName || !editContent) return;
    const res = await fetch(`/api/prompts/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, content: editContent }),
    });
    if (res.ok) {
      setEditingId(null);
      fetchPrompts();
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div className="h-[calc(100vh-52px)] flex flex-col bg-[var(--background)] overflow-hidden p-4 gap-4 animate-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">提示词管理</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">管理 AI 策略分析提示词模板</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors pill-active"
        >
          新建提示词
        </button>
      </div>

      {/* 新建表单 */}
      {showNewForm && (
        <div className="glass-card rounded-xl p-5 shrink-0 form-slide-enter">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-[var(--text-primary)]">新建提示词</span>
          </div>
          <div className="mb-3">
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">提示词名称</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="输入提示词名称"
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">提示词内容</label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] font-mono resize-none leading-relaxed"
              rows={10}
              placeholder={`提示词内容，支持 {{变量名}} 占位符...`}
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              className="px-5 py-2 rounded-lg text-sm font-semibold pill-active"
            >
              创建
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] text-[var(--text-secondary)] hover:bg-white/5 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 提示词列表 */}
      <div className="flex-1 overflow-y-auto space-y-3 animate-stagger">
        {prompts.map((p) => (
          <div key={p.id} className={`glass-card rounded-xl p-4 edit-card transition-all duration-300 ${editingId === p.id ? 'border-[var(--accent)]' : ''}`}>
            {editingId === p.id ? (
              /* 编辑表单 */
              <div className="form-slide-enter">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">编辑提示词</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">提示词名称</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="输入提示词名称"
                      className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">提示词内容</label>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder={`提示词内容，支持 {{变量名}} 占位符...`}
                      rows={10}
                      className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono resize-none leading-relaxed"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleSaveEdit}
                    className="px-5 py-2 rounded-lg text-sm font-semibold pill-active"
                  >
                    保存
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] text-[var(--text-secondary)] hover:bg-white/5 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              /* 显示状态 */
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-[var(--text-primary)]">{p.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] font-mono leading-relaxed rounded-lg p-3 max-h-20 overflow-hidden border border-[var(--border-subtle)]">
                    {p.content.slice(0, 200)}...
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleEdit(p)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {prompts.length === 0 && !showNewForm && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-[var(--text-muted)]">暂无提示词</p>
              <button
                onClick={() => setShowNewForm(true)}
                className="mt-2 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
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
