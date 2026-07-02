---
spec_id: MS-merchant-multi-site-spike
status: implemented
risk_class: rls-rpc-ledger
owner: codex
last_reviewed: 2026-07-02
allowed_blast_radius:
  - micro-specs/merchant/multi-site-spike.md
  - app/app/account/actions.ts
  - app/app/account/page.tsx
  - app/app/page.tsx
  - app/app/qr/poster/[template]/page.tsx
  - app/app/qr/image/[qrCodeId]/route.ts
  - app/dev/app-harness/account/page.tsx
  - app/dev/app-harness/dashboard/page.tsx
  - app/dev/app-harness/fixtures.ts
  - components/layout/console-nav.ts
  - components/merchant/account/account-tabs.ts
  - components/merchant/account/account-tab-bar.tsx
  - components/merchant/account/locations-panel.tsx
  - components/merchant/dashboard-home-streams.tsx
  - components/merchant/dashboard-next-actions.tsx
  - components/merchant/dashboard-location-filter.tsx
  - lib/merchant/dashboard-buckets.ts
  - lib/merchant/dashboard-counts.ts
  - lib/merchant/dashboard.ts
  - lib/merchant/dashboard-metrics.ts
  - lib/merchant/dashboard-period-counts.ts
  - lib/merchant/dashboard-query.ts
  - lib/merchant/dashboard-scope.ts
  - lib/merchant/dashboard-scope-ids.ts
  - lib/merchant/location.ts
  - lib/merchant/qr-code.ts
  - lib/merchant/venue-location-submission.ts
  - tests/unit/dashboard-scope.test.mjs
  - tests/micro-specs/launch-qr-readiness.test.mjs
  - tests/micro-specs/merchant-multi-site-spike.test.mjs
  - tests/db/multi-location.test.mjs
  - tests/e2e/helpers/harness.ts
  - tests/e2e/merchant-multi-site-flow.ts
  - tests/e2e/merchant-multi-site.spec.ts
  - tests/e2e/merchant-multi-site.desktop.spec.ts
implementation_surfaces:
  - app/app/account/actions.ts
  - app/app/account/page.tsx
  - app/app/page.tsx
  - app/dev/app-harness/account/page.tsx
  - app/dev/app-harness/dashboard/page.tsx
  - app/dev/app-harness/fixtures.ts
  - components/layout/console-nav.ts
  - components/merchant/account/account-tabs.ts
  - components/merchant/account/locations-panel.tsx
  - components/merchant/dashboard-home-streams.tsx
  - components/merchant/dashboard-next-actions.tsx
  - components/merchant/dashboard-location-filter.tsx
  - lib/merchant/dashboard-buckets.ts
  - lib/merchant/dashboard-counts.ts
  - lib/merchant/dashboard-metrics.ts
  - lib/merchant/dashboard-period-counts.ts
  - lib/merchant/dashboard-query.ts
  - lib/merchant/dashboard-scope.ts
  - lib/merchant/dashboard-scope-ids.ts
  - lib/merchant/location.ts
  - lib/merchant/qr-code.ts
  - lib/merchant/venue-location-submission.ts
related_docs:
  - AGENTS.md
  - DESIGN.md
  - micro-specs/README.md
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/merchant/launch.md
  - micro-specs/merchant/card-rewards.md
related_tests:
  - tests/unit/dashboard-scope.test.mjs
  - tests/micro-specs/merchant-multi-site-spike.test.mjs
  - tests/db/multi-location.test.mjs
  - tests/e2e/merchant-multi-site-flow.ts
  - tests/e2e/merchant-multi-site.spec.ts
  - tests/e2e/merchant-multi-site.desktop.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm bundle:check
  - pnpm test:e2e -- --grep "@merchant-multi-site"
  - pnpm test:a11y
  - pnpm test:visual
  - pnpm build
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Unit output proving dashboard location scope resolves blank values to merchant-wide and exposes the shared-members caption.
  - Micro-Spec output proving the account Locations tab, server action provisioning path, scoped dashboard query fallback, and QR image authorization contract.
  - DB output proving owner-only second-location provisioning, cloned reward-pool context, one-active-card guard, minimum reward guard, and distinct location QR behavior.
  - Playwright DB-free harness output proving dashboard filtering and the account Locations tab render the expected operator controls.
approved_exceptions: []
---

# MS-merchant-multi-site-spike

## Intent

Merchants can draft a second venue, get a location-specific join QR, and filter
the merchant dashboard by location without changing the customer membership
model or adding schema.

## Scope

In scope:

- A Locations tab under Account with a location list, QR share paths, PNG links,
  and an add-location form.
- A server action that reuses the current venue-address validation, writes a
  non-primary location, clones the active primary card for that location, clones
  the active reward pool through `upsert_reward_pool_item`, and creates a join
  QR through `create_or_get_join_qr`.
- Dashboard location pills that scope location-owned activity while keeping
  membership and repeat-member counts merchant-wide.
- QR image authorization that accepts any owned active join QR for the merchant,
  not only the primary location/card.
- DB-free app harness evidence for the dashboard filter and Locations tab.

Out of scope:

- New migrations, edited RLS policies, cross-site membership ledgers, staff
  assignment UI, cloned-card editing UI, Stripe changes, or customer-facing
  multi-location switching.
- Retrofitting historical events that do not already carry `location_id`,
  `loyalty_card_id`, or `qr_code_id`.

## Decisions Already Made

- Memberships and repeat-member counts stay merchant-wide in this spike.
- Location-scoped stamps filter by `stamp_events.location_id`.
- Location-scoped rewards filter by `reward_events.loyalty_card_id` for cards at
  the selected location.
- Location-scoped QR downloads filter by `product_events.qr_code_id` for QR rows
  at the selected location.
- New locations are `is_primary: false`; the one-primary-location constraint is
  unchanged.
- New cards are cloned by direct insert. Reward pool items and join QR creation
  continue to flow through existing RPCs.

## EARS Requirements

- **MS-1 (locations tab):** THE account hub SHALL include a `locations` tab and
  sidebar entry labelled "Locations".
- **MS-2 (locations list):** THE Locations tab SHALL list each merchant location
  with its join share path and PNG download link when an active join QR exists.
- **MS-3 (add location action):** WHEN a merchant submits the add-location form,
  THE server action SHALL authenticate the current merchant, validate address
  fields through the shared venue-location submission helper, insert a
  non-primary location, clone the active primary card, clone active reward-pool
  rows through `upsert_reward_pool_item`, and call `create_or_get_join_qr`.
- **MS-4 (schema discipline):** THE spike SHALL NOT add a migration or weaken
  existing RLS policies.
- **MS-5 (dashboard scope):** WHEN a valid `?location=` is supplied on `/app`,
  THE dashboard SHALL scope stamps, redeemed rewards, QR downloads, and their
  trend/series values to that location while keeping members and repeat members
  merchant-wide.
- **MS-6 (shared member copy):** WHEN a location dashboard scope is active, THE
  dashboard SHALL display "Members are shared across your sites".
- **MS-7 (QR image authorization):** WHEN a merchant requests a QR PNG, THE
  private image context SHALL authorize by `qrCodeId`, current merchant,
  `destination_type = "join"`, and `is_active = true`, then render the QR's own
  location/card context.
- **MS-8 (database proof):** THE DB test SHALL prove owner-scoped second
  location writes, cross-tenant rejection, reward-pool location derivation from
  the cloned card, one-active-card enforcement, minimum reward guard, and
  distinct active join QR behavior for the second location.
- **MS-9 (harness):** THE DB-free harness SHALL expose location pills on the
  dashboard and the Locations account tab for Playwright proof.

## Verification

Required checks:

- Unit tests for pure dashboard scope helpers.
- Micro-Spec source checks for the account tab, server action path, no-migration
  constraint, dashboard scoping, QR image authorization, and harness coverage.
- Live DB test for RLS/RPC/ledger behavior. If `SUPABASE_DB_URL` is unavailable
  locally, the test must report an explicit skip rather than passing as runtime
  proof.
- DB-free Playwright checks for dashboard filtering and account Locations UI.
- Full `rls-rpc-ledger` gate floor from `micro-specs/README.md`.

## Implementation Evidence

2026-07-02 local gate evidence: `pnpm governance:run-gates` passed after the
Locations account tab, add-location action, dashboard location scope,
owned-join-QR image authorization, unit tests, Micro-Spec checks, live DB
multi-location proof, and `@merchant-multi-site` Playwright harness proof were
present. Final `verified` status still needs the sprint close CI artifact and
review sign-off on the deferred multi-site scope.
