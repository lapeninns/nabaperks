# UI audit fixes — items needing human sign-off

Everything else in Waves 1–3 that is Tier-1 (zero content loss) has shipped on
`feat/ui-redesign-audit-fixes`. These items were deliberately **not** actioned
autonomously. Each is blocked on a decision, not on effort.

## 1. Real 500 / 800 font weights (finding 05#10) — blocked on assets

`app/layout.tsx` declares Bricolage Grotesque at 400 and 700 only, while the
design system specifies 500 body and 800 headings. Every heading in the product
is therefore faux-bolded from the 700 file, which collapses the bold/extrabold
hierarchy.

Why it was not fixed here:

- `assets/fonts/` ships **static** TTFs. I verified they carry no `fvar` table,
  so 500/800 cannot be synthesised from the existing binaries.
- `assets/fonts/README.md` pins all four binaries by SHA-256 against specific
  upstream commits (`ateliertriay/bricolage@84745e5b`, `google/fonts@389b7704`).
  Adding weights means fetching new binaries, re-pinning hashes and updating
  that provenance record.
- The same README states these binaries are shared with the **emailed poster
  PDF pipeline**, so a weight change is not browser-only.

Decision needed: approve vendoring `BricolageGrotesque-Medium.ttf` and
`-ExtraBold.ttf` (SIL OFL, so licensing is fine), then re-pin the README and
re-check the poster PDF output.

## 2. A named type scale (finding 05#9) — blocked on design

Measured across 435 `.tsx` files: `<h1>` ships at 7 size combinations, `<h2>`
at 10, `<h3>` at 4.

One outright defect was fixed (an `<h2>` at `text-sm`, the same size as the
`<p>` beneath it — see `components/customer/referral-share-panel.tsx`). The
remaining drift was left alone on purpose:

- Collapsing 21 combinations into a scale changes visual hierarchy on every
  page in the product. That is a design decision about what the scale _is_,
  not a codemod.
- Minting utilities and not migrating call sites would add to the ~74 custom
  properties that already have zero `var()` consumers — the exact sprawl the
  same audit criticises.

Decision needed: agree the scale (suggested: 2 display sizes, 3 heading ranks,
2 body sizes), then migrate call sites behind it in one pass.

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
