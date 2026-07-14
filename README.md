# Nabaperks

Nabaperks is a Next.js App Router loyalty app with Supabase-backed auth/data,
Stripe billing, QR flows, and a retained Wet Ink design system.

## Stack

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS 4 with shadcn-compatible primitives
- Supabase Auth/Postgres/RLS
- Stripe Billing and webhooks
- QR code generation and `/q/{qr_id}` redirects

## Local Setup

```bash
pnpm install
pnpm dev
```

Visit `http://localhost:3000`.

## Build Scripts

```bash
pnpm dev        # Start the local Next.js dev server
pnpm typecheck  # Run TypeScript checks
pnpm lint       # Run ESLint
pnpm test       # Run contract and unit tests
pnpm build      # Build the app
pnpm start      # Start a production build locally
```

## Optional Checks

```bash
pnpm test:db               # Run live DB/RLS proof; requires SUPABASE_DB_URL
pnpm test:e2e              # Run Playwright e2e projects
pnpm test:e2e:ui           # Open Playwright UI mode
pnpm test:e2e:headed       # Run Playwright in headed mode
pnpm test:a11y             # Run Playwright accessibility smoke tests
pnpm test:visual           # Run Playwright visual smoke tests
pnpm tokens:check          # Check design token constraints
pnpm claims:check          # Check banned marketing claims
pnpm jsonld:check          # Check structured data after build
```

## Environment

Copy `.env.example` to `.env.local` and fill the values for Supabase, Stripe,
optional PostHog, Resend, Twilio, and the app URL.

```bash
cp .env.example .env.local
pnpm env:check
pnpm env:keys
```

## Database Helpers

```bash
pnpm db:migrate             # Apply Supabase migrations
pnpm db:seed                # Seed local fixtures
pnpm db:setup               # Apply migrations and seed local fixtures
pnpm db:reset               # Reset a local disposable database
pnpm db:clean:customers     # Clear local customer data
pnpm db:reset:today-stamps  # Clear local current-day stamp data
```

The database runner refuses write-risk operations against non-local database
hosts.

## Design System

`DESIGN.md` is the design-system source of truth. Runtime styling and primitives
live in `app/globals.css`, `components/brand`, `components/ui`,
`components/motion`, and `components/loyalty`. The `/dev/design-system` route is
the live catalogue when dev harness routes are enabled.
