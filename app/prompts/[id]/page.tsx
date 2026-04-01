"use client";
import { useEffect, useState } from "react";
import PromptForm from "@/components/PromptForm";
import { useRouter } from "next/navigation";

interface Prompt {
  id: string;
  name: string;
  content: string;
}

export default function EditPromptPage({ params }: { params: Promise<{ id: string }> }) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const router = useRouter();

  useEffect(() => {
    params.then(({ id }: { id: string }) => {
      fetch(`/api/prompts/${id}`)
        .then((r) => r.json())
        .then(setPrompt);
    });
  }, [params]);

  if (!prompt) return <div>加载中...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">编辑提示词</h1>
      <PromptForm initial={prompt} onSuccess={() => router.push("/prompts")} />
    </div>
  );
}