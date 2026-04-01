"use client";
import { useEffect, useState } from "react";
import StrategyForm from "@/components/StrategyForm";
import { useRouter } from "next/navigation";

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  promptId: string;
}

export default function EditStrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const router = useRouter();

  useEffect(() => {
    params.then(({ id }: { id: string }) => {
      fetch(`/api/strategies/${id}`)
        .then((r) => r.json())
        .then(setStrategy);
    });
  }, [params]);

  if (!strategy) return <div>加载中...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">编辑策略</h1>
      <StrategyForm initial={strategy} onSuccess={() => router.push("/strategies")} />
    </div>
  );
}
