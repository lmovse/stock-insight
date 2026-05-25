"use client";

import { useState } from "react";
import StockConfigTabs from "@/components/config/StockConfigTabs";
import CategoryManager from "@/components/config/CategoryManager";

type Tab = "stocks" | "categories";

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState<Tab>("stocks");

  return (
    <div className="h-[calc(100dvh-52px)] flex flex-col bg-[var(--background)] overflow-hidden p-4 animate-page-enter">
      {/* Header */}
      <div className="mb-4 shrink-0">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">系统配置</h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">管理股票分类配置</p>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 mb-4 shrink-0">
        <button
          onClick={() => setActiveTab("stocks")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === "stocks"
              ? "bg-accent/20 text-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          }`}
        >
          股票配置
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === "categories"
              ? "bg-accent/20 text-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          }`}
        >
          分类管理
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {activeTab === "stocks" ? <StockConfigTabs /> : <CategoryManager />}
      </div>
    </div>
  );
}
