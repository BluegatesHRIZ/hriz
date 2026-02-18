# HRIS API - Next.js Migration

This is the Next.js migration of the HRIS_API application from ASP.NET Core/Blazor to Next.js with TypeScript.

## Project Status

### ✅ Completed (Phase 1: Foundation)

- **Next.js 16** with App Router and TypeScript
- **React Query** (TanStack Query) configured for API call caching
- **Prisma ORM** initialized for MySQL database
- **shadcn/ui** configuration ready
- **Tailwind CSS** configured
- Project structure set up

### 🚧 In Progress

- shadcn/ui component installation
- Authentication system migration

### 📋 Next Steps

1. Install shadcn/ui base components
2. Set up authentication (JWT, custom auth)
3. Migrate database schema to Prisma
4. Create API routes
5. Build UI components

## Getting Started

### Prerequisites

- Node.js 18+ 
- MySQL database
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database connection string
```

3. Set up Prisma:
```bash
# Pull schema from existing database (when ready)
npx prisma db pull

# Generate Prisma Client
npx prisma generate
```

4. Run development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
HRIS_API_Next/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (to be created)
│   ├── (auth)/            # Authentication pages (to be created)
│   ├── (dashboard)/       # Main app pages (to be created)
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── providers.tsx      # React Query provider
├── components/            # React components
│   └── ui/                # shadcn/ui components
├── lib/                   # Utilities and helpers
│   ├── api/               # API client functions
│   ├── auth/              # Authentication utilities
│   ├── db/                # Prisma client
│   ├── hooks/             # React Query hooks
│   └── utils.ts           # Utility functions
└── prisma/                # Prisma schema and migrations
    └── schema.prisma      # Database schema
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Data Fetching**: React Query (TanStack Query)
- **Database**: Prisma ORM + MySQL
- **Authentication**: Custom JWT implementation

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Deploying to Cloudflare

Deploy with:

```bash
pnpm run deploy
```

### Worker size limit (3 MiB)

The **Workers Free plan** limits each Worker to **3 MiB** (gzipped). If deploy fails with:

```
Your Worker exceeded the size limit of 3 MiB
```

**Options:**

1. **Upgrade to Workers Paid** ($5/month) for a **10 MiB** limit: [Workers plans](https://dash.cloudflare.com/?to=/:account/workers/plans).
2. **Reduce bundle size:**
   - In **Cloudflare Pages** (or your CI), set these **build** environment variables so Wrangler picks smaller Node-style builds where possible:
     - `WRANGLER_BUILD_PLATFORM` = `node`
     - `WRANGLER_BUILD_CONDITIONS` = `` (empty)
   - Add the same to `.env` for local deploys (see `.env.example`).
   - To see what’s in the bundle: use `.open-next/server-functions/default/handler.mjs.meta.json` with the [ESBuild Bundle Analyzer](https://esbuild.github.io/analyze/).

See [OpenNext Cloudflare troubleshooting](https://opennext.js.org/cloudflare/troubleshooting) and [Worker size limits](https://developers.cloudflare.com/workers/platform/limits/#worker-size).

## Migration Plan

See the migration plan document for detailed migration strategy and phases.
