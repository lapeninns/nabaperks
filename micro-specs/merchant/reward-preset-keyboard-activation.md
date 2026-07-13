---
spec_id: MS-merchant-reward-preset-keyboard-activation
status: active
risk_class: ui-only
owner: amankumarshrestha
last_reviewed: 2026-07-13
allowed_blast_radius:
  - micro-specs/merchant/**
  - components/merchant/loyalty-card-form.tsx
  - tests/e2e/merchant-reward-presets-flow.ts
  - tests/micro-specs/reward-preset-atomic-add.test.mjs
implementation_surfaces:
  - components/merchant/loyalty-card-form.tsx
  - tests/e2e/merchant-reward-presets-flow.ts
  - tests/micro-specs/reward-preset-atomic-add.test.mjs
related_tests:
  - tests/micro-specs/reward-preset-atomic-add.test.mjs
  - tests/e2e/merchant-reward-presets-flow.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-merchant-reward-preset-keyboard-activation"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari --grep "@a11y"
  - pnpm test:visual -- --project=chromium --project=mobile-safari --grep "@visual"
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-merchant-reward-preset-keyboard-activation — Stabilize reward preset keyboard activation

## 1. Exact Goal and User-Visible Outcomes

Reward preset toggles respond deterministically to Space and Enter in Chromium
and WebKit, including after a long browser session, without double-toggling or
persisting a draft selection.

## 2. Blast Radius

Only the reward preset toggle's client-side keyboard activation, its existing
browser test, one source-contract assertion, and this Micro-Spec may change.
Reward persistence, catalogue values, database behavior, and visual styling are
out of scope.

## 3. Strict Constraints and Assumptions

- Preserve the native `button` element and its click behavior.
- Space and Enter must each toggle exactly once and suppress page scrolling or
  a second native synthetic click.
- Pointer activation and the explicit bulk Add persistence boundary remain
  unchanged.
- Do not weaken CI flaky-test enforcement or skip WebKit keyboard proof.

## 4. Decisions Already Made

- GitHub's trace shows Playwright completed `press("Space")` on the hydrated,
  enabled button, but WebKit emitted no state-changing native click.
- The retry and five fresh local repetitions passed, proving an intermittent
  native activation boundary rather than a deterministic state bug.
- The product will handle Space and Enter explicitly on keydown and call
  `preventDefault()` so browser-native activation cannot double-toggle.

## 5. Behavioral Requirements (EARS)

- **KA-1:** WHEN a focused available preset receives Space, THE toggle SHALL change selection exactly once without scrolling the page.
- **KA-2:** WHEN a focused available preset receives Enter, THE toggle SHALL change selection exactly once.
- **KA-3:** WHEN a preset is selected by keyboard, THE system SHALL keep it draft-only until the explicit Add action.
- **KA-4:** IF the preset is disabled, THEN keyboard activation SHALL not change selection.

## 6. Verification Criteria and Task Breakdown

1. Add a failing source-contract assertion requiring explicit Space/Enter
   activation and default suppression on the preset toggle.
2. Add the keyboard handler without changing click or persistence behavior.
3. Stress-run the focused browser proof in Chromium and mobile Safari, then
   advance only after all declared gates pass.
