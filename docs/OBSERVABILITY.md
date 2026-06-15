# Observability & operations

How Nabaperks is made debuggable in production. Everything here is
provider-agnostic by default (AGENTS.md keeps Sentry/OTel optional); the seams to
plug a vendor in are called out.

## Request / trace correlation

- [`proxy.ts`](../proxy.ts) (Next.js 16 Proxy, formerly middleware) gives every
  request a stable id. It reuses an inbound `x-request-id` header (e.g. from a
  load balancer) or mints a UUID via [`lib/observability/request-id.ts`](../lib/observability/request-id.ts).
- The id is forwarded to Server Components and Route Handlers on the request
  headers and echoed on the response `x-request-id` header, so a user-reported
  id ties the client response to server logs.
- In a Server Component or Route Handler, read it with
  `(await headers()).get("x-request-id")` and pass it to `logger.child({ requestId })`.

## Structured logging

- [`lib/observability/logger.ts`](../lib/observability/logger.ts) emits one JSON
  line per event (`level`, `time`, `message`, plus context). Vercel log drains
  and any downstream collector can parse it without bespoke regexes.
- Prefer `logger.child({ requestId, merchantId })` to bind context once per
  request instead of repeating fields.

## Error tracking

- [`instrumentation.ts`](../instrumentation.ts) exports Next's `onRequestError`,
  which captures **server** errors with router/route/request context (including
  the request id) as structured `request.error` records.
- **To add a vendor** (Sentry, PostHog error tracking, OTel): initialise the SDK
  in `register()` and forward the captured error inside `onRequestError`. No
  application code needs to change.

## Health & readiness

- [`GET /api/health`](../app/api/health/route.ts) is a cheap, public, uncacheable
  liveness probe returning `{ status, service, version, uptime, time }` with a 200. Use it for uptime monitors, load-balancer checks, and post-deploy smoke
  tests.
- Deeper dependency checks (DB, Stripe) intentionally live elsewhere so this
  probe stays cheap and safe to expose.

## Resilience for external calls

- [`lib/observability/resilience.ts`](../lib/observability/resilience.ts) provides
  bounded exponential-backoff retry (`withRetry`), a per-service `CircuitBreaker`,
  and `resilientFetch`. 5xx/network failures are retried then surface as
  `HttpError`; 4xx is returned unretried.
- Wired into Twilio ([`lib/notifications/twilio.ts`](../lib/notifications/twilio.ts)),
  Resend ([`lib/notifications/resend.ts`](../lib/notifications/resend.ts)), and
  Nominatim geocoding ([`lib/merchant/geocode.ts`](../lib/merchant/geocode.ts)).
  Stripe and Supabase use their SDK's own retry logic.

## Deployment observability

- `register()` logs a `server.start` record per server instance with
  `runtime`, `nodeEnv`, `commit` (`VERCEL_GIT_COMMIT_SHA`), and `region`
  (`VERCEL_REGION`) so deploys are visible in the log stream.
- Release notes are drafted automatically by `release-drafter` on every push to
  `main` (see [`.github/release-drafter.yml`](../.github/release-drafter.yml)).

## Alerting (recommended setup)

These are operator actions on the hosting providers, not code:

1. **Uptime / health** — point an external monitor (Vercel Monitoring, Better
   Stack, Pingdom, or a GitHub-scheduled curl) at `/api/health`; alert on
   non-200 or latency regression.
2. **Errors** — create a Vercel **Log Drain** (or PostHog/Sentry) and alert on
   `level":"error"` / `message":"request.error"` volume.
3. **Billing & webhooks** — alert on Stripe webhook signature failures
   (`message":"request.error"` from `/api/stripe/webhook`).
4. **Database** — enable Supabase project alerts (connection saturation, error
   rate) and daily backups (PITR when tolerance lowers — see AGENTS.md).

Set the `DAST_TARGET_URL` repo variable to enable the scheduled ZAP baseline
scan ([`.github/workflows/dast.yml`](../.github/workflows/dast.yml)).

## Profiling & build performance

- `pnpm perf:routes` — per-route server-loader timings (`PERF_LOG=1`).
- `pnpm analyze` — `@next/bundle-analyzer` visual treemap (`ANALYZE=true`).
- `pnpm bundle:size` — fails CI if the client bundle exceeds its budget.
- `pnpm deps:analyze` — installed footprint of each production dependency.
