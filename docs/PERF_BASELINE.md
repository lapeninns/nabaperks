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

| Route      | Status                    | Median TTFB | Samples              |
| ---------- | ------------------------- | ----------- | -------------------- |
| `/`        | `200`                     | `4.1ms`     | `4.3ms`, `3.9ms`     |
| `/pricing` | `200`                     | `9.8ms`     | `9.7ms`, `9.9ms`     |
| `/start`   | `200`                     | `4.3ms`     | `4.3ms`, `4.3ms`     |
| `/app`     | `307 -> /login?next=/app` | `3.8ms`     | `4.0ms`, `3.6ms`     |
| `/scan`    | `200`                     | `2.9ms`     | `3.2ms`, `2.6ms`     |
| `/q/demo`  | `200`                     | `720.2ms`   | `807.8ms`, `632.7ms` |
| `/m/demo`  | `404`                     | `231.7ms`   | `232.8ms`, `230.7ms` |

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

## Card-006 Stamp Motion Bundle Closeout

Captured on 2026-06-24 from branch
`codex/customer-routes-performance-audit-fix`.

Finding `card-006` from
`.claude/worktrees/thirsty-archimedes-667ecd/docs/PERF_AUDIT_CUSTOMER_ROUTES_2026-06-24.md:67`
was closed with measurement only. No production motion code changed, and no
`LazyMotion`, dynamic import, or repo-wide motion migration was implemented.

Commands:

```bash
pnpm build
pnpm qa:perf
node <chunk inspection script recorded in .omo evidence logs>
```

Measured output:

- `pnpm build`: PASS, Next.js 16.2.9 production build completed.
- `pnpm qa:perf`: PASS.
- `pnpm bundle:size`: client bundle `2060 KB` across `50` chunks, under the
  `2500 KB` budget.
- `/card/[membershipId]/stamp` initial JS entry from
  `.next/server/app/card/[membershipId]/stamp/page_client-reference-manifest.js`
  contains `8` chunks totaling `386,508` bytes raw / `118,589` bytes gzip.
- Local motion wrappers are present in the initial entry:
  `static/chunks/3kc1-2iht8h09.js` is `32,654` bytes raw / `10,589` bytes gzip
  and includes `StampCelebration`, `WetInkShake`, `WetInkPop`, and `WetInkSlam`.
- The motion-runtime-bearing chunk is
  `static/chunks/1jp8-a7akegsm.js`, `140,133` bytes raw / `45,454` bytes gzip,
  with motion runtime markers including `motionValue`.
- `components/customer/stamp-collector.tsx`,
  `components/motion/wet-ink.tsx`, and
  `components/motion/stamp-celebration.tsx` are all mapped as `async=false`
  client modules for the stamp route, confirming a celebration-only dynamic
  import would not remove the always-visible motion path.

Verdict: PASS for this audit task. The motion runtime is confirmed in the stamp
route initial client chunk, but the measured bundle remains under the existing
repo budget and the source audit classified `card-006` as negligible /
informational. A future optimization should be a separately approved repo-wide
motion migration only if a new budget target is introduced.

## Task 13 Final Baseline

Captured on 2026-06-24 from branch
`codex/customer-routes-performance-audit-fix`.

### Disposable DB / Local Stack Safety

The configured targets were local and redacted as:

- `SUPABASE_DB_URL=postgresql://127.0.0.1:54322 path=/postgres`
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 path=/`

`pnpm env:check` passed, but `supabase status` failed because Docker was not
available:

```text
failed to inspect container health: Cannot connect to the Docker daemon at unix:///Users/amankumarshrestha/.docker/run/docker.sock. Is the docker daemon running?
```

Port `54322` was not listening. Therefore `pnpm qa:db`, `pnpm db:test:rls`,
`pnpm qa:e2e`, and `pnpm qa:visual` were not run, because there was no running
disposable DB/local stack to mutate safely. No hosted Supabase mutation was
attempted.

### Final Local Gates

| Command            | Status | Notes                                                                                                                                                                                                               |
| ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm env:check`   | PASS   | Environment configuration valid.                                                                                                                                                                                    |
| `pnpm qa:static`   | PASS   | Typecheck, lint, governance, route docs, deadcode, and duplication command completed. Existing warnings remain: one unused `_dates` test warning, quality-budget warnings, knip findings, and jscpd clone findings. |
| `pnpm qa:unit`     | PASS   | 94 test files, 749 tests passed. Mocked error-path stderr included invalid-hook-call and env-missing warnings but did not fail the run.                                                                             |
| `pnpm qa:security` | PASS   | `security:verify` passed; 10 focused test files, 74 tests passed.                                                                                                                                                   |
| `pnpm build`       | PASS   | Next.js 16.2.9 production build completed. Customer routes in scope remain dynamic in the build output.                                                                                                             |
| `pnpm qa:perf`     | PASS   | No sequential in-loop Supabase queries; client bundle `2060 KB` across `50` chunks, under the `2500 KB` budget.                                                                                                     |
| `pnpm db:verify`   | PASS   | Supabase schema verification passed.                                                                                                                                                                                |

### Route TTFB After

Local production server:

```bash
pnpm exec next start -H 127.0.0.1 -p 3001
```

Route command:

```bash
pnpm perf:routes -- --base-url http://127.0.0.1:3001 --routes /,/start,/scan,/q/demo,/m/demo --runs 3 --timeout-ms 10000
```

| Route     | Status | Median TTFB | Samples                               |
| --------- | ------ | ----------- | ------------------------------------- |
| `/`       | `200`  | `4.5ms`     | `200:5.5ms`, `200:4.5ms`, `200:3.8ms` |
| `/start`  | `200`  | `4.5ms`     | `200:8ms`, `200:4.5ms`, `200:3.9ms`   |
| `/scan`   | `200`  | `3.5ms`     | `200:3.9ms`, `200:3.5ms`, `200:3.5ms` |
| `/q/demo` | `200`  | `4.1ms`     | `200:4.5ms`, `200:4.1ms`, `200:3.9ms` |
| `/m/demo` | `200`  | `3.8ms`     | `200:4ms`, `200:3.8ms`, `200:3.2ms`   |

Seeded/authenticated route timing was not captured. The blocker was the missing
disposable Supabase stack: Docker was unavailable, local DB port `54322` was not
listening, and no authenticated customer cookie or verified seed IDs were
available. Unauthenticated `/q/demo` and `/m/demo` are route-health baselines
only, not live customer hot-path DB proof.

### Customer Route QA

The live local customer routes were checked with `curl -i` against
`http://127.0.0.1:3001`:

| Route                 | HTTP result                       | Limit                                                                        |
| --------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| `/q/demo`             | `200`                             | Renders unavailable QR/card state; not seeded QR proof.                      |
| `/m/demo`             | `200`                             | Renders fallback/health surface; not seeded merchant proof.                  |
| `/card/demo`          | `200`                             | Renders fallback/error-state health surface; not authenticated card proof.   |
| `/card/demo/stamp`    | `200`                             | Renders fallback/error-state health surface; not stamp mutation proof.       |
| `/reward/demo`        | `200`                             | Renders fallback/error-state health surface; not authenticated reward proof. |
| `/reward/demo/status` | `401`                             | Expected unauthenticated status endpoint response.                           |
| `/home`               | `307 -> /home/login?next=%2Fhome` | Expected unauthenticated redirect.                                           |
| `/scan`               | `200`                             | Public scanner shell rendered.                                               |
| `/start`              | `200`                             | Public customer start shell rendered.                                        |

The required mock/customer-flow substitution initially failed because the dev
harness gate was missing from the package-script invocation:

```bash
CUSTOMER_DEV_OTP_CODE=424242 pnpm customer-flow:capture-mocks
CUSTOMER_DEV_OTP_CODE=424242 pnpm exec playwright test tests/e2e/customer-flow-harness-screenshots.spec.ts tests/e2e/customer-home-surfaces.spec.ts
```

The package script was corrected on 2026-06-24 to start Playwright with the
explicit harness gate:

```bash
CUSTOMER_FLOW_DEV_HARNESS_ENABLED=true playwright test tests/e2e/customer-flow-harness-screenshots.spec.ts
```

Corrected reruns:

```bash
CUSTOMER_DEV_OTP_CODE=424242 pnpm customer-flow:capture-mocks
CUSTOMER_FLOW_DEV_HARNESS_ENABLED=true CUSTOMER_DEV_OTP_CODE=424242 pnpm exec playwright test tests/e2e/customer-flow-harness-screenshots.spec.ts
```

Both corrected mock-harness commands passed with `1 passed`, and refreshed the
DB-free mock customer-flow screenshots under `docs/screenshots/customer-flow/`.
Evidence:

- `.omo/evidence/customer-routes-performance-audit-fix/task-13-mock-harness-rerun.md`
- `.omo/evidence/customer-routes-performance-audit-fix/logs/task-13-capture-mocks-rerun.log`
- `.omo/evidence/customer-routes-performance-audit-fix/logs/task-13-direct-harness-rerun.log`

- The real-session customer home failure was not rerun: `/q/old-crown-girton-qr`
  previously rendered
  `Card unavailable` / `QR unavailable`, so the expected join heading
  `Keep your card on your phone` was not found. That DB-backed proof remains
  blocked until disposable local Supabase is running and seeded.

Verdict for task 13: PARTIAL. Static/unit/security/build/perf/schema gates and
public route timing passed. Mock harness screenshot capture now passes with the
corrected invocation. Disposable DB and seeded/authenticated browser QA remain
blocked by local stack/seed state documented above.
