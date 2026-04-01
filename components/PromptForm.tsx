"use client";
import { useState } from "react";

interface PromptFormProps {
  initial?: { id?: string; name: string; content: string };
  onSuccess: () => void;
}

export default function PromptForm({ initial, onSuccess }: PromptFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [content, setContent] = useState(
    initial?.content ?? `你是股票策略分析师。请根据以下K线数据，判断股票是否符合策略要求。

可用变量：
- {{stockCode}}：股票代码
- {{dateRange}}：日期区间
- {{klineData}}：K线数据

请返回：
结果：符合/不符合
原因：`
  );
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = initial?.id ? "PUT" : "POST";
    const url = initial?.id ? `/api/prompts/${initial.id}` : "/api/prompts";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "保存失败");
      return;
    }

    onSuccess();
  };

  const handleDelete = async () => {
    if (!initial?.id) return;
    if (!confirm("确定删除该提示词？")) return;

    const res = await fetch(`/api/prompts/${initial.id}`, { method: "DELETE" });
    if (res.ok) onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-500">{error}</div>}
      <div>
        <label className="block text-sm mb-1">名称</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border rounded bg-background text-foreground"
          required
        />
      </div>
      <div>
        <label className="block text-sm mb-1">内容（支持 {"{{变量}}"} 占位符）</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full p-2 border rounded bg-background text-foreground font-mono text-sm"
          rows={20}
          required
        />
      </div>
      <div className="flex gap-3">
        <button type="submit" className="px-4 py-2 bg-accent text-black rounded">
          保存
        </button>
        {initial?.id && (
          <button type="button" onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded">
            删除
          </button>
        )}
      </div>
    </form>
  );
}