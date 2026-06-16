# Nabaperks MVP Micro-Specs

This folder contains the current executable micro-specs for the Nabaperks MVP.

Use these files in order. Each spec is intended to be a focused 1-3 day implementation slice with explicit scope, settled decisions, EARS requirements, and verification gates.

## Source Documents

- `Instructions_MircroSpecsCreation.md` - required micro-spec structure and writing style.
- `Instructions_tdd.md` - test-first implementation workflow.
- `AGENTS.md` - project stack and Next.js guidance.
- `DESIGN.md` - brand, UI tokens, and component conventions.

## Global Context

Read `GLOBAL_CONTEXT.md` before any individual spec. It contains reusable project-wide constraints that should not be repeated in every implementation task.

## Recommended Build Order

| Phase | Spec                                                                      | Purpose                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | `00-mvp-scope/01-scope-and-release-gates.md`                              | Lock MVP boundaries, non-goals, pilot gates, and release assumptions.                                                                                       |
| 1     | `01-foundation/01-project-shell-and-environments.md`                      | Prepare the Next.js/Vercel/Supabase-ready app foundation.                                                                                                   |
| 1     | `01-foundation/02-supabase-schema-rls-and-audit.md`                       | Create the data model, tenant isolation, roles, and audit backbone.                                                                                         |
| 2     | `02-merchant/01-merchant-auth-onboarding-and-business-profile.md`         | Let merchants sign up and create their first business/location profile.                                                                                     |
| 2     | `02-merchant/02-loyalty-card-builder.md`                                  | Let merchants create one mystery visit card and manage its reward pool.                                                                                     |
| 2     | `02-merchant/03-dynamic-qr-generation-and-downloads.md`                   | Generate one permanent venue QR and downloadable merchant assets.                                                                                           |
| 3     | `03-customer/01-qr-resolver-and-customer-join.md`                         | Resolve `/q/{qr_id}` and let customers join without an app.                                                                                                 |
| 3     | `03-customer/02-digital-stamp-card.md`                                    | Show a mobile customer visit card with locked and revealed reward states.                                                                                   |
| 4     | `04-staff-rewards/01-self-service-stamp-issuing.md`                       | Let customers self-serve one visit stamp per UK business date from the venue QR, with ownership, rate-limit, idempotency, and soft-geofence fraud controls. |
| 4     | `04-staff-rewards/02-reward-unlock-and-redemption.md`                     | Reveal assigned rewards and redeem them once from the next UK business day.                                                                                 |
| 5     | `05-merchant-value/01-merchant-dashboard-activity-and-roi.md`             | Prove merchant value through members, repeats, activity, and ROI estimates.                                                                                 |
| 6     | `06-admin-billing/01-stripe-billing-and-access-control.md`                | Start subscriptions, sync Stripe state, and enforce billing access.                                                                                         |
| 6     | `06-admin-billing/02-internal-admin-support-console.md`                   | Give internal admins support, adjustment, fraud, QR, and audit tools.                                                                                       |
| 7     | `07-observability-compliance/01-events-analytics-and-funnels.md`          | Record product events in Supabase and track funnels in PostHog.                                                                                             |
| 7     | `07-observability-compliance/02-consent-legal-pages-and-data-requests.md` | Separate loyalty participation from marketing consent and support UK data requests.                                                                         |
| 7     | `07-observability-compliance/03-security-fraud-and-rate-limits.md`        | Harden QR and self-service stamp flows, webhooks, admin access, and abuse detection.                                                                        |
| 8     | `08-pilot/01-pilot-readiness-and-validation.md`                           | Prepare the 10-20 merchant pilot and success measurement loop.                                                                                              |

## Working Rule

Do not treat this folder as a fixed implementation plan if live code evidence contradicts it. Before implementing any spec, inspect the current repo state and narrow the task to what is still missing.

## AI Governance Contract

This section is the repo-local governance contract that `pnpm governance`
validates. It makes the AI Software Factory model explicit without changing
product intent: Product owns Micro-Spec intent, Engineering implements with
Red → Green → Refactor, and reviewers verify traceability plus evidence.

### Governance Source-of-Truth Hierarchy

Use this hierarchy when artifacts disagree. Lower entries explain workflow; they
do not override product or architecture truth above them.

1. `docs/PROJECT_SPEC.md` is the as-built product source of truth.
2. `docs/ARCHITECTURE.md` is the as-built technical source of truth.
3. `micro-specs/GLOBAL_CONTEXT.md` holds reusable cross-cutting constraints.
4. Individual `micro-specs/` files describe current or historical intent
   slices and must be reconciled against live code before implementation.
5. `Instructions_MircroSpecsCreation.md` defines Product-side Micro-Spec
   authoring.
6. `Instructions_tdd.md` defines Engineering-side implementation with
   Red → Green → Refactor.
7. `AGENTS.md`, `CLAUDE.md`, and `SKILL.md` are agent entrypoints that route
   agents to this same contract and the two instruction files.

### Micro-Spec Metadata Schema

Every normalized Micro-Spec must carry machine-readable metadata before it can
be used for implementation:

```yaml
spec_id: MS-<area>-<slug>
status: draft | active | implemented | verified | superseded
risk_class: docs-tooling | ui-only | product-analytics | customer-pii | auth-session | billing | webhooks | rls-rpc-ledger | migrations
owner: <person-or-agent>
last_reviewed: YYYY-MM-DD
allowed_blast_radius:
  - <repo-local path or glob>
implementation_surfaces:
  - <repo-local path or glob>
related_docs:
  - <repo-local path>
related_tests:
  - <repo-local path>
verification_gates:
  - pnpm lint
approved_exceptions: []
```

### Lifecycle Status Vocabulary

- `draft`: not ready for implementation. Agents may refine intent only.
- `active`: ready for Engineering after as-built reconciliation.
- `implemented`: code and tests exist, but final release evidence is still
  being assembled.
- `verified`: implementation evidence, traceability, and required gates are
  complete.
- `superseded`: retained for history and blocked for implementation unless a
  new active spec or an `approved_exceptions` record says otherwise.

### Lifecycle Transition Policy

Allowed transitions are:

| From          | To            | Required evidence                                                                          |
| ------------- | ------------- | ------------------------------------------------------------------------------------------ |
| `draft`       | `active`      | Complete metadata, EARS requirements, risk class, blast radius, and verification gates.    |
| `active`      | `implemented` | Requirement IDs mapped to tests, Red → Green → Refactor evidence, and in-scope files only. |
| `implemented` | `verified`    | Passing required gates, traceability updates, and reviewer handoff evidence.               |
| `active`      | `superseded`  | Supersession link or rationale in traceability.                                            |
| `implemented` | `superseded`  | Replacement spec or explicit product decision.                                             |

Any transition from `draft`, `superseded`, or stale evidence directly into
implementation requires an `approved_exceptions` entry in metadata or
traceability. Draft and superseded specs are not valid Engineering handoff
inputs by default.

### Risk Rubric

| risk_class          | Applies to                                                        | Minimum posture                                                              |
| ------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `docs-tooling`      | Governance docs, scripts, tests, CI, templates, and traceability. | CLI-first, read-only checks, no product runtime changes.                     |
| `ui-only`           | Visual or copy changes without data mutation changes.             | Automated checks plus browser evidence for the changed surface.              |
| `product-analytics` | Event naming, funnels, reports, and PostHog mirrors.              | Test event contracts and preserve source-of-truth writes.                    |
| `customer-pii`      | Customer phone, consent, identity, profile, or privacy surfaces.  | Security checks and evidence that unnecessary personal data is not exposed.  |
| `auth-session`      | Merchant, customer, admin, cookie, OTP, or session behavior.      | Security checks, tests, and runtime/browser evidence when user flows change. |
| `billing`           | Stripe checkout, portal, subscription sync, or entitlement gates. | Security checks, tests, and build evidence.                                  |
| `webhooks`          | Stripe or future inbound webhook handlers.                        | Signature verification, idempotency, DB verification, and security checks.   |
| `rls-rpc-ledger`    | Supabase RLS, RPCs, loyalty ledger, fraud, or audit invariants.   | SQL/RLS checks, security checks, and tests.                                  |
| `migrations`        | Supabase migrations or schema verification rules.                 | Idempotent migration checks, DB verification, and security checks.           |

### Risk-to-Gate Mapping

| risk_class          | Required gates                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `docs-tooling`      | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`                                       |
| `ui-only`           | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `npx playwright test` or scoped browser evidence        |
| `product-analytics` | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage` when `lib/` analytics code changes |
| `customer-pii`      | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm security:verify`                                  |
| `auth-session`      | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm security:verify`, `pnpm build`                    |
| `billing`           | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm security:verify`, `pnpm build`                    |
| `webhooks`          | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:verify`, `pnpm security:verify`                |
| `rls-rpc-ledger`    | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:verify`, `pnpm security:verify`                |
| `migrations`        | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:verify`, `pnpm security:verify`                |

### CLI-first Validation Policy

Governance-only work is validated through repository artifacts and CLI gates.
It does not require browser evidence when it does not change product runtime UI
or user flows. Product runtime changes must include browser evidence when the
risk rubric or risk-to-gate mapping calls for it, especially `ui-only`,
`auth-session`, and customer-facing risk.

`pnpm governance` is read-only check mode. Any future fixer or generator must
use a separate explicit command and must never be hidden behind the check gate.
