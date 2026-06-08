# OHLCV 字段自选设计

## 1. 概念与目标

在策略立即运行的数据配置中，将"K线数据（OHLCV）"单开关拆分为 5 个独立字段复选框（Open/High/Low/Close/Volume），支持灵活选择导出字段。同时修复后端实际不生效的问题。

## 2. 界面变更

### DataConfigSelector.tsx

**类型变更：**
```ts
interface DataConfig {
  open: boolean;
  high: boolean;
  low: boolean;
  close: boolean;
  volume: boolean;
}
```

**默认值：** `{ open: true, high: true, low: true, close: true, volume: true }`（向后兼容）

**UI：** 紧凑复选框列表，一行 5 个字段横向排列：
```
数据配置
☑ Open  ☑ High  ☑ Low  ☑ Close  ☑ Volume
```

## 3. 数据流

| 文件 | 变更 |
|------|------|
| `components/DataConfigSelector.tsx` | 单 toggle → 5 个 checkbox，默认全勾 |
| `components/StrategyRunner.tsx` | `dataConfig` 类型更新（无结构变更） |
| `app/api/strategies/[id]/run/route.ts` | `formatKLineData` 根据选中的字段动态生成输出 |

## 4. 后端处理

### formatKLineData 改造

```ts
function formatKLineData(
  data: { date: number; open: number; high: number; low: number; close: number; volume: number }[],
  selectedFields: { open: boolean; high: boolean; low: boolean; close: boolean; volume: boolean }
) {
  const headerFields = ["日期"];
  if (selectedFields.open) headerFields.push("开");
  if (selectedFields.high) headerFields.push("高");
  if (selectedFields.low) headerFields.push("低");
  if (selectedFields.close) headerFields.push("收");
  if (selectedFields.volume) headerFields.push("成交量");

  const header = headerFields.join(",");
  const rows = data.map((d) => {
    const row = [d.date];
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

## 5. 文件清单

- `components/DataConfigSelector.tsx` — UI 改造
- `components/StrategyRunner.tsx` — 类型引用更新
- `app/api/strategies/[id]/run/route.ts` — 后端实际使用 dataConfig
