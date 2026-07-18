# Nabaperks Architecture Flow Analysis

Snapshot: 2026-06-30 current working tree.

This folder contains the maintained architecture analysis for the current
Nabaperks route families. Obsolete raw worker output and the pre-removal
flow-by-flow snapshot were retired with the public acquisition site.

## How To Read This Folder

| File                          | Covers                                                                            | Flow IDs             |
| ----------------------------- | --------------------------------------------------------------------------------- | -------------------- |
| `00-executive-summary.md`     | Cross-cutting architecture, highest risks, recommended sequence                   | all                  |
| `01-public-marketing.md`      | Public merchant entry, legal, offline, and meta surfaces                          | 1-8                  |
| `02-merchant-auth-entry.md`   | Merchant signup, login, reset, confirmation, onboarding, start routing            | 9-15                 |
| `03-merchant-setup-launch.md` | Launch checklist, venue, card, rewards, billing, QR, dashboard, account           | 16-25                |
| `04-merchant-operations.md`   | Members, activity, scanner, reward collection                                     | 26-29                |
| `05-customer-loyalty.md`      | Public QR, join, customer card, stamp, reward, reward QR/status                   | 30-39                |
| `06-customer-home.md`         | Customer wallet login, dashboard, profile, rewards, activity                      | 40-44                |
| `07-api-background.md`        | Auth hooks, push, notifications, cron, Stripe, health                             | 45-51                |
| `08-admin-support.md`         | Admin gate, overview, merchants, customers, privacy, fraud, audit, billing, pilot | 52-60                |
| `09-dev-qa.md`                | Dev design system, app harnesses, poster preview, viewport wrapper                | 61-64                |
| `11-remediation-log.md`       | Current repository and service-backed release gates                               | prioritized findings |
| `worker-axes.csv`             | LazyCodex worker manifest                                                         | all                  |

## Method

Each flow is analyzed through the same lens:

1. Architecture shape: route, component, action, data, and external-service
   boundaries.
2. Trust boundary: what the browser may influence versus what the server or
   database owns.
3. Pitfalls: current architecture risks, drift points, reliability gaps, and
   security or privacy concerns.
4. Improvements: practical changes that reduce risk without discarding the
   existing Wet Ink product architecture.
5. Verification: missing tests or manual QA needed before a pilot or production
   claim.

## Priority Codes

| Code | Meaning                                                                                |
| ---- | -------------------------------------------------------------------------------------- |
| P0   | Fix before trusting the flow in a pilot; likely user-impacting or trust-boundary risk. |
| P1   | Fix before broader pilot/production release.                                           |
| P2   | Important hardening or maintainability work.                                           |
| P3   | Nice-to-have cleanup or polish.                                                        |

## Remediated Highest-Risk Items

The P0/P1 items from the original architecture pass have code-level
remediations recorded in `11-remediation-log.md`: reward collection token/id
confusion, QR reward-threshold drift, Stripe failed-event retry, notification
atomic claiming/retry, push consent delivery checks, merchant OTP alias cleanup,
admin service-role read guards, and dev route production gating.

Remaining release gates are verification gates rather than known source
pitfalls: apply the SQL migrations to the target Supabase project, run
`pnpm smoke:supabase:migrations`, `pnpm env:check:production`, and
`pnpm smoke:providers` against the target/provider environment, and add
higher-fidelity integration/E2E coverage for QR, stamp, reward collection,
notifications, and admin support. The provider smoke can derive a hosted
Supabase DB URL from linked pooler metadata when `SUPABASE_DB_PASSWORD` is
supplied, but Vercel's production sensitive-env values were not locally
readable through `vercel env pull` in the 2026-06-30 CLI check. The read-only
`pnpm smoke:supabase:migrations` gate currently shows the target project is
missing `20260628120000` and the remediation migration range `20260630120000`
through `20260630131000`; `supabase db push --linked --dry-run --include-all`
lists that same pending batch without mutating the remote database.

## Recommended Analysis And Fix Sequence

1. Flow 29: merchant reward collection.
2. Flow 33-39: customer QR, join, card, stamp, reward, and reward QR/status.
3. Flow 16-23: merchant launch and QR readiness.
4. Flow 50 and 49: Stripe webhook and notification cron.
5. Flow 52-60: admin support controls and service-role read boundaries.
6. Flow 9-15: merchant auth and onboarding reliability.
7. Flow 40-48: customer wallet, push preferences, and notification APIs.
8. Flow 1-8 and 61-64: public surface hardening and QA harness governance.
