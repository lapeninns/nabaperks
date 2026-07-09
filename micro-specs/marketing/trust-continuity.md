---
spec_id: MS-marketing-trust-continuity
status: implemented
risk_class: ui-only
owner: codex
last_reviewed: 2026-07-09
allowed_blast_radius:
  - micro-specs/marketing/**
  - micro-specs/evidence/MS-marketing-trust-continuity.json
  - docs/product/grand-slam-offer.md
  - lib/marketing/**
  - lib/legal/content.ts
  - lib/seo/structured-data.ts
  - components/marketing/**
  - app/page.tsx
  - app/layout.tsx
  - app/opengraph-image.tsx
  - app/about/**
  - app/demo/**
  - app/pricing/**
  - app/how-it-works/**
  - app/(auth)/signup/page.tsx
  - app/loyalty-for-*/**
  - app/guides/**
  - public/llms.txt
  - scripts/check-banned-claims.mjs
  - scripts/check-jsonld.mjs
  - tests/unit/marketing-offer-facts.test.mjs
  - tests/unit/marketing-promo.test.mjs
  - tests/unit/marketing-trust-continuity.test.mjs
  - tests/micro-specs/landing-conversion-spine.test.mjs
  - tests/micro-specs/marketing-audit-v2-fixes.test.mjs
  - tests/micro-specs/marketing-auth-legal.test.mjs
  - tests/micro-specs/marketing-offer-v2.test.mjs
  - tests/micro-specs/marketing-persona-spokes.test.mjs
  - tests/micro-specs/marketing-polish.test.mjs
  - tests/micro-specs/marketing-trust-continuity.test.mjs
  - tests/e2e/helpers/merchant-marketing-trust.ts
  - tests/e2e/merchant-marketing-trust.spec.ts
  - tests/e2e/merchant-marketing-trust.desktop.spec.ts
  - tests/e2e/visual.spec.ts-snapshots/**
implementation_surfaces:
  - micro-specs/marketing/trust-continuity.md
  - micro-specs/evidence/MS-marketing-trust-continuity.json
  - docs/product/grand-slam-offer.md
  - lib/marketing/**
  - lib/legal/content.ts
  - lib/seo/structured-data.ts
  - components/marketing/**
  - app/page.tsx
  - app/layout.tsx
  - app/opengraph-image.tsx
  - app/about/**
  - app/demo/**
  - app/pricing/**
  - app/how-it-works/**
  - app/(auth)/signup/page.tsx
  - app/loyalty-for-*/**
  - app/guides/**
  - public/llms.txt
  - scripts/check-banned-claims.mjs
  - scripts/check-jsonld.mjs
  - tests/unit/marketing-offer-facts.test.mjs
  - tests/unit/marketing-promo.test.mjs
  - tests/unit/marketing-trust-continuity.test.mjs
  - tests/micro-specs/landing-conversion-spine.test.mjs
  - tests/micro-specs/marketing-audit-v2-fixes.test.mjs
  - tests/micro-specs/marketing-auth-legal.test.mjs
  - tests/micro-specs/marketing-offer-v2.test.mjs
  - tests/micro-specs/marketing-persona-spokes.test.mjs
  - tests/micro-specs/marketing-polish.test.mjs
  - tests/micro-specs/marketing-trust-continuity.test.mjs
  - tests/e2e/helpers/merchant-marketing-trust.ts
  - tests/e2e/merchant-marketing-trust.spec.ts
  - tests/e2e/merchant-marketing-trust.desktop.spec.ts
  - tests/e2e/visual.spec.ts-snapshots/**
related_docs:
  - DESIGN.md
  - micro-specs/GLOBAL_CONTEXT.md
  - docs/product/grand-slam-offer.md
related_tests:
  - tests/unit/marketing-trust-continuity.test.mjs
  - tests/unit/marketing-promo.test.mjs
  - tests/unit/marketing-offer-facts.test.mjs
  - tests/micro-specs/marketing-trust-continuity.test.mjs
  - tests/micro-specs/marketing-offer-v2.test.mjs
  - tests/micro-specs/marketing-polish.test.mjs
  - tests/micro-specs/marketing-audit-v2-fixes.test.mjs
  - tests/micro-specs/marketing-auth-legal.test.mjs
  - tests/micro-specs/marketing-persona-spokes.test.mjs
  - tests/micro-specs/landing-conversion-spine.test.mjs
  - tests/e2e/merchant-marketing-trust.spec.ts
  - tests/e2e/merchant-marketing-trust.desktop.spec.ts
  - tests/e2e/public-route-metadata.spec.ts
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
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-marketing-trust-continuity"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari --grep-invert "Given harness"
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for every declared verification gate.
  - Rendered mobile and desktop proof that price appears before the first major interaction on home and beside account creation on signup.
  - Rendered and source-contract proof that no acquisition route publishes computed scarcity, absolute anti-fraud promises, unsupported time-to-value claims, or unverified quantitative results.
  - Regenerated approved visual baselines for changed public routes, with Linux twins supplied by CI.
approved_exceptions: []
---

# MS-marketing-trust-continuity — Make merchant acquisition claims truthful and activation-continuous

## 1. Exact Goal and User-Visible Outcomes

A UK venue operator moving from discovery to account creation sees the same
truthful commercial and activation contract on every public acquisition route:
30 days free, then £49/month per venue; four configuration steps followed by
billing activation; and venue-linked stamp controls described exactly as the
product enforces them. The journey does not manufacture scarcity, promise an
unsupported setup or repeat-visit time, claim that fraud is impossible, or
publish quantitative proof that cannot be regenerated from durable evidence.

## 2. Blast Radius

May edit the shared marketing facts and promo model, public marketing pages,
marketing components, legal/promo wording, public structured data and llms.txt,
the claim and JSON-LD guards, the existing offer document, focused node and
browser tests, and visual snapshots listed in frontmatter.

Out of scope: merchant authentication behaviour, onboarding writes, Stripe
state transitions, reward persistence, database schemas/RLS/RPCs, analytics
event delivery, customer journeys, and production configuration. Those audit
findings are separate Micro-Specs so this UI-only slice cannot blur their risk
or evidence requirements.

## 3. Strict Constraints and Assumptions

- The live commercial contract remains a 30-day free pilot, £49/month per
  venue, an optional £490/year plan, no contract, and the existing cancellation
  and First-Regular Guarantee terms.
- Promo copy may state the real monthly deadline and included first poster run,
  but SHALL NOT state a remaining count, claimed count, fixed monthly capacity,
  or other availability number until a durable reservation ledger exists.
- Public quantitative results, including the Counter-Loyalty Index Dataset,
  SHALL remain unpublished until the values, denominators, dates, and
  methodology can be regenerated from durable source evidence. Hiding visible
  tiles while leaving JSON-LD or llms.txt figures is not sufficient.
- Stamp language SHALL describe only implemented controls: a valid permanent
  venue QR, a saved membership on the live programme, one stamp per customer
  per UK calendar date, optional unusual-location flags, and staff-scanned live
  reward collection. Location checks flag rather than reject a stamp.
- Billing is the fifth activation gate. A customer can join or stamp only after
  billing is active and the live venue QR is available.
- Keep Wet Ink foundations, semantic markup, visible copy/structured-data
  parity, current route metadata budgets, and the existing dependency set.

## 4. Decisions Already Made

- Remove deterministic scarcity immediately; do not replace it with vague
  pseudo-scarcity or a random number.
- Retain the named monthly First-Regular promo, honest deadline, free first
  poster run, and support claim route without publishing capacity figures.
- Replace the public term “counter-verified” with “venue-linked” or explicit
  mechanism copy. Do not use “can't be faked”, “fraud is designed out”, or
  equivalent absolutes.
- Describe the merchant path as four setup steps plus billing activation, or
  five guided steps including billing. Remove “about five minutes”, “same
  afternoon”, and unqualified first-stamp promises.
- Put the £49/month continuation price in the initial home decision area and
  inside the signup account card, not only in metadata or later sections.
- Unpublish all fixed aggregate figures and their Dataset schema now. A later
  evidence Micro-Spec may republish reconciled values from durable proof.
- Replace the unsupported first-week outcome line with language that asks the
  merchant to judge the pilot from their own recorded visits and returns.

## 5. Behavioral Requirements (EARS)

- THE acquisition journey SHALL show “30 days free, then £49/month per venue” before a merchant starts signup.
- WHEN the signup page renders, THE account card SHALL state the post-pilot £49/month per-venue price before the form fields.
- WHEN the monthly promo is enabled, THE public surfaces SHALL show its real deadline, included poster run, and support claim route without numeric availability.
- THE public acquisition surface SHALL NOT derive or render spots remaining, venues claimed, or monthly onboarding capacity from the calendar.
- THE stamp explanation SHALL state that customers claim from the venue QR, the claim is linked to their saved membership and live programme, and the hard limit is one stamp per customer per UK date.
- WHERE optional location checks are mentioned, THE copy SHALL state that they flag unusual claims rather than blocking them.
- WHERE reward integrity is mentioned, THE copy SHALL state that venue staff collect a reward by scanning the customer's live reward QR.
- THE public acquisition surface SHALL NOT state or imply that stamps cannot be faked, all fraud is prevented, or a physical counter check occurs for every stamp.
- THE merchant setup promise SHALL name four configuration steps followed by billing activation, and SHALL gate the first join/stamp on active billing plus the live QR.
- THE acquisition journey SHALL NOT promise a five-minute setup, same-afternoon launch, or first repeat visit within one week.
- WHILE quantitative proof lacks reproducible durable evidence, THE application SHALL omit the figures from rendered pages, metadata, JSON-LD, llms.txt, and case-study support copy.
- WHEN public metadata or structured data changes, THE route-specific canonical, description-budget, FAQ, HowTo, Offer, and Organization contracts SHALL remain valid.

## 6. Verification Criteria and Task Breakdown

Verification criteria:

- At mobile and desktop widths, home shows the pilot-to-price continuation in
  the initial decision area and signup shows it before the account fields.
- Home, pricing, signup, mechanism, persona, guide, legal, llms.txt, and schema
  surfaces contain no deterministic scarcity or unsupported claim variants.
- The visible setup narrative names billing and never suggests the poster alone
  makes stamping possible.
- The public graph contains no unverified aggregate Dataset, while all remaining
  JSON-LD nodes retain connected IDs and visible-copy parity.
- Unit tests prove the promo API has no scarcity fields and the setup contract
  includes billing; source-contract tests scan all acquisition surfaces; tagged
  Playwright tests prove rendered continuity on Chromium and Mobile Safari.
- Lint, typecheck, build, node suites, coverage, bundle, claims, JSON-LD,
  tokens, tagged e2e, a11y, and visual gates all pass.

Task breakdown:

1. Add failing unit, source-contract, and rendered browser tests for the trust
   and price-continuity requirements.
2. Simplify the promo model and update promo/legal renderers.
3. Correct the shared setup, stamp-mechanism, pricing, and signup copy across
   every public acquisition route and metadata mirror.
4. Remove quantitative proof from visible content, guides, llms.txt, and the
   public JSON-LD graph; update the JSON-LD guard to assert the new honest graph.
5. Refactor duplicated copy back to shared facts, regenerate visual baselines,
   run `pnpm governance:run-gates --spec MS-marketing-trust-continuity --record`,
   and advance only after the full gate set is green on a clean tree.
