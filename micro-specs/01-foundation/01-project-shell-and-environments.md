# Micro-Spec: Project Shell and Environments

## Exact Goal and User-Visible Outcomes

The app foundation is ready for MVP development and deployment. A developer can run the Next.js app locally, configure environment variables for Supabase, Stripe, PostHog, and Resend, and deploy the same route structure to Vercel without hidden setup.

## Blast Radius

In scope:

- `app/`, `components/`, `lib/`, `hooks/`, and configuration files required for Next.js app foundation.
- Environment variable examples and validation helpers.
- Vercel, Supabase, Stripe, PostHog, and Resend integration placeholders where needed.
- Project documentation updates when setup requirements change.

Out of scope:

- Implementing full business workflows.
- Creating production Supabase projects or Stripe products manually.
- Adding new UI libraries without approval.
- Changing the MVP product scope.

## Strict Constraints and Assumptions

- Use Next.js App Router patterns for pages, layouts, Server Actions, and Route Handlers.
- Read local Next.js docs before coding APIs affected by Next.js 16.2.6 changes.
- Required secrets must be read server-side unless they are intentionally public client keys.
- Missing or invalid required environment variables must fail clearly in development and deployment checks.
- Do not expose Supabase service-role, Stripe webhook secret, or Resend API key to client bundles.

## Decisions Already Made

- Vercel hosts the app.
- Supabase is the database and auth provider.
- Stripe handles subscriptions and customer portal.
- PostHog handles funnels and product analytics.
- Resend handles transactional email.
- The design system is `DESIGN.md`.

## Behavioral Requirements

- WHEN a developer runs the local app with valid environment variables, THE app SHALL start without setup-specific runtime errors.
- WHEN a required server-only secret is missing, THE app SHALL fail with a clear configuration error before a sensitive workflow is used.
- WHEN client code is bundled, THE bundle SHALL not include service-role or webhook secrets.
- WHEN the app is deployed to Vercel, THE configured route families SHALL be compatible with the App Router structure.
- WHEN setup documentation is followed, THE developer SHALL know which variables are required for local development, preview, and production.

## Verification Criteria

Acceptance criteria:

- `pnpm typecheck` passes.
- `pnpm lint` passes.
- Environment validation covers Supabase URL/keys, Stripe keys/webhook secret, PostHog key/host, Resend key, and app URL.
- Public keys and server secrets are separated by naming and runtime usage.

Manual QA:

- Start the app locally and visit `/`.
- Confirm a missing critical server variable produces an actionable error.
- Inspect client-accessible config and confirm no service-role or webhook secret appears.

Task breakdown:

- Read relevant Next.js local docs.
- Define environment contract.
- Add or update configuration helpers.
- Verify local start, typecheck, and lint.
