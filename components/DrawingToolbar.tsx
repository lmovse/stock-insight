"use client";

export type DrawingTool = "SELECT" | "TREND" | "FIBONACCI" | "HORIZONTAL" | "TEXT";

interface Props {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
}

const tools: { id: DrawingTool; label: string }[] = [
  { id: "SELECT", label: "选择" },
  { id: "TREND", label: "趋势线" },
  { id: "FIBONACCI", label: "斐波那契" },
  { id: "HORIZONTAL", label: "水平线" },
  { id: "TEXT", label: "文字" },
];

export default function DrawingToolbar({ activeTool, onToolChange }: Props) {
  return (
    <div className="flex items-center gap-1 p-1 bg-[var(--surface)] border-b border-[var(--border)]">
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => onToolChange(t.id)}
          className={`px-2 py-1 text-xs font-mono border transition-colors ${
            activeTool === t.id
              ? "bg-[var(--accent)] text-white border-[var(--accent)]"
              : "bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
