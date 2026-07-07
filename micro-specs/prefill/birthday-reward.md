---
spec_id: MS-prefill-birthday-reward
status: implemented
risk_class: ui-only
owner: claude
last_reviewed: 2026-07-07
allowed_blast_radius:
  - micro-specs/prefill/**
  - components/merchant/launch/birthday-reward-form.tsx
  - components/merchant/launch/birthday-panel.tsx
  - components/merchant/launch/rewards-panel.tsx
  - app/dev/app-harness/launch/page.tsx
  - lib/merchant/birthday-reward-template.ts
  - tests/unit/birthday-reward-template.test.mjs
  - tests/e2e/merchant-birthday-config.spec.ts
implementation_surfaces:
  - components/merchant/launch/birthday-reward-form.tsx
  - components/merchant/launch/birthday-panel.tsx
  - components/merchant/launch/rewards-panel.tsx
  - app/dev/app-harness/launch/page.tsx
  - lib/merchant/birthday-reward-template.ts
  - tests/unit/birthday-reward-template.test.mjs
  - tests/e2e/merchant-birthday-config.spec.ts
related_tests:
  - tests/unit/birthday-reward-template.test.mjs
  - tests/e2e/merchant-birthday-config.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e -- --grep "@merchant-flow merchant birthday config"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Node unit test output proving birthday template limits, business-type mapping, and clean copy (no emoji or exclamation marks).
  - Playwright @merchant-flow birthday output proving switching on prefills the template and switching off leaves the submitted name field empty.
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-prefill-birthday-reward — Business-typed birthday reward prefill

## 1. Exact Goal and User-Visible Outcomes

When a merchant switches the optional birthday treat on for the first time, the
reward name and terms are pre-filled with a ready-made, business-typed suggestion
(for example a pub sees "Birthday drink on us") instead of two blank required
fields. The merchant can edit the copy and save. Switching the treat off again
drops an un-saved suggestion, so saving with the treat off never stores template
copy the merchant did not commit; a previously saved reward is kept.

## 2. Blast Radius

In scope:

- `lib/merchant/birthday-reward-template.ts` — the business-typed birthday
  templates and selector.
- `components/merchant/launch/birthday-reward-form.tsx` — controlled name/terms,
  a `template` prop, prefill-on-enable, and restore-on-disable.
- `components/merchant/launch/birthday-panel.tsx` — pass the template through.
- `components/merchant/launch/rewards-panel.tsx` — resolve the template from
  `merchant.business_type`.
- `app/dev/app-harness/launch/page.tsx` — feed the harness a fixed template.
- Unit + e2e coverage.

Out of scope: the birthday save action and its validation, the birthday cron, the
reward pool, the loyalty card fields, and any schema change.

## 3. Strict Constraints and Assumptions

- Prefill only. The template fills local draft state on enable; nothing is
  persisted until the merchant saves. This is the program invariant, and it is
  specifically enforced for the disabled case (an un-saved template must not be
  written by a disabled save).
- en-GB Wet Ink copy; reward name within 100 characters and terms within the
  12–500 range the save action enforces; no emoji or exclamation marks.
- Templates live in `lib/**` (unit-testable) and are business-typed, mirroring
  the reward-preset and announcement-template selectors.
- `merchant.business_type` is already loaded in the rewards panel; reuse it.
- No new dependencies.

## 4. Decisions Already Made

- Owner-approved, agent-drafted birthday copy (pub / cafe / generic).
- Prefill happens on switch-on only, and only into blank fields (an existing saved
  reward is never overwritten).
- Switch-off restores the last saved values, so a disabled save carries the stored
  copy (empty for a new reward), never a fresh template.
- Name/terms become controlled React state; the rewards panel runs the selector.

## 5. Behavioral Requirements (EARS)

- WHEN the merchant switches the birthday treat on and the name or terms are
  blank, THE form SHALL fill the blank field from the business-typed template.
- WHEN the merchant switches the birthday treat on and a field already has a
  value, THE form SHALL leave that field unchanged.
- WHEN the merchant switches the birthday treat off, THE form SHALL restore the
  name and terms to the last saved values.
- IF the birthday treat is off when the form is saved, THEN THE form SHALL NOT
  submit an un-saved template; it submits the stored copy (empty for a new reward).
- THE rewards panel SHALL select the birthday template from the merchant's
  `business_type`.
- THE birthday template name SHALL fit 100 characters and the terms the 12–500
  range, with no emoji or exclamation marks.

## 6. Verification Criteria and Task Breakdown

Observable behaviours to verify:

- The template name/terms fit the field limits and mapping is pub / cafe-family /
  generic (unit).
- In the DB-free harness, switching the treat on fills the name with
  "Birthday drink on us" and the terms with the pub template copy (e2e).
- After switching on then off, the submitted `rewardName` field is empty — the
  un-saved template is dropped (e2e).

Tasks:

1. Add the birthday template lib + unit tests.
2. Make the form's name/terms controlled; prefill on enable, restore on disable.
3. Thread the template through the panel, the rewards panel (from business_type),
   and the harness.
4. Extend the `@merchant-flow` birthday flow with the prefill and drop-on-disable
   assertions.
5. Run the declared gates, record evidence, and advance.
