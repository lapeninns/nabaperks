---
spec_id: MS-marketing-offer-v2
status: implemented
risk_class: ui-only
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/marketing/**
  - micro-specs/evidence/MS-marketing-offer-v2.json
  - lib/marketing/facts.ts
  - lib/legal/content.ts
  - app/pricing/**
  - app/(auth)/signup/page.tsx
  - app/how-it-works/**
  - components/marketing/**
  - tests/micro-specs/**
  - tests/unit/**
  - tests/e2e/visual.spec.ts-snapshots/**
implementation_surfaces:
  - micro-specs/marketing/offer-v2.md
  - micro-specs/evidence/MS-marketing-offer-v2.json
  - lib/marketing/facts.ts
  - lib/legal/content.ts
  - app/pricing/page.tsx
  - app/(auth)/signup/page.tsx
  - app/how-it-works/page.tsx
  - components/marketing/**
  - tests/micro-specs/marketing-offer-v2.test.mjs
  - tests/micro-specs/marketing-auth-legal.test.mjs
  - tests/micro-specs/marketing-offer-v1.test.mjs
  - tests/unit/marketing-offer-facts.test.mjs
  - tests/e2e/visual.spec.ts-snapshots/**
related_tests:
  - tests/micro-specs/marketing-offer-v2.test.mjs
  - tests/unit/marketing-offer-facts.test.mjs
  - tests/micro-specs/marketing-auth-legal.test.mjs
  - tests/micro-specs/marketing-offer-v1.test.mjs
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
  - pnpm test:a11y -- --project=chromium --project=mobile-safari --grep "no axe violations: /(pricing|signup|terms|how-it-works)"
  - pnpm test:visual -- --project=chromium --project=mobile-safari
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Rendered-HTML proof that /pricing and /signup meta descriptions stay inside the 145-159 code-point budget (offer-name, speed and promo copy stay out of the pinned title/description templates).
  - Rendered-HTML proof that the seasonal PROMO renders when PROMO.enabled and is absent when disabled, plus the staleness-tripwire test output.
  - Regenerated visual baselines for the routes this offer changes (darwin locally; linux twins from CI per the established runbook).
approved_exceptions: []
---

# MS-marketing-offer-v2 — Offer v2: named offer, speed lever, justified bonus anchors, rolling seasonal promo

## 1. Exact Goal and User-Visible Outcomes

A UK venue operator evaluating Nabaperks sees a complete Grand Slam Offer —
named, fast-to-value, risk-reversed, and with a genuine time-boxed reason to
act — with no change to the £29 price or billing mechanics. This completes the
Hormozi "Section IV" enhancement layer that offer v1 (MS-marketing-offer-v1)
left open, plus the Value Equation's time-delay lever.

- The offer is **named**: /pricing presents `OFFER.name`
  ("The 30-Day First-Regular Launch") as the offer-section heading. The hero
  product headline ("The loyalty card that just opens.") is unchanged — the
  name is the offer wrapper, not a product rename.
- **Speed / time-to-value**: /pricing (and the hero and /how-it-works) state
  honestly that setup is four guided steps (venue, card, pre-filled rewards,
  QR) and the venue can be live on the counter the same afternoon, with an
  early first-stamp win. Copy is grounded in the real launch checklist — no
  invented minute count.
- **Bonuses**: each of the five `OFFER_STACK` items shows the obstacle it
  removes and, where honestly substantiable, a real external cost/effort
  anchor (e.g. "the posters you'd pay a designer £150+ to make") — never an
  invented "was"/RRP price. The privacy item stays mechanism-described with no
  price.
- **Guarantee**: the First-Regular Guarantee is surfaced more prominently under
  the offer name with a best-case/worst-case framing. Its mechanics are
  unchanged (it is already a conditional service guarantee).
- **Rolling seasonal promo**: a single-source, owner-set promo (real perk, real
  deadline) shows on /pricing, /signup and the hero when `PROMO.enabled`, with
  the deadline as urgency copy; /terms records its plain-English terms. A
  lapsed promo can never silently linger — a CI staleness tripwire fails the
  build once the deadline passes, forcing a deliberate refresh or disable.

## 2. Blast Radius

May edit: `lib/marketing/facts.ts` (new `OFFER`, `SETUP`, `PROMO` constants,
`isPromoStale` helper, `OFFER_STACK` gains `obstacle` + optional `anchor`
fields, header governance note), `app/pricing/page.tsx` (offer-name heading,
speed block, enriched bonus rendering, louder guarantee block, promo strip),
`app/(auth)/signup/page.tsx` (promo trust line), `app/how-it-works/page.tsx`
(four-step speed reinforcement), `lib/legal/content.ts` (one appended promo
terms section), `components/marketing/**` (hero promo eyebrow + speed line;
final-cta / trust-pricing promo/speed; a small shared promo/offer renderer if
cleaner than inlining), the micro-spec node tests under `tests/micro-specs/**`
(new offer-v2 test + lockstep repins), an importing unit test under
`tests/unit/**` (radius amended during implementation: `isPromoStale` is a
`lib/**` function and the `test:coverage` gate requires an importing test to
cover it — the string-contract pins alone cannot), visual baselines under
`tests/e2e/visual.spec.ts-snapshots/**`, and this spec plus its evidence ledger.

Out of scope — must not change:

- Stripe/billing code, checkout, webhooks, portal, subscription mechanics
  (`lib/stripe/**`, `app/app/billing/**`, `app/api/stripe/**`). The promo perk
  and the guarantee are honoured by manual ops (poster fulfilment; Stripe trial
  extension) — no billing code depends on this copy.
- `PLAN_INCLUDES` content or ordering (the TrustPricing teaser prefix,
  MS-marketing-audit-v2-fixes AV-4).
- The /pricing FAQ array and its FAQPage JSON-LD: no new FAQ item is added, so
  the `check-jsonld.mjs` FAQPage question-count pin (6) stays put and
  `scripts/**` is NOT in this radius.
- Meta title/description template structure on /pricing and /signup: the
  offer-name, speed and promo copy live in page BODY, never in the pinned
  templates.
- `PRODUCT.cancelLine` / `PRODUCT.cancelChip` / `GUARANTEE` mechanics wording
  from offer v1 (surfaced more prominently, not reworded).
- The spokes (pubs/cafes/takeaways/bars), guides, about, llms.txt, sitemap and
  structured-data helpers, except copy that flows automatically from the edited
  constants.

## 3. Strict Constraints and Assumptions

- Meta-description budget: /pricing and /signup descriptions must stay within
  145–159 code points (`@public-route-metadata` e2e). /signup already sits at
  158/159 — the offer-name, speed and promo copy MUST NOT enter the pinned
  title/description templates; they are page-body only.
- Banned-claims guard (`scripts/check-banned-claims.mjs`): no "fully compliant",
  "GDPR guaranteed", "ICO compliant", "legally approved", "certified" or other
  banned patterns. The privacy bonus stays mechanism-described (consent-led
  separation, 18+ age gate at redemption, automatic retention tidy-ups) with no
  price anchor.
- CAP-Code honesty on value anchors: every bonus `anchor` must be a genuine
  typical external cost or a genuine effort/time saving — never an invented
  reference/RRP/"was" price and never a fabricated stacked grand total. The
  approved anchor wording is pinned by the offer-v2 node test so an off-spec
  figure cannot slip in silently.
- CAP-Code honesty on the promo: the perk is a genuine "free" (real fulfilment,
  no hidden cost to the venue) and the deadline is real. The guarantee remains
  the one owner-approved commercial exception recorded in the `facts.ts` header.
- Single-source invariant: `OFFER`, `SETUP`, `PROMO` and the enriched
  `OFFER_STACK` all live in `lib/marketing/facts.ts`. No acquisition surface
  (hero, trust-pricing, final-cta, signup, pricing) may render the offer name,
  speed copy, promo copy, or a "cancel anytime"/guarantee line as a bare literal
  off-constant.
- Promo determinism + honesty: the promo render is gated on the build-time
  `PROMO.enabled` boolean (so visual/a11y/e2e baselines are deterministic and do
  not depend on the wall clock). The deadline is displayed as copy. Staleness is
  caught by a node test that fails when `PROMO.enabled` and the deadline is in
  the past, forcing a deliberate refresh/disable rather than a silent vanish or
  a stale past-date.
- Factual grounding for speed copy: matches `lib/merchant/launch-readiness-core`
  — four checklist steps (venue, card, rewards, qr) with the reward pool seeded
  by default; no invented duration.
- Wet Ink design system: reuse existing primitives (Section, Eyebrow, MonoTag,
  ReceiptCard, Icon, existing list/card patterns); no new dependencies; must
  pass `pnpm tokens:check`.
- a11y gate is grep-scoped to the changed public routes that pass locally
  (/pricing, /signup, /terms, /how-it-works). The /login and /start sweep lanes
  fail on env-gapped local machines (customer-auth secrets absent since the
  2026-07-04 split); the home route and full sweep run in CI with secrets
  present.
- Assumptions (owner-approved 2026-07-05, this conversation): scarcity is a
  rolling seasonal promo; bonus values use justified external anchors. The owner
  will confirm/fulfil the real promo perk and deadline at PR review; the shipped
  default (free first counter-poster print+post; deadline 2026-08-31) is a
  placeholder the owner can adjust or disable via `PROMO.enabled`.

## 4. Decisions Already Made

Settled — do not re-litigate:

- `OFFER.name` = `"The 30-Day First-Regular Launch"` (MAGIC: Goal "first
  regular" + Interval "30-day" + Container "Launch"; Avatar added per surface).
  Rendered as the /pricing offer-section heading. Hero headline unchanged.
- New `SETUP` constant, fields: `line` ("Live on your counter the same
  afternoon."), `steps` ("Four guided steps — add your venue, build the card,
  confirm your pre-filled rewards, and print your QR."), `noFriction` ("No app
  to build, no POS to connect, nothing to install."), `earlyWin` ("Your first
  member can stamp the moment the poster hits the counter.").
- `OFFER_STACK` gains `obstacle` (the objection it kills) and optional `anchor`
  (real external comparison) per item:
  1. Launch-ready till poster kit — anchor "the counter posters you'd pay a
     freelance designer £150+ to make" (five A4 designs; UK freelance design
     ~£30–80 each).
  2. Done-for-you mystery reward pool — obstacle "blank-page reward setup"; no
     price anchor (effort framing only).
  3. Set-and-forget retention automations — anchor "the birthday messages and
     weekly numbers you'd otherwise chase by hand every week" (time saving).
  4. Privacy jobs, handled — mechanism-described only; NO price, NO compliance
     claim.
  5. The operator's loyalty guides — qualitative (three guides from behind the
     bar); no price.
  No fabricated stacked grand total.
- `GUARANTEE` mechanics unchanged; add a best-case/worst-case framing sentence
  composed from the constant on /pricing: best case regulars return and it pays
  for itself; worst case you pay nothing more until one does.
- New `PROMO` constant, shape `{ enabled, name, perk, endDateISO, claim }`, and
  an `isPromoStale(promo, nowISO)` helper. Default: enabled `true`, name
  "Summer First-Regular promo", perk "Go live by 31 August 2026 and we print and
  post your first counter-poster run, free.", endDateISO "2026-08-31", claim via
  `OPERATOR.supportEmail`. Render gated on `PROMO.enabled`.
- Promo terms appended to `lib/legal/content.ts` `PLATFORM_TERMS_SECTIONS`
  (id `summer-first-regular-promo`): who qualifies (venues live by the date),
  the perk, that it is limited-time and may be withdrawn or refreshed, and the
  support claim path.
- No new /pricing FAQ item; no JSON-LD change (keeps the jsonld FAQPage pin at
  6 and `scripts/**` out of the radius).
- Meta title/description templates unchanged; budgets re-verified empirically.
- New node test `tests/micro-specs/marketing-offer-v2.test.mjs` pins the
  OFFER/SETUP/PROMO/anchor wording and render sites, the no-bare-literal
  invariant, and the promo staleness tripwire. `marketing-offer-v1` and
  `marketing-auth-legal` lockstep tests are repinned only if their assertions
  overlap the changed render sites.

## 5. Behavioral Requirements (EARS)

- THE public marketing surfaces SHALL render the offer name, speed copy, bonus
  obstacle/anchor text, guarantee and promo only via single-source constants in
  `lib/marketing/facts.ts`.
- WHEN a visitor opens /pricing, THE page SHALL present `OFFER.name` as the
  offer-section heading while leaving the hero product headline unchanged.
- WHEN a visitor opens /pricing, THE page SHALL present the four-step,
  same-afternoon speed copy from `SETUP`, grounded in the real launch checklist.
- WHEN a visitor opens /pricing, THE page SHALL show, for each `OFFER_STACK`
  item, its obstacle and — where the item defines one — its justified external
  anchor.
- WHEN a visitor opens /pricing, THE page SHALL present the First-Regular
  Guarantee prominently under the offer name with the best-case/worst-case
  framing, sourced from `GUARANTEE`.
- WHILE `PROMO.enabled` is true, THE /pricing, /signup and hero surfaces SHALL
  render the promo name, perk and deadline from `PROMO`.
- IF `PROMO.enabled` is false, THEN no public surface SHALL render any promo
  copy.
- WHEN a visitor opens /terms, THE platform terms SHALL include the seasonal
  promo terms section.
- THE /pricing and /signup meta descriptions SHALL remain within 145–159 code
  points, with offer-name, speed and promo copy kept out of the pinned
  templates.
- IF any acquisition surface renders the offer name, speed, promo, or a
  guarantee/"cancel anytime" line off-constant, THEN the offer-v2 node tests
  SHALL fail.
- IF `PROMO.enabled` is true and `PROMO.endDateISO` is in the past, THEN the
  offer-v2 staleness test SHALL fail.
- IF new copy introduces a banned compliance claim, THEN `pnpm claims:check`
  SHALL fail.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- Rendered /pricing shows: the offer name heading, the four-step same-afternoon
  speed block, each bonus with its obstacle and (where defined) its anchor, the
  prominent guarantee block with best/worst framing, and the promo strip with
  its deadline — all from constants.
- Rendered /signup shows the promo trust line (when enabled); its title/OG head
  is unchanged in structure and its meta description stays within budget.
- Rendered hero shows the promo eyebrow (when enabled) and the speed line, with
  the product headline unchanged.
- Rendered /how-it-works reinforces the four-step speed framing.
- Rendered /terms shows the seasonal promo terms section.
- Toggling `PROMO.enabled` to false removes every promo surface; an
  enabled promo with a past `endDateISO` fails the staleness test.
- /pricing and /signup meta descriptions measure 145–159 code points.
- No banned compliance claim or off-constant literal on any acquisition surface.

Task breakdown (implement one at a time, red → green per `Instructions_tdd.md`):

1. Add `tests/micro-specs/marketing-offer-v2.test.mjs` pinning OFFER/SETUP/PROMO
   and the bonus anchors, the render sites, the no-bare-literal invariant, and
   the promo staleness tripwire — prove red.
2. Edit `lib/marketing/facts.ts`: add `OFFER`, `SETUP`, `PROMO`,
   `isPromoStale`; enrich `OFFER_STACK` with `obstacle`/`anchor`; amend the
   header note — node tests go green.
3. Edit `app/pricing/page.tsx`: offer-name heading, speed block, enriched bonus
   rendering, louder guarantee block with best/worst framing, promo strip.
4. Edit `app/(auth)/signup/page.tsx` and the hero: promo line/eyebrow + speed
   line via the constants.
5. Edit `app/how-it-works/page.tsx`: four-step speed reinforcement.
6. Edit `lib/legal/content.ts`: append the seasonal promo terms section.
7. Run scoped e2e (metadata budgets + pricing alert), a11y, visual; refresh
   drifted baselines (darwin locally; linux twins per runbook).
8. `pnpm governance:run-gates --spec MS-marketing-offer-v2 --record`, then
   `pnpm governance:advance MS-marketing-offer-v2 --to implemented` on a clean
   tree.
