---
spec_id: MS-prefill-send-reward
status: active
risk_class: ui-only
owner: claude
last_reviewed: 2026-07-07
allowed_blast_radius:
  - micro-specs/prefill/**
  - components/merchant/send-reward-form.tsx
  - app/app/customers/send-reward/page.tsx
  - app/dev/app-harness/send-reward/page.tsx
  - tests/e2e/merchant-send-reward.spec.ts
implementation_surfaces:
  - components/merchant/send-reward-form.tsx
  - app/app/customers/send-reward/page.tsx
  - app/dev/app-harness/send-reward/page.tsx
  - tests/e2e/merchant-send-reward.spec.ts
related_tests:
  - tests/e2e/merchant-send-reward.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e -- --grep "@merchant-flow merchant send reward"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Playwright @merchant-flow send-reward output proving a preset chip prefills the name and terms without sending, and the existing render tests still pass.
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-prefill-send-reward — Prefill send-reward name and terms from presets

## 1. Exact Goal and User-Visible Outcomes

The Send-a-reward form shows a row of one-tap "Quick fill" chips above the reward
name field, one per business-typed reward preset (the same presets used by the
loyalty reward pool). Tapping a chip fills the reward name and reward terms with
that preset's copy, which the merchant can edit. Nothing is sent until the
existing "Send reward" action; a chip only fills the draft. The name and terms a
merchant types are preserved if the form comes back with a validation error.

## 2. Blast Radius

In scope:

- `components/merchant/send-reward-form.tsx` — a `presets` prop, controlled
  name/terms fields, and the chip row.
- `app/app/customers/send-reward/page.tsx` — resolve presets from
  `merchant.business_type`.
- `app/dev/app-harness/send-reward/page.tsx` — feed the harness a fixed set for
  the DB-free e2e.
- e2e coverage.

Out of scope: `lib/merchant/reward-presets.ts` (reused as-is, not modified), the
send action and its validation, the recently-sent list, the expiry/message
fields, and any schema change.

## 3. Strict Constraints and Assumptions

- Prefill only. Tapping a chip mutates local draft state; it never sends or
  persists. This is the program invariant.
- The reward preset copy is reused unchanged from `reward-presets.ts` (already
  owner-approved); no new copy is introduced.
- Name and terms become controlled React state so a chip can fill them; the fields
  must still preserve their values across a validation-error re-render.
- `merchant.business_type` is already loaded on the send-reward page; reuse it via
  the existing `rewardPresetsForBusinessType` selector.
- No new dependencies.

## 4. Decisions Already Made

- Reuse the existing business-typed reward presets rather than a new copy set.
- A chip fills both name and terms; the chip row sits above the name field.
- Chip labels show the preset's reward name.
- The component takes a resolved `presets` array; the server page runs the selector.

## 5. Behavioral Requirements (EARS)

- WHERE the form is given one or more presets, THE form SHALL render a labelled
  chip for each preset above the reward name field.
- WHEN the merchant taps a preset chip, THE form SHALL set the reward name and
  reward terms fields to that preset's name and terms.
- IF a preset chip is tapped, THEN THE form SHALL NOT send the reward; only the
  Send reward action sends.
- THE send-reward page SHALL select the preset set from the merchant's
  `business_type`.
- WHERE the form is given no presets, THE form SHALL render no chip row and behave
  exactly as before.
- WHILE a validation error is shown, THE reward name and reward terms fields SHALL
  preserve the merchant's current values.

## 6. Verification Criteria and Task Breakdown

Observable behaviours to verify:

- In the DB-free harness, tapping the "Regulars' pint" chip fills the reward name
  with "Regulars' pint" and the terms with the preset copy, and does not show the
  "Reward sent." banner (e2e).
- The existing contact-entry and membership-prefilled render tests still pass
  (e2e regression).

Tasks:

1. Make the name/terms fields controlled and add the `presets` prop + chip row.
2. Resolve presets from `business_type` on the real page; feed the harness a set.
3. Extend the `@merchant-flow` send-reward flow with the prefill-not-sent assertion.
4. Run the declared gates, record evidence, and advance.
