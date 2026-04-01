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

  useEffect(() => {
    fetch("/api/prompts")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPrompts(data);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">提示词管理</h1>
        <Link href="/prompts/new" className="px-4 py-2 bg-accent text-black rounded">
          新建提示词
        </Link>
      </div>
      <div className="space-y-3">
        {prompts.map((p) => (
          <Link key={p.id} href={`/prompts/${p.id}`} className="block p-4 border rounded hover:bg-gray-800">
            <div className="font-medium">{p.name}</div>
            <div className="text-sm text-gray-400 mt-1 truncate">{p.content}</div>
          </Link>
        ))}
        {prompts.length === 0 && <p className="text-gray-400">暂无提示词</p>}
      </div>
    </div>
  );
}