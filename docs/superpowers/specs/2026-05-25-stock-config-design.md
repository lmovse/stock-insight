# 系统配置模块 - 股票配置

## 概述

在系统配置页面中新增股票配置功能，用于管理 `StockConfig` 模型中的数据。按用途（purpose）分类展示，支持批量操作。

## 页面布局

- **单页 Tab 结构**：三个 Tab 切换显示不同用途的配置
  - 15分钟线 (FIFTEEN_MIN)
  - 日线 (DAILY)
  - 实时 (REALTIME)
- Tab 下方为操作栏 + 股票表格

## 组件结构

```
app/config/
└── page.tsx                  # 页面入口
components/config/
├── StockConfigTabs.tsx       # Tab 切换容器
├── StockConfigTable.tsx      # 股票表格组件
└── StockConfigOperateModal.tsx  # 添加/批量操作弹窗
```

## 数据模型

现有 `StockConfig` 模型不变：

```prisma
model StockConfig {
  id        String   @id @default(cuid())
  stockCode String   // 格式: "600000.SH" / "000001.SZ"
  purpose   String   // "FIFTEEN_MIN" | "DAILY" | "REALTIME"
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now())

  @@unique([stockCode, purpose])
  @@index([enabled])
}
```

## API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/config/stocks?purpose=FIFTEEN_MIN` | 获取指定分类的所有配置 |
| POST | `/api/config/stocks` | 批量添加 `{ stockCodes: string[], purpose: string }` |
| PATCH | `/api/config/stocks/:id` | 更新单个 `{ enabled: boolean }` |
| PATCH | `/api/config/stocks/batch` | 批量更新 `{ ids: string[], enabled: boolean }` |
| DELETE | `/api/config/stocks/batch` | 批量删除 `{ ids: string[] }` |

## 功能清单

| 功能 | 描述 |
|------|------|
| Tab 切换 | 点击 Tab 切换显示不同 purpose 的配置列表 |
| 添加股票 | 弹窗输入多行股票代码，批量创建该 purpose 的配置 |
| 启用/停用 | 表格内开关切换单个配置的 enabled 状态 |
| 批量启用/停用 | 勾选多个 → 点击批量操作按钮 |
| 批量删除 | 勾选多个 → 删除配置（不删除股票数据） |
| 搜索过滤 | 表格内按股票代码/名称搜索 |
| 股票信息展示 | 显示股票代码、名称（关联 StockBasic）、当前状态 |

## 表格列

| 列名 | 说明 |
|------|------|
| 勾选框 | 用于批量选择 |
| 股票代码 | 如 600000.SH |
| 股票名称 | 从 StockBasic 关联查询 |
| 状态 | 启用/停用开关 |
| 操作 | 删除按钮 |

## 技术实现

- 前端：Next.js App Router + Tailwind CSS
- 数据获取：SWR 或 fetch + useEffect
- 弹窗：React Portal 实现
- 状态管理：React useState/useEffect
