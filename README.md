# Stock Insight

A modern stock analysis and trading strategy platform built with Next.js 16.

## Features

### Stock Analysis
- **K-Line Charts** - Interactive charts with multiple time periods (15分钟、60分钟、日线、周线、月线)
- **Technical Indicators** - MA、EMA、MACD、RSI、BOLL、KDJ with customizable parameters
- **Stock Search** - Search stocks by code, name, or pinyin
- **Watchlist** - Organize favorite stocks into custom groups with market data

### Trading Strategies
- **Dynamic Strategies (AI)** - Create AI-powered strategies using customizable prompts to analyze stocks
- **Static Strategies (Script)** - Quantitative screening based on technical indicator conditions
- **Strategy Execution** - Backtest strategies with historical data and configurable date ranges
- **Run History** - Track and review past strategy execution results
- **AI Analysis Logs** - View detailed AI analysis requests and responses

### AI Integration
- **Prompt Templates** - Create and manage reusable AI analysis prompts
- **OpenAI-Compatible API** - Flexible AI backend integration

### User System
- **Authentication** - JWT-based login and registration
- **Data Isolation** - User-specific data separation

### System Configuration
- **Category Management** - Organize stocks into custom categories
- **Stock Configuration** - Configure stocks with custom purposes and metadata

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: SQLite with Prisma ORM
- **Styling**: Tailwind CSS 4 with CSS custom properties
- **Charts**: HQChart
- **Auth**: JWT with jose

## Getting Started

```bash
# Install dependencies
npm install

# Set up database
npx prisma db push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Docker

```bash
# Build image
docker build -t stock-insight .

# Run container
docker run -p 3000:3000 --env-file .env stock-insight
```

## Environment Variables

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - SQLite database path
- `JWT_SECRET` - Secret key for JWT tokens
- `TUSHARE_TOKEN` - Tushare API token for stock data
- `OPENAI_API_KEY` - OpenAI API key for strategy analysis

## Project Structure

```
├── app/
│   ├── api/                    # API routes
│   │   ├── auth/              # Authentication (login, register, logout, me)
│   │   ├── config/            # System configuration (categories, stocks)
│   │   ├── portfolio/         # Position and trade management
│   │   ├── prompts/           # AI prompt templates
│   │   ├── strategies/        # Strategy CRUD
│   │   ├── strategy-runs/     # Strategy execution history
│   │   ├── stocks/            # Stock data (search, kline, sync)
│   │   ├── scripts/           # Static script strategies
│   │   └── watchlist/         # Watchlist management
│   ├── config/                # System configuration page
│   ├── favorites/             # Watchlist page
│   ├── login/                 # Login page
│   ├── prompts/               # Prompt management pages
│   ├── register/              # Registration page
│   ├── strategies/             # Strategy pages
│   │   ├── runs/              # Strategy run history and detail
│   │   └── [id]/              # Strategy detail page
│   └── stock/[code]/          # Stock detail page
├── components/
│   ├── config/                # Configuration components
│   ├── HQChart.tsx            # K-line chart component
│   ├── IndicatorPanel.tsx      # Technical indicators panel
│   ├── IndicatorModal.tsx      # Indicator parameter settings
│   ├── PortfolioPanel.tsx      # Position management
│   ├── ScriptStrategyList.tsx  # Static strategy list
│   ├── StockSearch.tsx         # Stock search component
│   ├── StockSelector.tsx       # Stock multi-select
│   ├── StrategyForm.tsx        # Strategy form
│   ├── StrategyList.tsx        # AI strategy list
│   ├── StrategyRunner.tsx      # Strategy execution
│   ├── SyncConfirmModal.tsx    # Data sync confirmation
│   ├── WatchlistPanel.tsx      # Watchlist panel
│   └── ...
├── lib/
│   ├── auth.ts                # JWT authentication
│   ├── indicators.ts           # Technical indicator calculations
│   ├── prisma.ts              # Prisma client
│   └── types.ts               # TypeScript types
├── prisma/
│   └── schema.prisma          # Database schema
└── jobs/
    └── sync.ts                # Data sync jobs
```

## License

MIT
