"use client";
import PromptForm from "@/components/PromptForm";
import { useRouter } from "next/navigation";

export default function NewPromptPage() {
  const router = useRouter();
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">新建提示词</h1>
      <PromptForm onSuccess={() => router.push("/prompts")} />
    </div>
  );
}