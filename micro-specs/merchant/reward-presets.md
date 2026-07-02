---
spec_id: MS-merchant-reward-presets
status: implemented
risk_class: ui-only
owner: codex
last_reviewed: 2026-07-02
allowed_blast_radius:
  - micro-specs/merchant/reward-presets.md
  - lib/merchant/reward-presets.ts
  - components/merchant/loyalty-card-form.tsx
  - components/merchant/launch/card-panel.tsx
  - components/merchant/launch/rewards-panel.tsx
  - app/dev/app-harness/launch/page.tsx
  - tests/unit/reward-presets.test.mjs
  - tests/micro-specs/reward-presets.test.mjs
  - tests/e2e/merchant-reward-presets-flow.ts
  - tests/e2e/merchant-reward-presets.spec.ts
  - tests/e2e/merchant-reward-presets.desktop.spec.ts
implementation_surfaces:
  - lib/merchant/reward-presets.ts
  - components/merchant/loyalty-card-form.tsx
  - components/merchant/launch/card-panel.tsx
  - components/merchant/launch/rewards-panel.tsx
  - app/dev/app-harness/launch/page.tsx
related_docs:
  - AGENTS.md
  - DESIGN.md
  - micro-specs/README.md
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/merchant/card-rewards.md
  - micro-specs/merchant/launch.md
related_tests:
  - tests/unit/reward-presets.test.mjs
  - tests/micro-specs/reward-presets.test.mjs
  - tests/e2e/merchant-reward-presets-flow.ts
  - tests/e2e/merchant-reward-presets.spec.ts
  - tests/e2e/merchant-reward-presets.desktop.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e -- --grep "@reward-presets"
  - pnpm test:a11y
  - pnpm test:visual
  - pnpm build
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Unit output proving preset bounds and terms stay inside existing server action limits.
  - Micro-Spec output proving presets are passed to the current launch card and rewards panels without changing server actions, seeding, or default pool constants.
  - Playwright evidence proving cadence chips and reward preset chips prefill the existing forms in the launch harness.
approved_exceptions: []
---

# MS-merchant-reward-presets

## Intent

Merchants setting up a pub or restaurant card can choose from practical
pub-specific reward and cadence presets. Presets only prefill the existing card
and reward forms; saving still flows through the current server actions and
database RPCs.

## Scope

In scope:

- A pure preset catalogue for pub reward ideas and launch cadence choices.
- Card-form UI affordances that set the existing `stampsRequired` draft value.
- Reward-pool UI affordances that open the existing new-reward editor prefilled
  from a preset.
- DB-free launch harness evidence for the preset interactions.

Out of scope:

- Changing `DEFAULT_REWARD_POOL_ITEMS`, automatic seeding, server actions, RPCs,
  migrations, reward draw logic, or the `MAX_STAMPS_REQUIRED` range.
- Adding a preset table or persisting presets before the merchant saves the
  form.

## Decisions Already Made

- The launch range remains 3 to 6 visits.
- Pub cadence presets are lunch-trade 3, food-led 5, and wet-led 6.
- Reward presets post with `weight: "1"` and the caller-provided display order.
- Reward terms end with "Valid from the next UK business day."

## EARS Requirements

- **RP-1 (catalogue):** THE system SHALL expose seven pub reward presets within
  the existing reward action bounds: reward name at most 100 characters and terms
  between 12 and 500 characters.
- **RP-2 (safe conversion):** WHEN a reward preset is converted for the reward
  pool form, THE system SHALL keep the preset name and terms, set `weight` to
  `"1"`, set `isActive` true, and use the supplied display order.
- **RP-3 (cadence bounds):** THE system SHALL expose cadence presets whose visit
  counts stay within `MIN_STAMPS_REQUIRED` and `MAX_STAMPS_REQUIRED`.
- **RP-4 (card prefill):** WHEN a merchant chooses a cadence preset, THE card
  form SHALL update the existing visits draft and show that preset guidance
  without saving.
- **RP-5 (reward prefill):** WHEN a merchant chooses a reward preset, THE reward
  pool form SHALL open the existing new-reward editor with the preset name,
  terms, active state, default weight, and next display order.
- **RP-6 (persistence unchanged):** THE preset UI SHALL NOT change server action
  imports, reward seeding constants, RPC names, or persistence paths.

## Verification

Required checks:

- Unit tests for catalogue bounds, next-business-day terms, cadence bounds, and
  preset-to-form conversion.
- Micro-Spec source checks proving the panels pass preset catalogues to the
  existing forms and no server action/seeding path was widened.
- Playwright DB-free harness checks for cadence and reward preset prefill.
- Full ui-only gate floor from `micro-specs/README.md`.

## Implementation Evidence

2026-07-02 local gate evidence: `pnpm governance:run-gates` passed after the
preset catalogues, launch-panel wiring, unit tests, Micro-Spec source checks,
and `@reward-presets` Playwright harness proof were present. Final `verified`
status still needs the sprint close CI artifact.
