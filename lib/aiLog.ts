export interface AILogEntry {
  id: string;
  runId: string;
  stockCode: string;
  messages: { role: string; content: string }[];
  response: string;
  timestamp: number;
}

const MAX_LOGS = 100;

// Use global to survive module re-evaluation in Next.js App Router
const GLOBAL_KEY = "__ai_logs__";
if (!(global as any)[GLOBAL_KEY]) {
  (global as any)[GLOBAL_KEY] = [];
}
const logs: AILogEntry[] = (global as any)[GLOBAL_KEY];

export function addAILog(entry: Omit<AILogEntry, "id" | "timestamp">): void {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  logs.unshift({
    ...entry,
    id,
    timestamp: Date.now(),
  });
  if (logs.length > MAX_LOGS) {
    logs.pop();
  }
}

export function getAILogs(): AILogEntry[] {
  return logs;
}

export function getAILogsByRunId(runId: string): AILogEntry[] {
  return logs.filter((log) => log.runId === runId);
}

export function clearAILogs(): void {
  logs.length = 0;
}
