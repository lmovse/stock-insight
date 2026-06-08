# OHLCV 字段自选实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将策略立即运行的"K线数据（OHLCV）"单开关拆为 Open/High/Low/Close/Volume 五个独立复选框，后端实际按所选字段输出。

**Architecture:** 前端 DataConfig 类型从 `{ kline: boolean }` 改为 `{ open: boolean; high: boolean; low: boolean; close: boolean; volume: boolean }`，默认全选。后端 `formatKLineData` 接收选中字段动态拼接 CSV 表头和行数据。

**Tech Stack:** Next.js App Router, TypeScript, Prisma

---

## 文件变更总览

| 文件 | 变更类型 |
|------|----------|
| `components/DataConfigSelector.tsx` | 重写 UI + 类型 |
| `components/StrategyRunner.tsx` | 类型引用更新（无结构变更） |
| `app/api/strategies/[id]/run/route.ts` | `formatKLineData` 使用 dataConfig |

---

### Task 1: DataConfigSelector UI 改造

**文件:** Modify: `components/DataConfigSelector.tsx`

- [ ] **Step 1: 修改类型定义**

```tsx
interface DataConfig {
  open: boolean;
  high: boolean;
  low: boolean;
  close: boolean;
  volume: boolean;
}
```

- [ ] **Step 2: 重写 UI 为横向复选框列表**

```tsx
export default function DataConfigSelector({
  value,
  onChange,
}: {
  value: DataConfig;
  onChange: (config: DataConfig) => void;
}) {
  const fields: { key: keyof DataConfig; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "high", label: "High" },
    { key: "low", label: "Low" },
    { key: "close", label: "Close" },
    { key: "volume", label: "Volume" },
  ];

  return (
    <div>
      <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium mb-3 block">
        数据配置
      </label>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {fields.map((f) => (
          <label key={f.key} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={value[f.key]}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.checked })}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${value[f.key] ? "bg-[var(--accent)] border-[var(--accent)]" : "bg-transparent border-[var(--border)]"}`}>
              {value[f.key] && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{f.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 验证编译**

Run: `npm run build 2>&1 | head -50`
Expected: 无 DataConfigSelector 相关错误

---

### Task 2: StrategyRunner 类型同步

**文件:** Modify: `components/StrategyRunner.tsx:25`

- [ ] **Step 1: 确认 dataConfig 默认值更新**

找到 `useState({ kline: true })` 改为:

```tsx
const [dataConfig, setDataConfig] = useState({
  open: true,
  high: true,
  low: true,
  close: true,
  volume: true,
});
```

- [ ] **Step 2: 验证编译**

Run: `npm run build 2>&1 | grep -E "(DataConfigSelector|StrategyRunner|error)"`
Expected: 无相关错误

---

### Task 3: 后端 formatKLineData 实际使用 dataConfig

**文件:** Modify: `app/api/strategies/[id]/run/route.ts`

- [ ] **Step 1: 修改 formatKLineData 接收 selectedFields 参数**

```ts
function formatKLineData(
  data: { date: number; open: number; high: number; low: number; close: number; volume: number }[],
  selectedFields: { open: boolean; high: boolean; low: boolean; close: boolean; volume: boolean }
) {
  const headerFields: string[] = ["日期"];
  if (selectedFields.open) headerFields.push("开");
  if (selectedFields.high) headerFields.push("高");
  if (selectedFields.low) headerFields.push("低");
  if (selectedFields.close) headerFields.push("收");
  if (selectedFields.volume) headerFields.push("成交量");

  const header = headerFields.join(",");
  const rows = data.map((d) => {
    const row: (string | number)[] = [d.date];
    if (selectedFields.open) row.push(d.open);
    if (selectedFields.high) row.push(d.high);
    if (selectedFields.low) row.push(d.low);
    if (selectedFields.close) row.push(d.close);
    if (selectedFields.volume) row.push(d.volume);
    return row.join(",");
  });
  return [header, ...rows].join("\n");
}
```

- [ ] **Step 2: 修改 processStock 解析 dataConfig 并传入 formatKLineData**

找到 `processStock` 函数签名，添加 dataConfig 参数：

```ts
async function processStock(
  runId: string,
  stockCode: string,
  startDate: string,
  endDate: string,
  promptTemplate: string,
  criteria: string,
  dataConfig: { open: boolean; high: boolean; low: boolean; close: boolean; volume: boolean }
)
```

找到 `const klineText = formatKLineData(klineData);` 改为：

```ts
const klineText = formatKLineData(klineData, dataConfig);
```

- [ ] **Step 3: 修改 runStrategy 中调用 processStock 处**

找到 `batch.map((b) => processStock(...))` 调用，在 `runStrategy` 中解析 dataConfig 并传入：

在 `runStrategy` 函数内，找到：
```ts
const stockCodes = JSON.parse(run.stockCodes);
```
后添加：
```ts
const dataConfig = JSON.parse(run.dataConfig ?? '{"open":true,"high":true,"low":true,"close":true,"volume":true}');
```

然后将 `batch.map((b) => processStock(runId, b.stockCode, run.startDate, run.endDate, promptTemplate, criteria))` 改为：
```ts
batch.map((b) => processStock(runId, b.stockCode, run.startDate, run.endDate, promptTemplate, criteria, dataConfig))
```

- [ ] **Step 4: 验证编译**

Run: `npm run build 2>&1 | grep -E "(route|error)" | head -20`
Expected: 无相关错误

---

## 验证清单

- [ ] 前端：数据配置区域显示 5 个复选框（Open/High/Low/Close/Volume），默认全勾选
- [ ] 前端：取消勾选某字段后，状态正确传递给后端
- [ ] 后端：formatKLineData 仅输出选中的字段
- [ ] 构建：npm run build 成功
