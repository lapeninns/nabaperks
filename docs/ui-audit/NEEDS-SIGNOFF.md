# UI audit fixes — items needing human sign-off

All Tier-1 (zero content loss) work in Waves 1–3, plus the no-copy Wave-2
height reductions, has shipped on `feat/ui-redesign-audit-fixes`. Items 1 and 2
below were initially deferred and have since been resolved; the rest remain
open because they need a human decision or a browser, not more effort.

## 1. ~~Real 500 / 800 font weights~~ — RESOLVED

Shipped in `feat(type): load the real 500 and 800 Bricolage faces`. Provenance
was established by re-downloading Regular and Bold from the pinned commit
(`ateliertriay/bricolage@84745e5b`, `fonts/ttf/`) and reproducing the two
SHA-256 values already recorded in `assets/fonts/README.md`, then taking
Medium and ExtraBold from that same tree. Both new faces carry the correct
OS/2 `usWeightClass` (500, 800). Poster PDFs are unaffected — `lib/qr/*` pins
the Regular/Bold filenames as exact string literal types, so the change is
additive and browser-only.

## 2. ~~A named type scale~~ — PARTLY RESOLVED

`.type-page-title` now implements DESIGN.md's page-title token and is adopted
by `PageTitle` plus the four `<h1>`s that had drifted off the responsive step.
Note one visual correction: page titles now use the documented 1.05 leading
rather than `leading-tight` (1.25).

Still open, and genuinely design decisions rather than codemods:

- **body / small.** DESIGN.md specifies 15px/13.5px at weight 500. Production
  sets body with `text-sm` (14px) at 435 call sites. Redefining it restyles
  every paragraph in the product.
- **The marketing display rank.** `landing/hero` and `landing/process-hero`
  use `text-4xl sm:text-6xl`; `pubs/pub-guide-hero` uses `text-3xl sm:text-5xl`.
  Unifying them means choosing one ramp.
- **`<h2>`.** Still 10 size combinations. DESIGN.md defines no section-title
  token, so there is nothing to implement against — the rank needs specifying
  before it can be enforced.

## 3. Three heroes and the legal TOC spines (finding 01#12) — blocked on visual check

The `md:` breakpoint sweep shipped for eight content grids. Left at `lg:`:
`landing/hero`, `landing/process-hero`, `pubs/pub-guide-hero`, and the
`/terms` + `/privacy` TOC spines. These pair prose with a rendered card, QR or
240px sidebar, where a ~360px column at 768px is a judgement call. They need
`pnpm test:visual` or a browser, which was not available here.

## 4. Everything in Tier 3 / Tier 4

Unchanged, as scoped: no legal/terms/privacy migration, no `confirmPassword`
removal, no marketing copy cuts, no `Button` size API deletions. See
`docs/ui-audit/README.md` for the full triage.

## 5. One audit recommendation that contradicts a contract test

Audit pattern P1 asks for the dead stock classes in `components/ui/*` to be
pruned so the files read as what they render.
`tests/contracts/ux-production-polish.test.mjs` locks the opposite policy —
"theme, not strip" — for `FieldLabel`, because those slots have live consumers
and the unlayered layer already supplies their treatment. The test is
authoritative; the audit finding should be closed as won't-fix or the contract
renegotiated deliberately.
