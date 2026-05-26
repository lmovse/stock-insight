"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  purpose: string;
  purposeLabels: Record<string, string>;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StockConfigOperateModal({ purpose, purposeLabels, onClose, onSuccess }: Props) {
  const [codes, setCodes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = async () => {
    const codeList = codes.split("\n").map((c) => c.trim()).filter(Boolean);
    if (codeList.length === 0) {
      setError("请输入至少一个股票代码");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/config/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockCodes: codeList, purpose }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "添加失败");
      }

      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "添加失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 animate-dialog-enter">
      <div
        className="rounded-t-2xl sm:rounded-xl shadow-lg border overflow-hidden w-full sm:max-w-md"
        style={{ background: "var(--surface-solid)", borderColor: "var(--border)", maxHeight: "90dvh" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            添加股票 - {purposeLabels[purpose] || purpose}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={codes}
            onChange={(e) => setCodes(e.target.value)}
            placeholder="输入股票代码，每行一个，如：&#10;600000&#10;000001"
            rows={6}
            disabled={loading}
            className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none font-mono"
          />
          {error && (
            <p className="text-xs mt-2" style={{ color: "var(--down-color)" }}>{error}</p>
          )}
        </div>

        <div className="flex gap-2 px-4 pb-4 sm:pb-4">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 pill-active"
          >
            {loading ? "添加中..." : "添加"}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 pill-inactive"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}