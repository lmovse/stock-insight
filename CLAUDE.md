# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 16 application with App Router. The project is in early stages - the core structure exists but most features have not been implemented yet. The project name in package.json is "skills".

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

### Theme System

Theme is implemented via CSS custom properties in `app/globals.css`:
- Dark mode (default): yellow accent (`--accent: #ffd60a`), dark backgrounds
- Light mode: gold accent (`--accent: #d9a300`), light backgrounds
- Toggled via `ThemeToggle` component, persisted to localStorage

Key files:
- `components/ThemeProvider.tsx` - Theme context with system/dark/light options
- `components/ThemeToggle.tsx` - Cycle button (system → dark → light)

### Dependencies (indicating planned features)

- `gray-matter`, `react-markdown`, `remark-gfm`, `rehype-highlight` - Markdown processing
- `isomorphic-git` - Git operations
- `jszip` - Package file handling

### Rewrites

`next.config.ts` rewrites `/.well-known/skills/index.json` to `/.well-known/skills`, suggesting skills data lives at that path.

## Project Structure

```
├── app/                    # Next.js App Router
│   └── globals.css         # Tailwind + custom CSS variables + syntax highlighting
├── components/
│   ├── ThemeProvider.tsx   # Theme context
│   └── ThemeToggle.tsx     # Theme cycle button
├── lib/
│   └── utils.ts            # Utility functions (formatDate)
├── public/                 # Static assets
├── next.config.ts          # Next.js config with rewrites
├── package.json
└── tsconfig.json           # Path alias: @/* → ./*
```

## Styling Conventions

- Uses CSS custom properties via Tailwind's `@theme inline` directive
- Custom fonts: Archivo (display), JetBrains Mono (code)
- Grid background pattern, subtle grain overlay, industrial scrollbar styling
- hljs syntax highlighting theme (github-dark)
