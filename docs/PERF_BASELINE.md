# Nabaperks Performance Baseline

This baseline captures read-path TTFB checks that work without secrets. The
script does not follow redirects, so protected routes should show their auth
redirect status instead of hiding it behind a login flow.

## Route Matrix

| Route      | Surface                   | Auth expectation              | Healthy unauthenticated result     |
| ---------- | ------------------------- | ----------------------------- | ---------------------------------- |
| `/`        | Public landing            | None                          | `200`                              |
| `/pricing` | Public pricing            | None                          | `200`                              |
| `/start`   | Public start/on-ramp      | None                          | `200` or intentional redirect      |
| `/app`     | Merchant dashboard        | Merchant session required     | `307` or `302` to login/onboarding |
| `/q/demo`  | Customer QR redirect      | Seeded QR required            | `404` without a matching QR        |
| `/m/demo`  | Merchant public join page | Seeded merchant slug required | `404` without a matching merchant  |

For seeded QA, replace `/q/demo` and `/m/demo` with real non-secret test QR and
merchant slugs.

## Current Before

Current production/staging TTFB was not captured in this change because no
production or staging base URL and no authenticated merchant cookie were provided
for this lane. Run one of these from the repo root when the target is chosen:

```bash
pnpm perf:routes -- --base-url http://127.0.0.1:3000
pnpm perf:routes -- --base-url https://your-nabaperks-host.example
pnpm perf:routes -- --base-url https://your-nabaperks-host.example --routes /,/pricing,/start,/app,/q/<qr_id>,/m/<merchant_slug>
```

Use the unauthenticated `/app` result as an auth redirect check. Use browser or
curl cookies only for a separate authenticated merchant-dashboard baseline.

## Local After

Captured on 2026-06-15 against a local production build:

```bash
pnpm build
pnpm exec next start -H 127.0.0.1 -p 3001
pnpm perf:routes -- --base-url http://127.0.0.1:3001 --routes /,/pricing,/start,/app,/scan,/q/demo,/m/demo --runs 2 --timeout-ms 10000
```

| Route      | Status                   | Median TTFB | Samples                 |
| ---------- | ------------------------ | ----------- | ----------------------- |
| `/`        | `200`                    | `4.1ms`     | `4.3ms`, `3.9ms`        |
| `/pricing` | `200`                    | `9.8ms`     | `9.7ms`, `9.9ms`        |
| `/start`   | `200`                    | `4.3ms`     | `4.3ms`, `4.3ms`        |
| `/app`     | `307 -> /login?next=/app` | `3.8ms`     | `4.0ms`, `3.6ms`        |
| `/scan`    | `200`                    | `2.9ms`     | `3.2ms`, `2.6ms`        |
| `/q/demo`  | `200`                    | `720.2ms`   | `807.8ms`, `632.7ms`    |
| `/m/demo`  | `404`                    | `231.7ms`   | `232.8ms`, `230.7ms`    |

`/q/demo` resolves in this local dataset and remains the slowest unauthenticated
path in the matrix. Use a real seeded QR and merchant slug for production or
staging comparison runs.

## Browser Smoke

The local production server was smoke-checked in the in-app browser at
`http://127.0.0.1:3001` for `/`, `/pricing`, `/start`, `/scan`, `/app`, and
`/app/activity`. Public and scanner pages rendered, `/app` and `/app/activity`
redirected to `/login?next=/app`, and no Next.js error overlay or browser
console errors appeared during the pass.

## Runtime Loader Logging

Set `PERF_LOG=1` on a local or preview server to log server loader timings as
JSON lines:

```bash
PERF_LOG=1 pnpm dev
```

The log shape is:

```json
{ "route": "/app", "loader": "getMerchantDashboardData", "ms": 12.3 }
```
