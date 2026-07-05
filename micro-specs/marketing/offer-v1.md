---
spec_id: MS-marketing-offer-v1
status: active
risk_class: ui-only
owner: amankumarshrestha
last_reviewed: 2026-07-05
allowed_blast_radius:
  - micro-specs/marketing/**
  - micro-specs/evidence/MS-marketing-offer-v1.json
  - lib/marketing/facts.ts
  - lib/legal/content.ts
  - app/pricing/**
  - app/(auth)/signup/page.tsx
  - components/marketing/**
  - tests/micro-specs/**
  - tests/e2e/visual.spec.ts-snapshots/**
implementation_surfaces:
  - micro-specs/marketing/offer-v1.md
  - lib/marketing/facts.ts
  - lib/legal/content.ts
  - app/pricing/page.tsx
  - app/(auth)/signup/page.tsx
  - components/marketing/**
  - tests/micro-specs/**
  - tests/e2e/visual.spec.ts-snapshots/**
related_tests:
  - tests/micro-specs/marketing-auth-legal.test.mjs
  - tests/micro-specs/marketing-audit-v2-fixes.test.mjs
  - tests/e2e/public-route-metadata.spec.ts
  - tests/e2e/pricing-checkout-alert.spec.ts
  - tests/e2e/visual.spec.ts
  - tests/e2e/a11y.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm claims:check
  - pnpm jsonld:check
  - pnpm tokens:check
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@public-route-metadata|pricing checkout return alert"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Rendered-HTML proof that /pricing and /signup meta descriptions stay inside the 145-159 code-point budget with the new cancellation constant.
  - Regenerated visual baselines for the routes this offer changes (darwin locally; linux twins from CI per the established runbook).
approved_exceptions: []
---

# MS-marketing-offer-v1 — Offer v1: true cancel-anytime, First-Regular Guarantee, pricing bonus stack

## 1. Exact Goal and User-Visible Outcomes

A venue operator evaluating Nabaperks sees a lower-risk, higher-value offer on
the public marketing surfaces, with no change to price or billing mechanics:

- Cancellation copy no longer carries a notice period anywhere. The public
  promise becomes "cancel anytime from your billing page", and the pricing FAQ
  explains the honest mechanics: cancellation takes effect at the end of the
  current billing month with no further charges (matching the existing Stripe
  portal cancel-at-period-end behaviour — a copy/terms change, not a code
  change).
- /pricing presents the "First-Regular Guarantee": if a venue's live card has
  not brought back a first regular by the end of the 30-day free pilot, the
  pilot stays free until it does. The guarantee states when it applies (from
  the day the venue QR goes live) and how to claim it (support email).
- /pricing presents five named, already-shipped inclusions as a bonus stack
  (poster kit, seeded mystery reward pool, retention automations, privacy
  jobs, operator guides), framed as included — never "normally sold
  separately".
- /signup carries the guarantee line as a trust point at the decision moment.
- /terms records the guarantee as a durable plain-English legal section.

## 2. Blast Radius

May edit: `lib/marketing/facts.ts` (cancellation constants, new GUARANTEE and
OFFER_STACK constants, header governance comment), `app/pricing/page.tsx`
(FAQ rewrite + guarantee FAQ item, after-day-30 box, guarantee block, bonus
stack section), `app/(auth)/signup/page.tsx` (one added trust point),
`lib/legal/content.ts` (one appended platform-terms section),
`components/marketing/**` (only if a small shared renderer for the bonus
stack is cleaner than inlining it in the pricing page), the micro-spec node
tests under `tests/micro-specs/**` (pinned-wording lockstep + new offer
test), visual baselines under `tests/e2e/visual.spec.ts-snapshots/**`, and
this spec + its evidence ledger.

Out of scope — must not change:

- Stripe/billing code, checkout, webhooks, portal, or any subscription
  mechanics (`lib/stripe/**`, `app/app/billing/**`, `app/api/stripe/**`).
  Honouring the guarantee (trial extension) is manual ops via Stripe.
- `PLAN_INCLUDES` content or ordering (the TrustPricing teaser renders its
  first four entries as a plain prefix — MS-marketing-audit-v2-fixes AV-4).
- The home page, spokes, how-it-works, guides, about, llms.txt, sitemap, and
  structured-data helpers, except copy that flows automatically from the
  edited constants.
- Meta title/description template structure on /pricing and /signup (the
  cancellation constant flows through the existing templates).
- Legal pages' privacy sections; venue-level terms builder.
- Scarcity/urgency mechanics (printed-poster cap, seasonal promos) — future
  work requiring an ops decision; not in this spec.

## 3. Strict Constraints and Assumptions

- Meta-description budget: /pricing and /signup descriptions must stay within
  145–159 code points (`@public-route-metadata` e2e). The chosen cancelLine
  wording ("Card required — cancel anytime from your billing page.", 54 code
  points) keeps pricing at ~152 and signup at ~158; do not lengthen it.
- Banned-claims guard (`scripts/check-banned-claims.mjs`): no "fully
  compliant", "GDPR guaranteed", "ICO compliant", "legally approved",
  "certified", or other banned patterns in any new copy. The bonus stack's
  privacy item must describe mechanisms (consent-led separation, 18+ age gate
  at redemption, automatic retention tidy-ups), never a compliance assurance.
- Single-source invariant: "cancel anytime" must never appear as a bare
  literal in acquisition surfaces (trust-pricing, final-cta, proof-strip,
  signup) — only via `PRODUCT.cancelLine` / `PRODUCT.cancelChip`. The
  guarantee and bonus stack must equally render from single-source constants
  in `lib/marketing/facts.ts`.
- All factual claims in bonus-stack copy must match shipped behaviour: five
  A4 poster templates (Editorial, Bold, Ticket, Night Card, Receipt), seeded
  default reward pool, birthday rewards described as optional
  ("switched on"), weekly digest without naming a send day, three guides.
- Wet Ink design system: reuse existing primitives (Section, Eyebrow, Icon,
  existing list/card patterns on /pricing); no new dependencies; must pass
  `pnpm tokens:check`.
- The /pricing FAQ array is the single source for both the rendered FAQ and
  the FAQPage JSON-LD; the guarantee Q&A must flow through it (jsonld:check
  and the marketing-auth-legal FAQ dry-run test both inspect this surface).
- Assumption: the business terms change (dropping the notice period) is
  approved by the owner in this conversation (2026-07-05). Stripe portal
  cancellation already behaves as cancel-at-period-end, so no billing code is
  needed for the copy to be honest.

## 4. Decisions Already Made

Wording is settled — do not re-litigate:

- `PRODUCT.cancelLine`: `"Card required — cancel anytime from your billing page."`
- `PRODUCT.cancelChip`: `"Cancel anytime"`
- New `GUARANTEE` constant: name `"First-Regular Guarantee"`; line `"If your
  live card hasn't brought back a first regular by the end of your 30-day
  pilot, the pilot stays free until it does."`; applies `"Applies from the
  day your venue QR goes live."`; claim referencing `OPERATOR.supportEmail`.
- New `OFFER_STACK` constant, five entries (name + detail):
  1. "Launch-ready till poster kit" — five print-ready A4 posters (Editorial,
     Bold, Ticket, Night Card, Receipt) with the venue QR and counter copy
     already laid out.
  2. "Done-for-you mystery reward pool" — a starter pool of weighted mystery
     rewards seeded with the card; edit it or launch with it as-is.
  3. "Set-and-forget retention automations" — optional birthday treats send
     automatically; a weekly digest of visits, regulars and redemptions.
  4. "Privacy jobs, handled" — consent-led marketing kept separate from
     loyalty, an 18+ age gate at redemption, automatic data-retention
     tidy-ups.
  5. "The operator's loyalty guides" — three practical guides: reward ideas
     that suit a pub, paper vs QR, rewarding regulars without an app.
- Pricing cancel FAQ answer: cancellation takes effect at the end of the
  current billing month, no further charges, earned rewards stay redeemable
  ("no regular is left holding a broken seal" sentence is retained).
- New pricing FAQ item asks what happens if the card doesn't bring back a
  regular and answers with the composed GUARANTEE constant parts.
- Terms gains one appended `PLATFORM_TERMS_SECTIONS` entry
  (`first-regular-guarantee`) defining a first regular as a member who stamps
  again on a later UK date, the remedy (free pilot extension at no charge),
  the applies-from condition, and the support claim path.
- The `facts.ts` header governance comment is amended to record that the
  First-Regular Guarantee is an owner-approved commercial promise
  (2026-07-05), distinct from the still-banned compliance-guarantee claims.
- `tests/micro-specs/marketing-auth-legal.test.mjs` keeps enforcing
  single-source rendering but pins the NEW cancelLine wording; its stale
  "always carries the notice period" comment is rewritten.
- The pinned meta-description templates on /pricing and /signup are not
  restructured; budgets are re-verified empirically.
- New node test file `tests/micro-specs/marketing-offer-v1.test.mjs` pins the
  offer contract (constants exist with approved wording; pricing/signup/terms
  render via the constants; no bare guarantee literals off-constant).

## 5. Behavioral Requirements (EARS)

- THE public marketing surfaces SHALL render cancellation wording only via
  `PRODUCT.cancelLine` / `PRODUCT.cancelChip`, and neither constant SHALL
  mention a notice period.
- WHEN a visitor opens /pricing, THE page SHALL present the First-Regular
  Guarantee name, promise, applies-from condition, and claim path, sourced
  from the `GUARANTEE` constant.
- WHEN a visitor opens /pricing, THE page SHALL list the five OFFER_STACK
  inclusions from the single-source constant, framed as included with the one
  price.
- WHEN a visitor opens /signup, THE trust points SHALL include the guarantee
  line via the `GUARANTEE` constant.
- WHEN a visitor reads the /pricing cancellation FAQ, THE answer SHALL state
  that cancellation takes effect at the end of the current billing month with
  no further charges, and SHALL NOT mention a notice period.
- WHEN a visitor opens /terms, THE platform terms SHALL include a
  First-Regular Guarantee section with the definition, remedy, applies-from
  condition, and claim path.
- THE /pricing FAQPage JSON-LD SHALL include the guarantee question and
  answer (it derives from the same faqs array).
- THE /pricing and /signup meta descriptions SHALL remain within the 145–159
  code-point budget.
- IF any acquisition surface renders "cancel anytime" as a bare literal
  outside the facts constants, THEN THE micro-spec node tests SHALL fail.
- IF new copy introduces a banned compliance claim, THEN `pnpm claims:check`
  SHALL fail.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- Rendered /pricing shows: new cancellation line (no notice period), the
  guarantee block, the bonus-stack section with five items, the rewritten
  cancel FAQ, and the new guarantee FAQ; FAQPage JSON-LD contains the
  guarantee Q&A.
- Rendered /signup shows the guarantee trust point and the new cancellation
  line; its title/OG head is unchanged in structure.
- Rendered /terms shows the First-Regular Guarantee section.
- No rendered public surface mentions "one month's notice" anywhere.
- /pricing and /signup meta descriptions measure 145–159 code points.
- Home/landing surfaces change only through the constants (chip + line
  wording); any visual-baseline drift is re-baselined deliberately.

Task breakdown (implement one at a time, red → green per
`Instructions_tdd.md`):

1. Lockstep test move: update the pinned cancelLine regex + stale comment in
   `marketing-auth-legal.test.mjs`; add `marketing-offer-v1.test.mjs` pinning
   GUARANTEE/OFFER_STACK wording and render-sites — prove red.
2. Edit `lib/marketing/facts.ts`: cancelLine/cancelChip, GUARANTEE,
   OFFER_STACK, header comment — node tests go green.
3. Edit `app/pricing/page.tsx`: cancel FAQ rewrite, guarantee FAQ item,
   after-day-30 box, guarantee block, bonus-stack section.
4. Edit `app/(auth)/signup/page.tsx`: append guarantee trust point.
5. Edit `lib/legal/content.ts`: append the guarantee terms section.
6. Run scoped e2e (metadata budgets + pricing alert), a11y, visual; refresh
   drifted baselines (darwin locally; linux twins per runbook).
7. `pnpm governance:run-gates --spec MS-marketing-offer-v1 --record`, then
   `pnpm governance:advance MS-marketing-offer-v1 --to implemented` on a
   clean tree.
