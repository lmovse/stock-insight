"use client";
import StrategyForm from "@/components/StrategyForm";
import { useRouter } from "next/navigation";

export default function NewStrategyPage() {
  const router = useRouter();
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">新建策略</h1>
      <StrategyForm onSuccess={() => router.push("/strategies")} />
    </div>
  );
}
