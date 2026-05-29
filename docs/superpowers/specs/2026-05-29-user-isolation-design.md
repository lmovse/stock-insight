# 用户隔离设计

## 概述

为策略、提示词、脚本策略、脚本运行、股票配置添加用户隔离，确保用户只能访问自己的数据和全局预置数据。

## 背景

当前数据模型存在以下问题：
- `Strategy.userId` 和 `Prompt.userId` 为 nullable（NULL 表示全局）
- `ScriptStrategy` 和 `ScriptRun` 完全无用户隔离
- `StockConfig` 无用户隔离

## 设计原则

1. **全局数据标识**：`userId = 'global'` 表示全局/预置数据
2. **API 行为**：GET APIs 返回全局数据 + 当前用户私有数据
3. **写入自动关联**：POST 操作自动带上当前用户 ID
4. **向后兼容**：现有 NULL 值迁移为 'global'

## 数据模型变更

### Strategy
```prisma
model Strategy {
  userId      String   @default("global")
  ...
}
```
- 变更：`userId String?` → `userId String @default("global")`
- 迁移：userId IS NULL → userId = 'global'

### Prompt
```prisma
model Prompt {
  userId      String   @default("global")
  ...
}
```
- 变更：`userId String?` → `userId String @default("global")`
- 迁移：userId IS NULL → userId = 'global'

### ScriptStrategy
```prisma
model ScriptStrategy {
  userId      String   @default("global")
  ...
}
```
- 新增：添加 `userId String @default("global")`
- 迁移：无需迁移（新建表）

### ScriptRun
- 通过 `ScriptStrategy.userId` 继承，无需修改

### StockConfig
```prisma
model StockConfig {
  userId      String?
  ...
}
```
- 新增：添加 `userId String?`（可为空，支持系统级配置）

## API 变更

### 通用模式

所有相关 API 添加用户过滤逻辑：

```typescript
// 获取当前用户 ID
const user = await getCurrentUser();
const currentUserId = user?.id || 'global';

// 过滤条件：全局数据 OR 当前用户数据
const where = {
  OR: [
    { userId: 'global' },
    { userId: currentUserId }
  ]
};
```

### GET /api/strategies
- 返回：`userId = 'global' OR userId = 当前用户`
- 响应结构不变

### POST /api/strategies
- 自动设置：`userId = 当前用户`
- 不再接受前端传来的 userId

### GET /api/prompts
- 返回：`userId = 'global' OR userId = 当前用户`

### POST /api/prompts
- 自动设置：`userId = 当前用户`

### GET /api/scripts/strategies
- 返回：`userId = 'global' OR userId = 当前用户`

### POST /api/scripts/strategies
- 自动设置：`userId = 当前用户`

### GET /api/config/stocks
- 返回：`userId = 'global' OR userId = 当前用户`
- 新增用户时，使用 `userId = 当前用户` 进行 upsert

### POST /api/config/stocks
- 自动设置：`userId = 当前用户`（若未指定）

## 迁移计划

### 1. Schema 迁移
```bash
npx prisma db push --skip-generate
```

### 2. 数据迁移 SQL
```sql
-- Strategy: NULL → 'global'
UPDATE Strategy SET userId = 'global' WHERE userId IS NULL;

-- Prompt: NULL → 'global'
UPDATE Prompt SET userId = 'global' WHERE userId IS NULL;
```

### 3. 生成客户端
```bash
npx prisma generate
```

## 文件变更

### API 文件
- `app/api/strategies/route.ts` - GET/POST 添加用户过滤
- `app/api/strategies/[id]/route.ts` - PUT/DELETE 验证所有权
- `app/api/prompts/route.ts` - GET/POST 添加用户过滤
- `app/api/scripts/strategies/route.ts` - GET/POST 添加用户过滤
- `app/api/scripts/strategies/[id]/route.ts` - PUT/DELETE 验证所有权
- `app/api/config/stocks/route.ts` - GET/POST 添加用户过滤

### 前端变更
- 无需变更（API 兼容）

## 验证清单

- [ ] Strategy API 只返回 global + 当前用户数据
- [ ] Prompt API 只返回 global + 当前用户数据
- [ ] ScriptStrategy API 只返回 global + 当前用户数据
- [ ] StockConfig API 只返回 global + 当前用户数据
- [ ] POST 操作正确设置 userId
- [ ] 用户无法删除/修改他人的数据
- [ ] 现有全局数据迁移正确
