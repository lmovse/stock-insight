"use client";
import { useEffect, useState } from "react";

interface Prompt {
  id: string;
  name: string;
}

interface StrategyFormProps {
  initial?: { id?: string; name: string; description: string | null; promptId: string };
  onSuccess: () => void;
}

export default function StrategyForm({ initial, onSuccess }: StrategyFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [promptId, setPromptId] = useState(initial?.promptId ?? "");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/prompts")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPrompts(data);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = initial?.id ? "PUT" : "POST";
    const url = initial?.id ? `/api/strategies/${initial.id}` : "/api/strategies";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, promptId }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "保存失败");
      return;
    }

    onSuccess();
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
        <label className="block text-sm mb-1">描述</label>
        <input
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-2 border rounded bg-background text-foreground"
        />
      </div>
      <div>
        <label className="block text-sm mb-1">提示词</label>
        <select
          value={promptId}
          onChange={(e) => setPromptId(e.target.value)}
          className="w-full p-2 border rounded bg-background text-foreground"
          required
        >
          <option value="">选择提示词</option>
          {prompts.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <button type="submit" className="px-4 py-2 bg-accent text-black rounded">
        保存
      </button>
    </form>
  );
}
