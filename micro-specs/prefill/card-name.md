---
spec_id: MS-prefill-card-name
status: active
risk_class: ui-only
owner: claude
last_reviewed: 2026-07-07
allowed_blast_radius:
  - micro-specs/prefill/**
  - components/merchant/launch/card-panel.tsx
  - lib/merchant/loyalty-card-copy.ts
  - tests/unit/loyalty-card-name.test.mjs
implementation_surfaces:
  - components/merchant/launch/card-panel.tsx
  - lib/merchant/loyalty-card-copy.ts
  - tests/unit/loyalty-card-name.test.mjs
related_tests:
  - tests/unit/loyalty-card-name.test.mjs
  - tests/e2e/merchant-reward-presets-flow.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e -- --grep "@reward-presets"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Node unit test output proving defaultLoyaltyCardName personalisation, empty-name fallback, and the length-limit fallback.
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-prefill-card-name — Business-personalised loyalty card name default

## 1. Exact Goal and User-Visible Outcomes

When a merchant opens the card builder for a venue that has no saved loyalty card
yet, the "Card name" field is pre-filled with their own business name followed by
" Mystery Card" (for example, "The Old Crown Mystery Card") instead of the generic
"Mystery Visit Card". The suggestion is editable and is not saved until the
merchant submits the form. A venue whose card already exists is unaffected — its
saved name still shows.

## 2. Blast Radius

In scope:

- `lib/merchant/loyalty-card-copy.ts` — add a `defaultLoyaltyCardName(businessName)`
  helper next to the existing reward-terms defaults.
- `components/merchant/launch/card-panel.tsx` — use the helper for the new-card
  `cardName` fallback (currently the literal `"Mystery Visit Card"`).
- `tests/unit/loyalty-card-name.test.mjs` — new unit coverage.

Out of scope: the reward-terms default, stamps default, the save action
(`app/app/card/actions.ts`), the loyalty-card form component, any schema or DB
change, and the DB-free launch harness fixture (it mounts the form directly with
its own values and does not exercise this server-loader default).

## 3. Strict Constraints and Assumptions

- The default is prefill only. It reaches the database solely through the existing
  explicit "Create card" submit; this change adds no persistence.
- No new dependencies; en-GB Wet Ink copy; the composed name must respect the
  existing 80-character card-name field limit.
- `merchant.business_name` is already loaded in `CardPanel` and passed to the form
  as `merchantName`; reuse it, do not refetch.
- Assumption: business names are short venue names; when the composed default would
  exceed the field limit, the generic name is an acceptable safe fallback.

## 4. Decisions Already Made

- The personalised format is `"<business name> Mystery Card"`.
- The generic fallback string stays `"Mystery Visit Card"` (unchanged from today).
- The default logic lives in `lib/**` (unit-testable for coverage), mirroring
  `resolveLoyaltyCardRewardTerms` / `defaultLoyaltyCardRewardTerms`.

## 5. Behavioral Requirements (EARS)

- WHEN a merchant opens the card builder for a venue with no saved loyalty card,
  THE card builder SHALL pre-fill the card name with the venue business name
  followed by " Mystery Card".
- IF the venue business name is empty or whitespace only, THEN THE card builder
  SHALL pre-fill the card name with "Mystery Visit Card".
- IF the composed personalised name would exceed the 80-character card-name limit,
  THEN THE card builder SHALL pre-fill the card name with "Mystery Visit Card".
- WHEN a saved loyalty card already exists for the venue, THE card builder SHALL
  show the saved card name unchanged.
- THE pre-filled card name SHALL NOT be persisted until the merchant submits the
  card form.

## 6. Verification Criteria and Task Breakdown

Observable behaviours to verify:

- `defaultLoyaltyCardName("The Old Crown")` yields "The Old Crown Mystery Card".
- `defaultLoyaltyCardName("")`, `"   "`, `null`, and `undefined` yield
  "Mystery Visit Card".
- A business name long enough that "<name> Mystery Card" exceeds 80 characters
  yields "Mystery Visit Card".
- The `@reward-presets` launch card harness still prefills cadence presets (no
  regression on the card surface).

Tasks:

1. Add the `defaultLoyaltyCardName` helper + unit tests (personalise, empty-name
   fallback, length fallback).
2. Wire the helper into the `CardPanel` no-card `cardName` fallback.
3. Run the declared gates and record evidence with
   `pnpm governance:run-gates --spec MS-prefill-card-name --record`, then advance.
