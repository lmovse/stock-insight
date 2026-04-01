import StrategyRunner from "@/components/StrategyRunner";

export default function RunPage() {
  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">运行选股策略</h1>
      <StrategyRunner />
    </div>
  );
}
