# 脚本策略模块设计

## 概述

为 Stock Insight 系统新增"脚本策略"模块，允许用户选择 Python 脚本运行策略，并通过 AI 分析结果展示。用户可在页面上输入参数（如日期），运行脚本，查看历史分析记录。

## 数据模型

### 新增 Prisma Model

```prisma
model ScriptStrategy {
  id          String   @id @default(cuid())
  name        String
  description String?
  scriptPath  String   // 相对于 scripts/ 目录的路径，如 "screen_today_signals.py"
  params      String?  // 默认参数 JSON，如 '{"days": 10}'
  createdAt   DateTime @default(now())

  runs        ScriptRun[]
}

model ScriptRun {
  id                String   @id @default(cuid())
  scriptStrategyId  String
  params            String   // 运行时参数 JSON
  result            String?  // 脚本原始输出 JSON
  analysis          String?  // AI 分析报告 Markdown
  status            String   // pending | running | completed | failed
  error             String?
  createdAt         DateTime @default(now())
  finishedAt        DateTime?

  script            ScriptStrategy @relation(fields: [scriptStrategyId], references: [id], onDelete: Cascade)
}
```

## 页面设计

### URL
`/strategies` 页面新增 Tab 切换：
- `?tab=ai` - AI 策略（现有）
- `?tab=script` - 脚本策略（新增）

### 脚本策略 Tab 布局

```
┌─────────────────────────────────────────────────┐
│  脚本策略                              [历史记录] │
├─────────────────────────────────────────────────┤
│  脚本选择: [screen_today_signals.py      ▼]     │
│                                                 │
│  参数配置:                                       │
│  日期: [2026-05-29        ]                    │
│                                                 │
│  [开始运行]                                      │
├─────────────────────────────────────────────────┤
│  运行结果:                                        │
│  ┌───────────────────────────────────────────┐  │
│  │ 共找到 37 个信号                           │  │
│  │ ...                                        │  │
│  │ AI 分析报告:                               │  │
│  │ > 策略表现良好，胜率约 79%...              │  │
│  └───────────────────────────────────────────┘  │
├─────────────────────────────────────────────────┤
│  历史运行记录:                                    │
│  ├─ 2026-05-29 10:30 | 37个信号 | 已分析      │
│  ├─ 2026-05-28 14:22 | 15个信号 | 已分析      │
│  └─ 2026-05-27 09:15 | 0个信号 | 已分析      │
└─────────────────────────────────────────────────┘
```

## 脚本规范

### 存放位置
`scripts/` 目录下，如 `scripts/screen_today_signals.py`

### 输出格式
标准 JSON 输出到 stdout：

```python
import argparse
import json

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--date', required=True)
    args = parser.parse_args()

    # ... 执行策略逻辑 ...

    results = [
        {
            "tsCode": "sh.600000",
            "minLow": 100.0,
            "signalTime": "202605290945",
            "currentPrice": 105.0,
            "kChange": 50.2,
            "difChange": 2.5
        }
    ]

    print(json.dumps({
        "success": True,
        "data": results,
        "summary": f"共找到 {len(results)} 个信号"
    }, ensure_ascii=False))

if __name__ == "__main__":
    main()
```

### 参数接收
- 日期参数：`--date 20260529`
- 其他参数：`--params '{"key":"value"}'` （JSON 字符串）

### 数据库访问
脚本直接连接 `prisma/dev.db` SQLite 数据库：

```python
import sqlite3

DB_PATH = "prisma/dev.db"
conn = sqlite3.connect(DB_PATH)
```

## API 设计

### GET /api/scripts/strategies
获取所有脚本策略列表

Response:
```json
[
  {
    "id": "xxx",
    "name": "30分钟底背离",
    "description": "...",
    "scriptPath": "screen_today_signals.py",
    "params": "{\"days\": 10}"
  }
]
```

### POST /api/scripts/strategies
创建脚本策略

### GET /api/scripts/strategies/[id]
获取单个脚本策略详情

### POST /api/scripts/strategies/[id]/run
运行脚本策略

Request:
```json
{
  "params": "{\"date\": \"20260529\"}"
}
```

Response:
```json
{
  "runId": "xxx"
}
```

### GET /api/scripts/runs/[id]
获取运行结果

Response:
```json
{
  "id": "xxx",
  "status": "completed",
  "params": "{\"date\": \"20260529\"}",
  "result": "{...}",
  "analysis": "## 分析报告\n\n...",
  "createdAt": "2026-05-29T10:30:00Z"
}
```

### GET /api/scripts/runs
获取历史运行记录

## 运行流程

1. **用户操作**：选择脚本 → 填写参数 → 点击运行
2. **前端**：POST `/api/scripts/strategies/[id]/run` → 轮询 `/api/scripts/runs/[id]` 获取状态
3. **后端**：
   - 创建 `ScriptRun` 记录（status: pending）
   - 启动子进程：`python scripts/xxx.py --date xxx`
   - 捕获 stdout，解析 JSON
   - 更新 `ScriptRun`（status: completed, result: JSON）
   - 调用 AI 分析结果
   - 更新 `ScriptRun`（analysis: AI报告）
4. **前端**：展示结果和 AI 分析报告

## AI 分析

### Prompt 模板
```
你是一个专业的股票策略分析师。请分析以下脚本运行结果：

## 策略概述
{strategyName}

## 原始结果
{result}

## 要求
1. 总结策略表现
2. 指出值得关注的信号
3. 提示潜在风险
4. 用 Markdown 格式输出

请用中文回复。
```

## 目录结构

```
scripts/
├── screen_today_signals.py    # 今日信号检测
├── screen_low_rebound.py      # 底背离策略回测
└── gen-invite-code.ts        # (现有)

app/
├── api/
│   └── scripts/
│       ├── strategies/
│       │   ├── route.ts           # GET/POST /api/scripts/strategies
│       │   └── [id]/
│       │       ├── route.ts       # GET/PUT/DELETE /api/scripts/strategies/[id]
│       │       └── run/
│       │           └── route.ts   # POST /api/scripts/strategies/[id]/run
│       └── runs/
│           ├── route.ts           # GET /api/scripts/runs
│           └── [id]/
│               └── route.ts       # GET /api/scripts/runs/[id]
```

## 实现顺序

1. 创建 Prisma Migration 添加新表
2. 实现 `/api/scripts/strategies` CRUD API
3. 实现 `/api/scripts/strategies/[id]/run` 运行 API
4. 实现 `/api/scripts/runs` 历史记录 API
5. 重构 `screen_today_signals.py` 输出 JSON 格式
6. 前端页面 Tab 切换和脚本策略 UI
7. 集成 AI 分析功能
