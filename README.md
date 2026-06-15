# Nabaperks

Nabaperks is a no-app QR loyalty MVP for local merchants and their customers.
It is built as a Next.js App Router application with Supabase-backed auth/data,
Stripe billing, QR redirect flows, and internal admin tooling.

The repo is governed by Micro-Specs: small, traceable slices of intent with
stable requirement IDs, lifecycle metadata, blast-radius controls, and CI-backed
quality gates.

The frontend has been redesigned around the Honey & Ink / Tactile Modernism
system: warm paper surfaces, espresso ink typography, honey reward moments,
rounded tactile controls, and mobile-first loyalty workflows.

## Stack

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS 4 with shadcn/ui component conventions
- Supabase Auth/Postgres/RLS for application data boundaries
- Stripe Billing and customer portal flows
- QR code generation and `/q/{qr_id}` redirect handling
- Optional PostHog analytics and Resend email integration

## Local setup

Install dependencies and run the development server:

```bash
pnpm install
pnpm dev
```

Visit `http://localhost:3000`.

## Key scripts

```bash
pnpm dev              # Start the local Next.js dev server
pnpm lint             # Run ESLint
pnpm typecheck        # Run TypeScript checks
pnpm test             # Run Vitest tests
pnpm build            # Build the app
pnpm env:check        # Validate required environment variables
pnpm env:keys         # Show provider key setup/status guidance
pnpm db:setup         # Apply, seed, and test Supabase SQL locally
pnpm db:test:rls      # Run Supabase RLS tests
pnpm security:verify  # Run security verification checks
pnpm governance       # Validate Micro-Spec metadata and traceability
pnpm check:agents     # Validate AGENTS.md governance coverage
pnpm quality          # Run aggregate governance and quality gates
```

## AI governance

The source-of-truth hierarchy starts with the Micro-Spec backlog in
`micro-specs/`, with global constraints in `micro-specs/GLOBAL_CONTEXT.md` and
the governance contract in `micro-specs/README.md`. The governance layer
enforces lifecycle metadata, stable requirement IDs, Markdown and JSON
traceability, fixture-backed tests, strict CI gates, ownership handoffs, and
blast-radius checks so implementation stays aligned with declared intent.

## Environment variables

Copy `.env.example` to `.env.local` and fill the values for your Supabase,
Stripe, optional PostHog, Resend, and app URL setup.

```bash
cp .env.example .env.local
pnpm env:check
```

For provider CLI commands and key sources, run:

```bash
pnpm env:keys
```

See `docs/ENV_KEYS.md` for the full key setup guide.

For an as-built map of routes, data/RLS boundaries, core flows, integrations,
spec traceability, and known gaps, see `docs/ARCHITECTURE.md`.

Use the same variable names in Vercel for Preview and Production. Values may
differ between environments, but the contract is the same:

| Variable                             |        Runtime | Purpose                                                               |
| ------------------------------------ | -------------: | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                | Browser/server | Canonical app origin for links, QR redirects, and Stripe return URLs. |
| `NEXT_PUBLIC_SUPABASE_URL`           | Browser/server | Supabase project URL.                                                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | Browser/server | Supabase anon key protected by Row Level Security.                    |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Browser/server | Stripe publishable key for client-side Stripe flows.                  |
| `NEXT_PUBLIC_POSTHOG_KEY`            | Browser/server | Optional PostHog project key for product analytics.                   |
| `NEXT_PUBLIC_POSTHOG_HOST`           | Browser/server | Optional PostHog host URL.                                            |
| `SUPABASE_SERVICE_ROLE_KEY`          |    Server only | Privileged Supabase key for trusted server-side code only.            |
| `STRIPE_SECRET_KEY`                  |    Server only | Stripe API secret for billing and portal calls.                       |
| `STRIPE_GROWTH_PRICE_ID`             |    Server only | Stripe recurring Price ID for the GBP 29/month Growth Plan.           |
| `STRIPE_WEBHOOK_SECRET`              |    Server only | Stripe webhook signature verification secret.                         |
| `RESEND_API_KEY`                     |    Server only | Resend API key for transactional email.                               |

Server-only values must not use the `NEXT_PUBLIC_` prefix. Public values are
safe to bundle into browser JavaScript, but still rely on Supabase RLS and
server-side authorization for protection.

## Frontend redesign and component architecture

The completed redesign spans the public marketing/auth/legal pages, merchant
app, customer and staff mobile flows, admin console, QR assets, and shared
component foundation while preserving backend contracts.

Shared UI is organized around:

- shadcn-compatible primitives in `components/ui`
- Honey & Ink layout shells for marketing, app, and mobile surfaces
- brand, loyalty, form, data-display, and QR primitives for repeated product
  patterns
- route-specific composition in `app` with backend/API contracts kept stable

Design tokens and visual rules live in `DESIGN.md`.

## Validation notes

Validation gates passed across redesign milestones. The final user-testing
validator reported all 46 customer, staff, admin, and QR assertions passing,
with validation state expected to be all passed.

Known limitation: real Supabase anon-auth browser E2E was out of scope because
the provided anon key was invalid. Protected/auth flows were covered through
public browser smoke checks plus static and programmatic validation.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```
