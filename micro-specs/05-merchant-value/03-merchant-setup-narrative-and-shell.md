---
spec_id: MS-MERCHANT-VALUE-MERCHANT-SETUP-NARRATIVE-AND-SHELL
status: active
risk_class: ui-only
owner: factory-droid
last_reviewed: 2026-06-26
allowed_blast_radius:
  - app/app/account/page.tsx
  - app/app/layout.tsx
  - app/app/onboarding/page.tsx
  - app/dev/merchant-admin-preview/screens/merchant-account.tsx
  - app/dev/merchant-admin-preview/screens/merchant-onboarding.tsx
  - components/merchant/account/account-tab-bar.tsx
  - components/merchant/account/account-tabs.ts
  - components/merchant/account/billing-panel.tsx
  - components/merchant/launch-readiness-panel.tsx
  - lib/merchant/launch-readiness-contract.ts
  - lib/merchant/launch-readiness.ts
  - micro-specs/05-merchant-value/03-merchant-setup-narrative-and-shell.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
  - tests/micro-specs/merchant-account-hub.test.ts
  - tests/micro-specs/merchant-console-trust-ia.test.ts
  - tests/micro-specs/merchant-launch-readiness.test.ts
  - tests/micro-specs/merchant-setup-narrative.test.ts
implementation_surfaces:
  - app/app/account/page.tsx
  - app/app/layout.tsx
  - app/app/onboarding/page.tsx
  - app/dev/merchant-admin-preview/screens/merchant-account.tsx
  - app/dev/merchant-admin-preview/screens/merchant-onboarding.tsx
  - components/merchant/account/account-tab-bar.tsx
  - components/merchant/account/account-tabs.ts
  - components/merchant/account/billing-panel.tsx
  - components/merchant/launch-readiness-panel.tsx
  - lib/merchant/launch-readiness-contract.ts
  - lib/merchant/launch-readiness.ts
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - micro-specs/GLOBAL_CONTEXT.md
  - DESIGN.md
related_tests:
  - tests/micro-specs/merchant-setup-narrative.test.ts
  - tests/micro-specs/merchant-console-trust-ia.test.ts
  - tests/micro-specs/merchant-launch-readiness.test.ts
  - tests/micro-specs/merchant-account-hub.test.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - npx playwright test
  - npx playwright test tests/e2e/merchant-admin-redesign-screenshots.spec.ts
approved_exceptions: []
---

# Micro-Spec: Merchant Setup Narrative and Shell

## Governance Status Evidence

- Lifecycle status: `active` after review against the current launch readiness,
  onboarding, account hub, billing panel, and preview harness source on
  2026-06-26.
- Stale/superseded handling: no existing active spec owns the onboarding to
  launch setup narrative. `02-merchant-console-trust-and-ia-cleanup.md` owns the
  account hub and shell cleanup, but not this setup-story handoff.
- Evidence posture: related tests and verification gates are listed in metadata
  and traceability for implementation handoff.

## Exact Goal and User-Visible Outcomes

Merchants see one coherent setup journey from signup through onboarding and
launch: the onboarding sidebar, launch spine, and billing/account entry points
use the same five-step order and compatible labels. Onboarding and launch share
the same minimal setup chrome, while the Account hub exposes Profile and Billing
as visible on-page tabs.

## Blast Radius

In scope:

- Merchant onboarding setup journey copy and preview mirror.
- Merchant account preview mirror for tab-strip browser evidence.
- Launch readiness contract labels and shared setup-step narrative data.
- Merchant app shell setup-path predicate for onboarding and launch.
- Billing panel cross-link copy between setup billing and ongoing account
  billing.
- Account hub on-page Profile/Billing tab strip.
- Micro-spec traceability rows and focused micro-spec tests.

Out of scope:

- Schema, RLS, RPCs, migrations, audit ledger, or billing checkout logic.
- Customer QR, stamp, reward, or redemption flows.
- New dependencies or changes to shadcn primitives in `components/ui/`.
- The `?step=` join wizard and unrelated merchant/admin navigation changes.

## Strict Constraints and Assumptions

- This is `ui-only`: copy, labels, presentational components, and a shell
  predicate only.
- Follow the existing Wet Ink design system in `DESIGN.md`; use brand wrappers,
  semantic tokens, and `next/link`.
- Keep account tabs server-rendered and URL-driven through `?tab=`.
- Onboarding and the dev onboarding preview must share one setup-step
  definition; no copied step arrays.
- `/app/launch?tab=billing` remains setup billing. `/app/account?tab=billing`
  remains ongoing billing management.
- No new dependencies, no client-only tab state, and no changes to Stripe
  action routing.

## Decisions Already Made

- The setup story has five ordered steps: venue, card, rewards, launch kit, and
  billing.
- The first setup label is `Business & venue` because onboarding captures the
  business profile and first venue before launch readiness treats venue as
  complete.
- Venue readiness is already true after onboarding when an address exists and
  geofence is not required; this requirement is guarded, not reimplemented.
- The launch and onboarding setup shell should use the minimal setup variant,
  not the full console sidebar.
- Account tabs are Profile and Billing only.

## Behavioral Requirements

- **MS-MERCHANT-VALUE-MERCHANT-SETUP-NARRATIVE-AND-SHELL-001** WHEN a merchant views `/app/onboarding`, THE system SHALL show a setup journey listing the same ordered steps as the launch spine, using `LAUNCH_SETUP_STEP_LABELS`.
- **MS-MERCHANT-VALUE-MERCHANT-SETUP-NARRATIVE-AND-SHELL-002** WHERE the onboarding page and the dev onboarding preview both render the setup journey, THE system SHALL derive it from one shared definition.
- **MS-MERCHANT-VALUE-MERCHANT-SETUP-NARRATIVE-AND-SHELL-003** WHEN a merchant lands on `/app/launch` after onboarding, THE system SHALL show venue already complete when the saved location has an address and geofence is off.
- **MS-MERCHANT-VALUE-MERCHANT-SETUP-NARRATIVE-AND-SHELL-004** WHILE a merchant is on `/app/onboarding`, THE system SHALL render the minimal setup shell, matching `/app/launch`.
- **MS-MERCHANT-VALUE-MERCHANT-SETUP-NARRATIVE-AND-SHELL-005** WHILE a merchant has not gone live, THE system SHALL treat `/app/launch?tab=billing` as the setup billing surface and `/app/account?tab=billing` as ongoing management, with explicit cross-link copy between them.
- **MS-MERCHANT-VALUE-MERCHANT-SETUP-NARRATIVE-AND-SHELL-006** WHEN a merchant views `/app/account`, THE system SHALL render an on-page tab strip for Profile and Billing that reflects the active `?tab`.

## Verification Criteria

Acceptance criteria:

- Onboarding shows five numbered setup steps in launch order:
  `Business & venue`, `Your card`, `Your rewards`, `Launch kit`, and `Billing`.
- Production onboarding and the dev onboarding preview import and render the
  same shared setup-step list.
- Launch readiness still marks a saved address with `require_geofence: false`
  as venue-ready.
- `/app/onboarding` and `/app/launch` both render the setup shell variant.
- Setup billing links onward to Account Billing for later management, while
  Account Billing links back to Launch Billing when a not-live merchant still
  needs a card.
- `/app/account?tab=profile` and `/app/account?tab=billing` show a visible
  Profile/Billing tab strip with `aria-current="page"` on the active tab.

Manual QA:

- Open the merchant onboarding preview and confirm the sidebar shows five
  setup steps and the setup chrome.
- Open the launch preview and confirm the launch spine still shows venue
  complete once onboarding has saved a geofence-off venue.
- Open Account Profile and Account Billing and confirm the tab strip active
  state changes with `?tab=`.
- Open setup Billing and ongoing Account Billing and confirm the cross-link copy
  points to the correct billing surface.

Task breakdown:

- Add failing tests for the shared setup narrative, setup shell predicate,
  venue-ready guard, billing cross-links, and account tab strip.
- Add the shared setup-step definition to the launch readiness contract.
- Replace hardcoded onboarding step arrays with the shared definition.
- Expand the merchant setup-shell predicate to include onboarding.
- Add billing cross-link copy without changing Stripe action targets.
- Add and render the server-side Account tab bar.
