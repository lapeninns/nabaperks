---
spec_id: MS-platform-ux-production-polish
status: active
risk_class: ui-only
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-02
allowed_blast_radius:
  - app/**
  - components/**
  - lib/legal/**
  - lib/marketing/**
  - lib/seo/**
  - lib/customer/**
  - lib/navigation/**
  - lib/motion/**
  - lib/merchant/**
  - public/sw.js
  - scripts/check-design-tokens.mjs
  - scripts/check-banned-claims.mjs
  - DESIGN.md
  - micro-specs/platform/**
  - tests/e2e/**
  - tests/micro-specs/**
  - tests/unit/**
  - docs/product/**
implementation_surfaces:
  - app/globals.css
  - components/ui/**
  - components/brand/**
  - components/forms/**
  - components/data/**
  - components/loyalty/**
  - components/motion/**
  - components/layout/**
  - components/marketing/**
  - components/merchant/**
  - components/customer/**
  - components/admin/**
  - components/auth/**
  - components/pwa/**
  - app/dev/design-system/**
  - lib/legal/content.ts
  - public/sw.js
  - scripts/check-design-tokens.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - DESIGN.md
  - micro-specs/platform/pwa.md
related_tests:
  - tests/e2e/a11y.spec.ts
  - tests/e2e/visual.spec.ts
  - tests/e2e/governance-smoke.spec.ts
  - tests/e2e/ux-polish-boundaries.spec.ts
  - tests/micro-specs/ux-production-polish.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm tokens:check
  - pnpm claims:check
  - pnpm test:e2e -- --grep "@polish|PWA offline fallback"
  - pnpm test:a11y
  - pnpm test:visual
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - True-viewport (375/768/1280) screenshot evidence for touched user-visible
    surfaces under .omo/evidence/ux-ui-production-polish-fixes/screenshots/
    (a11y and visual gate output included).
approved_exceptions: []
---

# MS-platform-ux-production-polish — UX/UI production polish fix phase

## 1. Exact goal and user-visible outcomes

Close the production-polish punch list from the 2026-07-02 UX/UI audit
(`.omo/evidence/ux-ui-production-polish-audit/final-report.md`) so the product
moves from NEARLY READY toward READY. The coverage ledger
(`.omo/evidence/ux-ui-production-polish-fixes/coverage-ledger.md` + `.tsv`,
354 rows) is the requirement corpus for this spec; every row must end
`FIXED`, `DEFERRED`, or `BLOCKED`.

A merchant, customer, prospect, or internal admin sees: no internal or
draft-legal voice in production copy; themed feedback (toasts, form errors,
pending states) everywhere the product talks back; branded error boundaries at
entry and marketing surfaces; loyalty visuals that survive narrow widths
(stamp counts always readable, tables never clip their primary action);
≥44px tap targets at decision moments; and one consistent Wet Ink dialect for
inputs, focus, press, micro-type, and status pills.

## 2. Blast radius: in scope and out of scope

In scope: the files in `allowed_blast_radius` — route UI under `app/`,
shared foundations under `components/`, presentation-side lib modules
(legal content, marketing, seo, customer, navigation, motion, merchant UI
helpers), the service worker's cache guard (`public/sw.js`), the design-token
guard script, the banned-claims guard script, `DESIGN.md` reconciliation, the
`/dev/design-system` catalog, and tests.

Out of scope (must not change): auth/session logic, Supabase clients, RLS,
Stripe/billing, webhooks, QR/loyalty/ledger server behaviour, server actions'
data semantics, `lib/admin/**` data-layer queries (owned by
`MS-admin-member-lookup`), migrations, and any dependency additions. UI fixes
may re-shape how server-action outcomes are *presented* (pending/success/error
states) but not what the actions do.

## 3. Strict constraints and assumptions

- Wet Ink is the contract: fix via tokens, the unlayered `[data-slot]` layer,
  wrappers, or variants. Never restyle shadcn primitives in
  `components/ui/*` directly for visuals; structural/behavioural attributes
  (aria wiring, data-slot exposure) are permitted where the audit requires it.
- Motion stays in `components/motion` / `lib/motion`; no raw framer or CSS
  keyframes elsewhere.
- en-GB copy; no emoji; no exclamation marks; no banned signup language on
  customer surfaces (`scripts/check-banned-claims.mjs` enforced).
- Browser storage stays cache-only; no loyalty/billing state moves clientside.
- Component public APIs stay stable unless a ledger row requires an additive
  prop; no breaking prop renames.
- Duplicate ledger rows collapse to one fix, cross-referenced `dup-of <ID>`.

## 4. Decisions already made

- The audit's known-deliberate decisions stay (real landing stats, `#cf330a`
  accent, merchant nav vocabulary, client-derived shell variant, poster
  `hideMobileChrome`, dormant grain, no Person schema, phone+OTP identity).
- The 11 `D-decide` ledger rows are product decisions: they are drafted as
  options + recommendation, marked `BLOCKED`, and not guessed. Resolved calls
  get written back into `DESIGN.md`.
- The consolidation backbone (final-report §11) lands before dependent lanes:
  state styling inside the unlayered layer, one focus/press/pending recipe, a
  shared `SubmitButton`, the micro-type token scale, one input story, loyalty
  primitive width behaviour, catalog gate sections, token-guard extensions.

## 5. Behavioural requirements (EARS)

The 354 ledger rows are the granular requirement corpus. Binding cross-cutting
outcomes:

- R1. THE public legal surfaces (`/terms`, `/privacy`, consent sheets, venue
  terms) SHALL render no "review required / not final wording" notice, and
  `pnpm claims:check` SHALL fail if such wording returns to rendered output.
- R2. WHEN a form control is invalid, THE control SHALL expose
  `aria-invalid` and `aria-describedby` pointing at visible error text, and
  the unlayered Wet Ink layer SHALL render a visible destructive border state.
- R3. WHEN a server-action form is pending, THE submit control SHALL show a
  disabled pending state via one shared `SubmitButton` recipe.
- R4. WHEN a toast renders, THE toast SHALL use Wet Ink theme surfaces (no
  stock `richColors` palette).
- R5. IF a render error is thrown under `/q`, `/m`, `/scan`, `/home/login`, or
  a marketing route, THEN THE user SHALL see a branded recoverable error
  boundary, not the framework default.
- R6. WHILE offline, THE `/offline` page SHALL offer a working retry
  affordance that reloads when connectivity returns.
- R7. THE service worker SHALL cache only `response.ok` responses in its
  cache-first path.
- R8. THE StampGrid/coin primitives SHALL keep the stamp count readable at
  375/768/1280 without overlap; THE members table SHALL NOT overflow
  horizontally at 768; THE redeemed `RewardTicket` stamp SHALL NOT obscure the
  reward title.
- R9. THE launch reward toggle, stepper, and edit controls, and the other
  audited decision-moment controls, SHALL present ≥44px coarse-pointer
  targets.
- R10. THE production UI SHALL contain no internal-voice copy flagged by the
  ledger (spike notes, Google Cloud instructions, snake_case event walls,
  template codenames).
- R11. THE micro-typography SHALL come from named tokens with a 10px floor,
  and `pnpm tokens:check` SHALL fail on `var(--…)` references with no
  definition and on arbitrary text sizes below the floor.
- R12. THE PWA manifest SHALL ship customer-appropriate shortcuts only.
- R13. WHEN gates for this spec run, THE full declared gate list SHALL pass.

## 6. Verification criteria and task breakdown

Phases follow `.omo/plans/ux-ui-production-polish-fixes.md`: B consolidation
backbone → C P0/P1 lanes → D P2 → E P3 → F decisions → final reconciliation.
Per-phase: full gate suite. Fix-phase evidence (screenshots at true 375/768/
1280 viewports, ledger reconciliation, re-audit) lands under
`.omo/evidence/ux-ui-production-polish-fixes/`. New Playwright coverage is
tagged `@polish`. The W4 geometry set is proven visually; the needs-live
checklist runs where credentials exist, else rows go `BLOCKED` with the
missing credential named.
