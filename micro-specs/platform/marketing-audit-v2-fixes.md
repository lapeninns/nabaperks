---
spec_id: MS-marketing-audit-v2-fixes
status: implemented
risk_class: ui-only
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-05
allowed_blast_radius:
  - app/(auth)/signup/page.tsx
  - app/about/**
  - app/pricing/**
  - app/loyalty-for-pubs/**
  - app/loyalty-for-cafes/**
  - app/loyalty-for-takeaways/**
  - app/loyalty-for-bars/**
  - components/marketing/landing/**
  - lib/marketing/facts.ts
  - scripts/check-jsonld.mjs
  - public/llms.txt
  - tests/micro-specs/**
  - tests/e2e/**
  - micro-specs/platform/**
  - reports/**
implementation_surfaces:
  - app/(auth)/signup/page.tsx
  - app/about/page.tsx
  - app/pricing/page.tsx
  - app/loyalty-for-pubs/page.tsx
  - app/loyalty-for-cafes/page.tsx
  - app/loyalty-for-takeaways/page.tsx
  - app/loyalty-for-bars/page.tsx
  - components/marketing/landing/trust-pricing.tsx
  - components/marketing/landing/venue-proof.tsx
  - components/marketing/landing/counter-verified-stamp.tsx
  - lib/marketing/facts.ts
  - scripts/check-jsonld.mjs
  - public/llms.txt
related_docs:
  - DESIGN.md
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/platform/marketing-persona-spokes.md
  - micro-specs/platform/marketing-multipage.md
  - micro-specs/platform/landing-conversion-spine.md
  - reports/marketing-audit-2026-07-05-v2.md
related_tests:
  - tests/micro-specs/marketing-audit-v2-fixes.test.mjs
  - tests/micro-specs/marketing-persona-spokes.test.mjs
  - tests/e2e/public-route-metadata.spec.ts
  - tests/e2e/visual.spec.ts
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
  - pnpm test:e2e
  - pnpm test:a11y
  - pnpm test:visual
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Rendered-HTML proof that no two routes emit the same HowTo @id with different step text, and that /signup serves a unique title, an in-budget description, a self-canonical and an OG block.
  - Regenerated visual baselines for the three redesigned spokes (darwin locally; linux twins from CI per the established runbook).
approved_exceptions: []
---

# MS-marketing-audit-v2-fixes — Implement the v2 marketing-audit findings (schema id, /signup metadata, spoke wedge redesign, copy/guard polish)

## Intent

`reports/marketing-audit-2026-07-05-v2.md` found two P1 defects invisible to
the current guards and a set of P2 polish items, and the owner approved
implementing them ("Proceed to fix them, redesign, recreate, solely based on
the Audit", 2026-07-05) — including the audit's Phase B recommendation, which
resolves the report's open question 1 as YES.

This spec PARTIALLY SUPERSEDES **MS-marketing-persona-spokes PS-1** (precedent:
MS-landing-conversion-spine partially superseding HW-1): the cafe/takeaway/bar
spoke composition drops `ComparisonTable` in favour of a single merged
"mechanism wedge" band, so `/how-it-works` becomes the sole comparison
authority for the persona spokes (the pub hub keeps the table). PS-2..PS-7
remain binding unmodified; PS-3's route-distinct HowTo id rule is EXTENDED to
the pub hub, whose default-id collision with the home graph is the audit's
P1-1.

## Exact goal and user-visible outcomes

- A crawler merging the site's JSON-LD never sees two different HowTo payloads
  at one `@id`: the pub hub emits `/loyalty-for-pubs#howto`.
- `/signup` serves its own title, a 145–159-char description carrying the
  cancellation term, a self-canonical (so `?email=` variants collapse), and
  the same OG/twitter shape as every other marketing route.
- A visitor reading a second persona spoke no longer re-reads the full
  comparison table: cafe/takeaway/bar close with a short venue-true wedge that
  links to the comparison on `/how-it-works#no-app`. Spokes shrink by roughly
  1.3 mobile screens each.
- The plan-includes list exists once, in `lib/marketing/facts.ts`; the
  TrustPricing teaser is its first four items and `/pricing` renders the full
  five, with one digest wording everywhere.
- The "What pubs say" quotes disclose the operator relationship wherever they
  render; `/about` carries operator attribution in its page graph.
- `pnpm jsonld:check` would now CATCH the defects this spec fixes (hub `@id`,
  guide dates) if they regressed.

## Blast radius: out of scope

- The home page (`app/page.tsx`), `/how-it-works` composition, pub-hub
  composition beyond the HowTo id, guides bodies, FAQ export values,
  `counterFlowSteps`/`pubCounterFlowSteps` values: unchanged.
- Audit open questions 2 and 4 (home title head terms; query-shaped answer H2
  on `/`) are deliberately NOT implemented — they remain owner decisions.
- No new dependencies, routes, sitemap/CSP/robots changes, or schema helpers.
- `RegularsCalculator`, `NabaperksProof`, `CounterFlow` stay on all spokes
  (proof band consistency and HowTo visible-parity are load-bearing).

## Strict constraints

- Wet Ink only; approved facts only; `claims:check` green. The wedge band's
  wallet-pass claim MUST keep the approved hedge ("Most …"), never an
  absolute; `public/llms.txt` is brought TO the hedge, not the reverse.
- The cancellation term renders only via `PRODUCT.cancelLine` /
  `PRODUCT.cancelChip` (marketing-auth-legal contract) — the /signup
  description must interpolate the constant, never the literal.
- Meta-description budget is 145–159 code points on every indexable marketing
  route, enforced henceforth by the route-metadata e2e (code points, not
  bytes — the GEO report's measurement trap).
- `/about` keeps exactly two occurrences of the lede "Nabaperks is built and
  run by" (VMK-P2-02); the description trim must not touch the lede.

## Decisions already made

- Owner approval 2026-07-05 covers Phase A items 1–8 AND Phase B (spoke
  comparison trim) of the audit's recommended plan.
- ComparisonTable remains on `/how-it-works` (comparison authority) and
  `/loyalty-for-pubs` (flagship hub). Wedge target anchor: `/how-it-works#no-app`.
- The wedge band replaces BOTH the spoke ComparisonTable and the old
  byte-identical "mechanism cross-link" Section — one band, per-venue copy.
- One sentence of the wedge (the hedged wallet-pass claim) intentionally
  repeats the `/how-it-works` comparison intro — teaser continuity, same
  pattern as the persona hooks. The venue-true clause differs per spoke.
- Plan-includes order puts "Optional location checks at your venue" last so
  the teaser is a plain `slice(0, 4)` of the single source.
- New signup metadata: title "Start Your Free Pilot — No-App QR Loyalty";
  description "Create your account, build your card and go live from one
  venue QR — ${PRODUCT.pilot}, then ${PRODUCT.price}. ${PRODUCT.cancelLine}"
  (155 code points).
- `/pricing` description gains "— unlimited stamps and members included."
  (149 code points); `/about` swaps "made by people" → "from people"
  (158 code points, lede intact).

## EARS requirements

- **AV-1 (route-distinct hub HowTo):** THE `/loyalty-for-pubs` page graph
  SHALL pass `{ id: <absolute pub-hub URL>#howto }` to `howToSchema`, and
  `pnpm jsonld:check` SHALL assert the hub HowTo `@id`; no route other than
  `/` emits `#how-it-works` as its HowTo id.
- **AV-2 (signup metadata):** THE `/signup` route SHALL export metadata with
  a unique title, a 145–159-code-point description that interpolates
  `PRODUCT.cancelLine`, `alternates.canonical` = `ROUTES.signup`, and
  OG/twitter consistent with the other marketing routes.
- **AV-3 (spoke wedge):** THE cafe/takeaway/bar spokes SHALL NOT mount
  `ComparisonTable`; each SHALL mount ONE wedge Section whose copy contains
  the hedged wallet-pass claim, a venue-true clause unique to that spoke, and
  a link to `/how-it-works#no-app`; `/how-it-works` and `/loyalty-for-pubs`
  SHALL keep `ComparisonTable`.
- **AV-4 (plan-includes single source):** THE plan-includes list SHALL be
  exported once from `lib/marketing/facts.ts`; `/pricing` SHALL render all
  five items and TrustPricing SHALL render the first four; the digest item
  SHALL read "Weekly digest of visits, regulars and redemptions" and SHALL
  NOT be re-declared in either consumer.
- **AV-5 (description budgets):** THE `/about`, `/pricing` and `/signup` meta
  descriptions SHALL be 145–159 code points; THE route-metadata e2e SHALL
  assert the budget across all 12 indexable marketing routes.
- **AV-6 (llms parity):** `public/llms.txt` SHALL carry the hedged
  "Most rivals…" wallet-pass claim and no absolute "Rivals that say…" form.
- **AV-7 (operator disclosure):** THE VenueProof body SHALL state that the
  quoted pubs are run by the operator (via `OPERATOR.name`) on every surface
  where the quotes render.
- **AV-8 (about attribution):** THE `/about` page graph SHALL attribute
  `reviewedBy`/`author` to the operator Organization.
- **AV-9 (guides guard):** `pnpm jsonld:check` SHALL validate all three
  guides: Article node, Organization author, and ISO
  `datePublished`/`dateModified` present.
- **AV-10 (bullet variants):** THE cafe and takeaway hero benefit lists SHALL
  each carry a venue-true counter-verified bullet; the literal "can't be
  faked or double-claimed" wording SHALL remain only on the pub hub.
- **AV-11 (pricing repetition):** THE `/pricing` FAQ answers SHALL state the
  location-check reassurance at most once.
- **AV-12 (quote normalisation):** `counter-verified-stamp.tsx` SHALL carry
  no literal typographic quote characters (entities only); rendered output
  unchanged.

## Verification method & task breakdown

Tasks: (1) amend PS-1 in the persona-spokes contract + write the new
`marketing-audit-v2-fixes` contract test + the e2e budget assertion (red) →
(2) facts/plan-includes + copy fixes → (3) signup metadata + hub HowTo id +
jsonld guard extensions → (4) spoke wedge redesign ×3 → (5) static gates →
(6) rendered re-verification (cross-route `@id` scan, description lengths,
scroll heights) + browser gates + regenerated spoke baselines.

Observable behaviors: rendered cross-route scan shows one payload per HowTo
`@id` (AV-1); `/signup` head shows the new title/description/canonical/OG
(AV-2, e2e); spoke sources contain no `<ComparisonTable` while hub/mechanism
pages do (AV-3, contract test); one `PLAN_INCLUDES` export with both
consumers importing it (AV-4); e2e asserts 145–159 across the 12 routes
(AV-5); llms.txt hedge (AV-6); VenueProof discloses the operator (AV-7);
`reviewedByOperator: true` on about (AV-8); jsonld guard loops 3 guides and
the hub id (AV-9/AV-1); spoke bullet greps (AV-10); single location-check
sentence on pricing (AV-11); no literal curly quotes in the stamp component
(AV-12).

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` ·
`pnpm test:coverage` · `pnpm bundle:check` · `pnpm claims:check` ·
`pnpm jsonld:check` · `pnpm tokens:check` · `pnpm test:e2e` ·
`pnpm test:a11y` · `pnpm test:visual`.

Known local caveat (unchanged surfaces): this machine's `.env.local` lacks the
customer-auth secrets since the 2026-07-04 environment split, so `/start`- and
`/login`-class session routes 500 locally and the full e2e/a11y suites carry
the documented ~35/8 pre-existing failures. Marketing-route projects and the
route-metadata spec are unaffected; CI carries secrets.

## Implementation evidence (2026-07-05)

- TDD: 12 AV tests + the amended PS-1 written first and observed red on their
  behavioral assertions (13 failing / 275 passing), then green with production
  code only. Final: `pnpm test` 301/301 micro-spec + 232/232 unit;
  `test:coverage` green.
- Static gates: `typecheck` · `lint` (0 errors; 4 pre-existing warnings) ·
  `claims:check` (67 files) · `tokens:check` · `build` · `bundle:check`
  (root first-load 884,580 B) · `jsonld:check` green WITH the new hub-`@id`
  and three-guide date assertions active.
- Rendered proof (dev server, all 12 routes): every HowTo `@id` now unique
  with exactly one payload (the `/#how-it-works` dual-payload collision is
  gone); descriptions 145–159 on all 12 (pricing 149, about 158, signup 155);
  `/signup?email=…` canonicalises to `/signup` with the new title + OG block.
- Browser gates (against the live dev server): route-metadata e2e 4/4 on
  mobile-safari (including the new budget + signup-head tests); axe WCAG 2
  A/AA 16/16 across the eight changed routes on chromium + mobile-safari;
  visual baselines regenerated for the six visually-changed routes × 4
  projects (24 captures) on darwin — linux twins from CI after push per the
  established runbook (`/loyalty-for-pubs` and harness baselines untouched).
- Redundancy outcome: spokes 9.0/9.0/9.2 → 8.0/8.0/8.2 mobile screens;
  cafe∩takeaway shared sentences 39 → 29 (~844 → ~506 words); pub-hub∩spoke
  28 → 17 (~668 → ~318 words).
- Known local caveat: `governance:check` reports one violation — an
  untracked root file `ReadThisASAP` created mid-session by a concurrent
  workstream, outside every active radius and outside this spec's scope.

## Lifecycle note

Status stays `active` while the diff is uncommitted; flip to `implemented` in
or immediately after the commit, and record the PS-1 supersession cross-note
in `micro-specs/platform/marketing-persona-spokes.md` (done in this change,
precedent: HW-1).
