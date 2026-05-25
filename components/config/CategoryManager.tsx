"use client";

import { useState, useEffect } from "react";

interface Category {
  id: string;
  code: string;
  name: string;
  order: number;
}

interface CategoryFormData {
  code: string;
  name: string;
}

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({ code: "", name: "" });
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = () => {
    setLoading(true);
    fetch("/api/config/categories")
      .then((r) => r.json())
      .then((data) => {
        setCategories(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const resetForm = () => {
    setFormData({ code: "", name: "" });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.code.trim() || !formData.name.trim()) {
      setError("代码和名称不能为空");
      return;
    }

    try {
      if (editingId) {
        const res = await fetch(`/api/config/categories/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "更新失败");
          return;
        }
      } else {
        const res = await fetch("/api/config/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "创建失败");
          return;
        }
      }
      resetForm();
      fetchCategories();
    } catch {
      setError("操作失败");
    }
  };

  const handleEdit = (cat: Category) => {
    setFormData({ code: cat.code, name: cat.name });
    setEditingId(cat.id);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该分类？该操作不会删除分类下的股票配置。")) return;
    try {
      const res = await fetch(`/api/config/categories/${id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("删除失败");
        return;
      }
      fetchCategories();
    } catch {
      alert("删除失败");
    }
  };

  return (
    <div className="glass-card rounded-xl flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <span className="text-sm font-medium text-[var(--text-primary)]">分类管理</span>
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg pill-active transition-colors"
        >
          添加分类
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="shrink-0 px-4 py-3 border-b border-[var(--border)] bg-[var(--background)]">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">代码</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="如 CHEN"
                className="px-3 py-2 text-sm rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] w-32 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="如 陈"
                className="px-3 py-2 text-sm rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] w-24"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold rounded-lg pill-active transition-colors"
              >
                {editingId ? "保存" : "添加"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-white/5 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </form>
      )}

      {/* List */}
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10" style={{ background: 'var(--surface-solid)' }}>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">代码</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">名称</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                    <span className="text-sm text-[var(--text-muted)]">加载中...</span>
                  </div>
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-8">
                  <span className="text-sm text-[var(--text-muted)]">暂无分类</span>
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors">
                  <td className="px-4 py-3 font-mono text-[var(--text-primary)]">{cat.code}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{cat.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleEdit(cat)}
                        className="text-xs text-[var(--accent)] hover:underline"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
