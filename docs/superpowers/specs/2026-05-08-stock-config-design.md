# Stock Config 配置表设计

## 背景

15min K 线数据抓取目前拉取全量 A 股（约 5000+ 只），数据量过大。
新增配置表控制只抓取指定股票，支持多用途扩展。

## 设计决策

| 决策项 | 选择 |
|--------|------|
| 作用域 | 系统级，独立于用户 |
| 用途管理 | 固定枚举字符串（代码定义），DB 存 String |
| 禁用开关 | enabled 布尔字段 |
| 股票格式 | 内部格式（600000.SH），与 StockBasic.tsCode 一致 |
| 维护方式 | 手动（Prisma Studio / SQL），不提供 API |

## 数据库模型

```prisma
model StockConfig {
  id        String   @id @default(cuid())
  stockCode String   // 格式: "600000.SH" / "000001.SZ"，与 StockBasic.tsCode 一致
  purpose   String   // "FIFTEEN_MIN" | "DAILY" | "REALTIME"
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now())

  @@unique([stockCode, purpose])
  @@index([enabled])
}
```

### Purpose 枚举（代码侧）

```typescript
type StockConfigPurpose = "FIFTEEN_MIN" | "DAILY" | "REALTIME";
```

后续新增用途：代码加枚举值 + DB 加记录。

## 脚本改造

### 新建 `jobs/sync_15min_fetch.py`

- 读取 `StockConfig` 中 `purpose=FIFTEEN_MIN AND enabled=true` 的股票
- 转换 stockCode 为 Baostock 格式（如 `600000.SH` → `sh.600000`）
- 只抓取配置中的股票，生成 CSV

### 修改 `jobs/sync_15min_import.py`

- 读取 `StockConfig` 确定哪些股票需要导入
- 只导入配置中的 CSV 文件

### 保留 `jobs/sync_15min.py`

- 不变，仍是全量抓取脚本（供一次性全量拉取使用）

## 数据流

```
StockConfig (DB)
    ↓ 读取 enabled=true + purpose=FIFTEEN_MIN
sync_15min_fetch.py
    ↓ 抓取 CSV（只配置中的）
data/15min/*.csv
    ↓ 读取配置确定哪些要导入
sync_15min_import.py
    ↓ 写入 DB
MinuteCandle (DB)
```

## 手动维护

```bash
# 浏览器管理
npx prisma studio

# 或 SQL
sqlite3 prisma/dev.db "INSERT INTO StockConfig (id, stockCode, purpose, enabled) VALUES ('cxxx', '600000.SH', 'FIFTEEN_MIN', true);"
sqlite3 prisma/dev.db "UPDATE StockConfig SET enabled=false WHERE stockCode='600000.SH' AND purpose='FIFTEEN_MIN';"
sqlite3 prisma/dev.db "DELETE FROM StockConfig WHERE stockCode='600000.SH' AND purpose='FIFTEEN_MIN';"
```

## 扩展方向（预留）

- 新增 purpose 值（如 `DAILY`）复用同一张表
- 添加 `remark` 字段做分组备注
- 提供管理 API（未来需求明确后实现）
