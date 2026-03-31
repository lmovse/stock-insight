# Stock Insight — 设计文档

## 1. 产品定位

面向散户/个人投资者的股票分析工具，以专业级K线图和技术指标为核心，支持自选股管理、持仓跟踪和数据同步。

## 2. 技术架构

### 框架与语言
- **前端**: Next.js 16 + App Router + TypeScript
- **样式**: Tailwind CSS 4 + CSS自定义属性
- **图表**: TradingView Lightweight Charts
- **后端**: Next.js API Routes（自研）
- **数据库**: TBD（PostgreSQL 或 SQLite）
- **认证**: 邮箱注册 + JWT

### 数据来源
免费股票数据API：
- AKShare（A股主力）
- Tushare（补充数据源）
- Yahoo Finance（港股、美股）

## 3. 视觉风格

### 色彩系统
| 变量 | 值 | 用途 |
|------|-----|------|
| `--accent` | `#E53935` | 中国红，强调色/涨 |
| `--accent-dim` | `#B71C1C` | 深红，暗调强调 |
| `--background` | `#0A0A0A` | 背景色 |
| `--surface` | `#111111` | 卡片/面板背景 |
| `--surface-elevated` | `#1A1A1A` | 悬浮层背景 |
| `--border` | `#2A2A2A` | 边框 |
| `--text-primary` | `#FFFFFF` | 主文字 |
| `--text-secondary` | `#888888` | 次要文字 |
| `--link` | `#FF6B6B` | 链接色（红色系） |

### 字体
- **数据/代码**: JetBrains Mono
- **界面文字**: Archivo

### 涨跌色规则
- 涨（正数）: 红色 `#E53935`
- 跌（负数）: 绿色 `#4CAF50`
- 平盘: 默认文字色

### 布局结构
```
┌─────────────────────────────────────────────────────┐
│ Header: Logo + 搜索框 + 主题切换 + 用户头像           │
├───────────────────────────────────┬─────────────────┤
│                                   │  自选股列表       │
│                                   │  （可折叠）       │
│       K线图主区域                  ├─────────────────┤
│       (TradingView Lightweight)    │  技术指标面板    │
│                                   │  （参数可调）     │
│                                   ├─────────────────┤
│                                   │  持仓记录        │
│                                   │  （盈亏统计）     │
└───────────────────────────────────┴─────────────────┘
```

## 4. 功能模块

### P0 — MVP

#### 4.1 K线图
- 支持日/周/月K线切换
- 支持分时图
- 支持鼠标滚轮缩放、拖拽平移
- 显示OHLC数据、成交量
- 支持十字光标

#### 4.2 技术指标（专业级）
- 均线系统：MA5, MA10, MA20, MA60, MA120, MA250
- MACD（参数可调：12,26,9）
- KDJ（参数可调：9,3,3）
- 布林带（参数可调：20,2）
- RSI（参数可调：14）
- 成交量（VOL）
- 指标可叠加、可独立显示/隐藏

#### 4.3 A股数据加载
- 沪深交易所实时/历史行情
- 支持上交所、深交所、京交所
- 股票搜索（代码或名称模糊匹配）
- 股票URL跳转（如 `/stock/600519`）

### P1

#### 4.4 自选股管理
- 自选股分组（多个分组）
- 添加/删除自选股
- 分组内排序（按代码/名称/添加时间）
- 云端同步

#### 4.5 持仓记录
- 记录买入：股票代码、买入价、买入量、买入日期
- 记录卖出：卖出价、卖出量、卖出日期
- 自动计算：持仓成本、盈亏金额、盈亏率
- 持仓概览统计

#### 4.6 用户系统
- 邮箱注册 + 登录
- JWT认证
- 数据云端同步

### P2

#### 4.7 画线工具
- 趋势线
- 斐波那契回撤
- 水平支撑/阻力线
- 文字标注

#### 4.8 指标参数自定义
- 所有指标参数可调
- 参数配置保存到个人账户

#### 4.9 提醒系统
- 价格提醒（高于/低于指定价）
- 涨跌提醒（幅度超过X%）
- 异动提醒（成交量放大）

## 5. 页面结构

| 路由 | 页面 |
|------|------|
| `/` | 首页（K线图 + 右侧面板） |
| `/stock/[code]` | 指定股票K线页 |
| `/watchlist` | 自选股管理页 |
| `/portfolio` | 持仓记录页 |
| `/login` | 登录页 |
| `/register` | 注册页 |
| `/settings` | 设置页（指标参数、主题等） |

## 6. 数据模型

### 用户
```
User {
  id: string
  email: string
  passwordHash: string
  createdAt: datetime
}
```

### 自选股
```
WatchlistItem {
  id: string
  userId: string
  stockCode: string  // e.g. "600519"
  groupId: string
  addedAt: datetime
}
```

### 自选股分组
```
WatchlistGroup {
  id: string
  userId: string
  name: string
  order: number
}
```

### 持仓记录
```
Position {
  id: string
  userId: string
  stockCode: string
  shares: number        // 持股数量
  avgCost: number      // 平均成本
  createdAt: datetime
}
```

### 交易记录
```
Trade {
  id: string
  userId: string
  stockCode: string
  type: "BUY" | "SELL"
  price: number
  shares: number
  tradedAt: datetime
}
```

### 图表配置
```
ChartConfig {
  id: string
  userId: string
  indicators: IndicatorConfig[]  // 各指标参数
  theme: "dark" | "light"
}
```

## 7. API 设计

### 认证
- `POST /api/auth/register` — 注册
- `POST /api/auth/login` — 登录，返回JWT
- `GET /api/auth/me` — 获取当前用户

### 股票数据
- `GET /api/stocks/search?q=` — 搜索股票
- `GET /api/stocks/[code]` — 获取股票基本信息
- `GET /api/stocks/[code]/kline?period=day&count=300` — 获取K线数据

### 自选股
- `GET /api/watchlist` — 获取自选股列表
- `POST /api/watchlist` — 添加自选股
- `DELETE /api/watchlist/[id]` — 删除自选股
- `GET /api/watchlist/groups` — 获取分组
- `POST /api/watchlist/groups` — 创建分组

### 持仓
- `GET /api/portfolio/positions` — 获取持仓列表
- `POST /api/portfolio/positions` — 添加持仓
- `PUT /api/portfolio/positions/[id]` — 更新持仓
- `DELETE /api/portfolio/positions/[id]` — 删除持仓
- `POST /api/portfolio/trades` — 记录交易

### 配置
- `GET /api/config/chart` — 获取图表配置
- `PUT /api/config/chart` — 更新图表配置

## 8. 实现优先级

### Phase 1: MVP
1. 项目结构搭建（Next.js 16 + Tailwind CSS 4）
2. 主题系统（中国红深色主题）
3. K线图集成（TradingView Lightweight Charts）
4. A股数据接入（AKShare）
5. 基础技术指标（均线、MACD、KDJ、布林带、RSI）
6. 股票搜索 + URL跳转

### Phase 2: 用户系统
1. 邮箱注册/登录
2. JWT认证
3. 自选股CRUD + 云端同步
4. 持仓记录 + 盈亏计算

### Phase 3: 高级功能
1. 画线工具
2. 自定义指标参数
3. 提醒系统
4. 分时图
