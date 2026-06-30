# Global Context for AI Governance

These constraints apply to every future Micro-Spec unless a newer repo
instruction or an active spec explicitly overrides them.

Read `micro-specs/README.md` first. It defines the source hierarchy, lifecycle
status vocabulary, risk classes, and current verification gates.

## Product Context

Nabaperks is a UK no-app QR loyalty platform for independent local businesses.
The current repository keeps the buildable Next.js app, Supabase-backed runtime,
Stripe billing surfaces, QR flows, and the Wet Ink design system.

Use only current checked-in docs and app code as implementation truth.

## Settled Stack Decisions

- Frontend: Next.js App Router with React, hosted on Vercel.
- Backend: Next.js Route Handlers, Server Actions, and Vercel Functions.
- Database: Supabase Postgres migrations under `supabase/migrations`.
- Auth: Supabase Auth with Row Level Security for merchant/admin actors;
  customer identity uses phone verification plus signed first-party sessions.
- Payments: Stripe Billing, Customer Portal, and Stripe webhooks.
- Notifications: Resend email and Web Push support; Twilio may be used for
  customer phone verification.
- Design: `DESIGN.md` Wet Ink system.
- UI components: existing local components and shadcn-compatible conventions.

## Next.js Guidance

This repo uses Next.js `16.2.9`. Before changing app routes, Server Actions,
Route Handlers, auth, data mutation, or config, read the relevant local docs
under `node_modules/next/dist/docs/`.

Useful starting points:

- `node_modules/next/dist/docs/01-app/index.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md`
- `node_modules/next/dist/docs/01-app/02-guides/data-security.md`

## Security Baseline

- Enforce HTTPS in production.
- Keep service-role Supabase keys server-side only.
- Merchant owners may access only their own merchant account.
- Staff actions must stay scoped to their merchant/location.
- Customers may access only their own customer profile, memberships, and reward
  state.
- Stripe webhooks must verify signatures before changing billing state.
- Server-side mutation inputs must be validated.
- Sensitive secrets must never be exposed to client bundles.

## Data and Event Principles

Supabase tables are the system of record. Analytics tools are mirrors, not the
source of truth for business-critical state.

Loyalty-affecting, billing-affecting, privacy-affecting, or support-affecting
actions must remain attributable, auditable, and recoverable from server state.
Browser storage is cache only.

## Design Baseline

Wet Ink is the active visual language. Runtime styling lives in
`app/globals.css` and shared components under `components/`.

Use `DESIGN.md` for tokens, typography, interaction patterns, component
conventions, and the `/dev/design-system` catalogue. Design-source mirrors are
not runtime input.

## Verification Baseline

For any meaningful code change, run the current CI baseline:

```bash
pnpm lint
pnpm typecheck
pnpm governance:check
pnpm governance:run-gates
pnpm test
pnpm build
pnpm test:e2e
pnpm test:a11y
pnpm test:visual
```

CI also runs `pnpm tokens:check`, `pnpm claims:check`, Playwright browser
install, conditional `pnpm test:db` when `SUPABASE_DB_URL` is available, and
`pnpm jsonld:check`. Active Micro-Specs must satisfy the risk-class gate matrix
in `micro-specs/README.md`; DB-free browser checks do not satisfy RLS, billing,
webhook, ledger, or migration proof.
