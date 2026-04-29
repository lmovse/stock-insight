# Stock Insight

A modern stock analysis and trading strategy platform built with Next.js 16.

## Features

- **Stock Search** - Search stocks by code, name, or pinyin with real-time kline charts
- **Watchlist** - Organize favorite stocks into custom groups
- **Portfolio Tracking** - Track positions, average cost, and trade history
- **Trading Strategies** - Create and backtest trading strategies with customizable prompts
- **Technical Indicators** - MA, EMA, MACD, RSI, Bollinger Bands, and more
- **Drawing Tools** - Trend lines, Fibonacci, horizontal lines, and annotations
- **AI-Powered Analysis** - OpenAI-compatible API integration for strategy execution
- **Theme Support** - Dark and light modes with industrial-style UI

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: SQLite with Prisma ORM
- **Styling**: Tailwind CSS 4
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
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── stock/[code]/       # Stock detail page
│   ├── strategies/        # Strategy management
│   └── ...
├── components/             # React components
├── prisma/                 # Database schema
├── jobs/                   # Sync jobs
└── Dockerfile
```

## License

MIT
