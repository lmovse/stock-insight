# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stock analysis and trading strategy platform built with Next.js 16. Features include stock search with K-line charts, watchlist management, portfolio tracking, AI-powered dynamic strategies, quantitative static strategies, and technical indicators.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS 4 with custom CSS variables for theming (defined in `app/globals.css`)
- **Language**: TypeScript
- **Output**: Standalone Docker-compatible build (`output: "standalone"` in next.config.ts)
- **Auth**: JWT with jose library
- **Database**: SQLite with Prisma ORM

### Theme System

Theme is implemented via CSS custom properties in `app/globals.css`:
- Dark mode (default): salmon accent (`--accent: #fb7185`), dark backgrounds
- Light mode: rose accent (`--accent: #f43f5e`), light backgrounds
- Toggled via `ThemeToggle` component, persisted to localStorage

Key files:
- `components/ThemeProvider.tsx` - Theme context with system/dark/light options
- `components/ThemeToggle.tsx` - Cycle button (system → dark → light)

### Dependencies

- `gray-matter`, `react-markdown`, `remark-gfm`, `rehype-highlight` - Markdown processing
- `isomorphic-git` - Git operations
- `jszip` - Package file handling
- `jose` - JWT authentication
- `hqchart` - K-line charts

## Project Structure

```
├── app/
│   ├── api/                    # API routes
│   │   ├── auth/              # Authentication (login, register, logout, me)
│   │   ├── config/            # System configuration (categories, stocks)
│   │   ├── portfolio/         # Position and trade management
│   │   ├── prompts/           # AI prompt templates
│   │   ├── strategies/         # Strategy CRUD
│   │   ├── strategy-runs/      # Strategy execution history
│   │   ├── stocks/             # Stock data (search, kline, sync)
│   │   ├── scripts/            # Static script strategies
│   │   └── watchlist/          # Watchlist management
│   ├── config/                 # System configuration page
│   ├── favorites/              # Watchlist page
│   ├── login/                  # Login page
│   ├── prompts/                # Prompt management pages
│   ├── register/               # Registration page
│   ├── strategies/             # Strategy pages
│   │   └── runs/               # Strategy run history and detail
│   └── stock/[code]/           # Stock detail page
├── components/
│   ├── config/                 # Configuration components
│   ├── HQChart.tsx             # K-line chart component
│   ├── IndicatorPanel.tsx      # Technical indicators panel
│   ├── IndicatorModal.tsx      # Indicator parameter settings
│   ├── PortfolioPanel.tsx      # Position management
│   ├── ScriptStrategyList.tsx  # Static strategy list
│   ├── StockSearch.tsx         # Stock search component
│   ├── StockSelector.tsx       # Stock multi-select
│   ├── StrategyRunner.tsx      # Strategy execution
│   ├── WatchlistPanel.tsx       # Watchlist panel
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

## Styling Conventions

- Uses CSS custom properties via Tailwind's `@theme inline` directive
- Custom fonts: Plus Jakarta Sans (display), DM Mono (code)
- Grid background pattern, subtle grain overlay, industrial scrollbar styling
- hljs syntax highlighting theme

## Python Scripts

**Python interpreter path** (important):
- Prefer project venv: `.venv/bin/python`
- Fallback: `python3`
- Production may not have `python` command - must use `python3`

```typescript
// Correct pattern
const VENV_PYTHON = path.resolve(process.cwd(), ".venv/bin/python");
const PYTHON_CMD = existsSync(VENV_PYTHON) ? VENV_PYTHON : "python3";
```

**Database path**:
- Never hardcode `prisma/dev.db` - must use environment variable
- Python: `os.environ.get("DATABASE_PATH", "prisma/dev.db")`
- Node.js: `process.env.DATABASE_URL?.replace("file:", "")`

## Database & Migrations

**Schema change rules**:
- Any `schema.prisma` modification requires a corresponding migration file
- Migration files go in `prisma/migrations/` directory
- Naming format: `YYYYMMDDHHMMSS_description/migration.sql`
- Never modify production database tables directly - always use migration

**Migration notes**:
- SQLite's `ALTER TABLE ADD COLUMN` does not support `IF NOT EXISTS`
- Table rename requires `PRAGMA foreign_keys=off`
- Rebuilding tables with FK constraints requires disabling FK first
- After failed migration, mark as complete: `npx prisma migrate resolve --applied <migration_name>`
