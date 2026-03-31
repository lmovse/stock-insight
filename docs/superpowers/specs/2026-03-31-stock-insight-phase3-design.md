# Stock Insight Phase 3 — 设计文档

## 1. 功能概述

Phase 3 包含两个功能模块：

1. **画线工具** — 在 K 线图上绘制趋势线、斐波那契回撤、水平支撑/阻力线、文字标注
2. **自定义指标参数** — 点击指标按钮弹出 Modal 设置参数值

## 2. 技术方案

### 画线工具

**技术实现**: 绑定 lightweight-charts 的 timeScale/priceScale 事件，在原 chart canvas 上绘制。

**工具类型**:
- 趋势线 (TREND) — 两点确定一条直线
- 斐波那契回撤 (FIBONACCI) — 两点确定，回撤位自动计算 0%, 23.6%, 38.2%, 50%, 61.8%, 100%
- 水平支撑/阻力线 (HORIZONTAL) — 单价格水平线
- 文字标注 (TEXT) — 单点点击放置文字

**交互流程**:
1. 点击工具栏按钮选择工具类型
2. 在图表上点击拖拽（趋势线、斐波那契需要两点；水平线、文字单点）
3. 松开完成绘制
4. 已有的线条点击可选中，拖拽端点可调整，Delete 键删除

**数据存储**: 每个用户的每个股票独立保存一套画线数据到数据库。

### 自定义指标参数

**交互方式**: 点击指标按钮（如 MACD）→ 弹出 Modal 设置参数 → 确认后图表实时更新。

**参数配置**:
- MA: 周期列表 [5, 10, 20, 60]
- MACD: 快线 12, 慢线 26, 信号线 9
- KDJ: K 9, D 3, J 3
- BOLL: 周期 20, 标准差倍数 2
- RSI: 周期 14

**参数保存**: 用户参数配置保存到用户账户，云端同步。

## 3. 数据模型

### 画线

```prisma
model DrawingLine {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  stockCode String
  type      String   // "TREND" | "FIBONACCI" | "HORIZONTAL" | "TEXT"
  data      String   // JSON: 不同类型数据结构不同
  color     String   @default("#E53935")
  createdAt DateTime @default(now())

  @@index([userId, stockCode])
}
```

**data 结构**:
- TREND: `{ startTime: number, startPrice: number, endTime: number, endPrice: number }`
- FIBONACCI: `{ startTime: number, startPrice: number, endTime: number, endPrice: number }`
- HORIZONTAL: `{ time: number, price: number }`
- TEXT: `{ time: number, price: number, text: string }`

### 指标配置

```prisma
model ChartConfig {
  id        String  @id @default(cuid())
  userId    String  @unique
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  indicators String  // JSON: IndicatorConfig
  theme     String  @default("dark")
}
```

## 4. API 设计

### 画线
- `GET /api/drawings?stockCode=` — 获取当前股票的画线列表
- `POST /api/drawings` — 创建画线
- `PUT /api/drawings/[id]` — 更新画线（移动端点、修改颜色等）
- `DELETE /api/drawings/[id]` — 删除画线

### 指标配置
- `GET /api/config/indicators` — 获取当前用户的指标参数配置
- `PUT /api/config/indicators` — 更新指标参数配置

## 5. 组件结构

### DrawingToolbar
画线工具栏，放在图表区域顶部，包含趋势线、斐波那契、水平线、文字 4 个按钮。

### DrawingCanvas
透明 canvas 覆盖层，绑定到 lightweight-charts，处理鼠标事件，绘制线条。

### IndicatorModal
点击指标按钮弹出的 Modal，显示当前参数值，支持修改确认。

## 6. 实现顺序

1. 数据库迁移（DrawingLine 表）
2. 画线 API 路由
3. DrawingToolbar + DrawingCanvas 组件
4. 指标参数 Modal
5. 参数配置 API 和持久化
6. 构建验证
