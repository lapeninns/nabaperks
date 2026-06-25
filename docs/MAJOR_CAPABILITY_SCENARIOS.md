# Nabaperks Major Capability Scenarios

This is the N-max scenario layer for broad release-quality checks. It does not
replace `docs/QA_MATRIX.md`; it groups the existing gates into realistic product
capability scenarios and records one evidence log per outcome.

## Evaluation method

Each scenario is pass/fail and runs under the same shared environment:

- `TZ=Europe/London`
- `CUSTOMER_OTP_BYPASS_MODE` unset
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100`
- `PORT=3100`
- DB/browser scenarios require local disposable Supabase URLs.

Browser commands use the Playwright dev-server config or existing package
scripts to pass `CUSTOMER_DEV_OTP_CODE=424242`. Unit and security commands do
not inherit the dev OTP override, so Twilio Verify paths are still exercised.

Success criteria for every scenario:

1. All commands exit 0 under the shared scenario environment.
2. Each command writes a non-empty evidence log.
3. Scenario evidence includes command, start/end time, exit code, and outcome.

Run the suite with:

```sh
pnpm qa:scenarios
```

Run one scenario with:

```sh
pnpm qa:scenarios -- --scenario=customer-stamp-reward
```

Evidence is written to `.omo/evidence/major-capability-scenarios/<run-id>/`, with
`.omo/evidence/major-capability-scenarios/latest-run.txt` pointing at the latest
run.

## Scenario set

| ID | Capability covered |
| --- | --- |
| `governance-traceability` | Micro-spec governance, route inventory, and AI handoff rules |
| `foundation-health` | Next.js foundation, environment safety, PWA shell, health probe |
| `customer-qr-join` | Customer QR resolver, phone OTP, loyalty join, returning routing |
| `customer-stamp-reward` | Digital stamp card, self-service stamping, reward unlock, reward redemption |
| `merchant-onboarding-launch` | Merchant signup/onboarding, loyalty card builder, reward pool, venue geofence, QR assets |
| `merchant-console-value` | Merchant console value readbacks, masked customers, activity, billing notice, navigation |
| `admin-support-fraud` | Internal admin authorization, support actions, fraud readbacks, audit logs |
| `billing-webhooks` | Stripe billing actions, webhook signature/idempotency, merchant/customer billing states |
| `privacy-consent-pii` | Marketing consent, legal participation terms, contact immutability, masked PII |
| `observability-analytics` | Supabase product events, PostHog mirror, analytics dashboards, pilot metrics |
| `security-rate-limits` | Durable rate limits, safe next paths, admin MFA, client secret isolation, fraud safety |
| `db-rls-ledger` | Supabase schema verification, RLS, RPC atomicity, ledger, tenant isolation |
| `design-accessibility-pwa` | Design system, visual regression, a11y, reduced motion, offline/PWA |
| `performance-build` | Build output, bundle size, dependency footprint, N+1/read-path performance |

If any scenario fails, fix the underlying cause, rerun the failed scenario, then
rerun `pnpm qa:scenarios` so the final evidence is a complete passing set.
