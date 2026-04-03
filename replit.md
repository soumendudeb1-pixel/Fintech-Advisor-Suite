# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (not used yet)
- **Validation**: Zod, `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── knowedge/           # KnowEdge AI Financial Advisor React app
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## KnowEdge - AI Financial Advisor

**App Location:** `artifacts/knowedge/` (React + Vite, serves at `/`)

### Features
- **3 User Modes**: Student (pocket money), Career (salary/tax), Retiree (pension/withdrawal)
- **Stock Market Module**: Search stocks (AAPL, MSFT, TSLA, NVDA, etc.), view details & charts
- **Probability Engine**: AI analysis showing % chance of price increase/decrease with signals
- **Historical Charts**: Area charts using Recharts with 1W/1M/3M/6M/1Y periods
- **Pocket Money Calculator**: Allowance - expenses = remaining fun money with tips
- **Salary Calculator**: Tax breakdown by state with effective/marginal rates
- **Retirement Calculator**: 4% rule, withdrawal strategies, portfolio health assessment
- **Stock Market 101**: Educational content for beginners
- **AI Advisor**: Mode-aware financial advice chatbot

### Design
- Premium dark Fintech aesthetic (deep navy/charcoal, electric blue accents)
- Light/dark mode toggle (dark default)
- Lucide React icons throughout
- Framer Motion animations
- Mobile-friendly responsive layout

### Pages
- `/` — Dashboard: Market indices (S&P 500, NASDAQ, DOW, Russell 2000), AI tip, quick actions
- `/stocks` — Stock search, details, historical chart, probability engine
- `/calculator` — Mode-specific financial calculators
- `/learn` — Stock Market 101 education
- `/advisor` — AI financial advice chat

## API Server

**Location:** `artifacts/api-server/` (Express 5, serves at `/api`)

### Endpoints
- `GET /api/stocks/market/summary` — Market indices + top gainers/losers
- `GET /api/stocks/search?q=` — Stock search
- `GET /api/stocks/:symbol` — Stock details
- `GET /api/stocks/:symbol/history?period=` — Historical prices
- `GET /api/stocks/:symbol/analysis` — AI probability analysis
- `POST /api/calculator/pocket-money` — Pocket money calculation
- `POST /api/calculator/salary` — Salary/tax breakdown
- `POST /api/calculator/retirement` — Retirement strategy
- `POST /api/ai/financial-advice` — Mode-aware AI advice
- `POST /api/chat` — LLM chat with in-memory session history (`{message, session_id?, mode}` → `{response, session_id}`)

### AI Chat Architecture
- **Service:** `src/services/aiService.ts` — OpenAI-compatible client, configurable via env vars
  - `LLM_API_KEY` — required for live LLM responses
  - `LLM_MODEL` — model name (default: `gpt-4o-mini`)
  - `LLM_BASE_URL` — override for Groq, OpenRouter, Azure, etc.
- **Fallback:** smart rule-based responses when no API key is set
- **Session store:** in-memory Map, max 1000 sessions × 20 messages, 1h TTL

### Stocks Available
AAPL, MSFT, GOOGL, AMZN, TSLA, NVDA, META, JPM, SPY, BRK.B

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/` include:
- `health.ts` — Health check
- `stocks.ts` — All stock market endpoints with simulated data
- `calculator.ts` — Financial calculators with real computation
- `ai.ts` — Mode-aware financial advice

### `artifacts/knowedge` (`@workspace/knowedge`)

React + Vite frontend. Pages in `src/pages/`:
- `dashboard.tsx` — Market overview
- `stocks.tsx` — Stock research with charts
- `calculator.tsx` — Financial calculators
- `learn.tsx` — Education section
- `advisor.tsx` — AI advisor chat

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Not actively used yet.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec. Run codegen: `pnpm --filter @workspace/api-spec run codegen`
