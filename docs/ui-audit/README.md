# UI Redesign Audit

A read-only UX/UI redesign audit of the whole Nabaperks interface: 347 findings across
434 `.tsx` files, judged against `DESIGN.md` and `app/globals.css` (the Wet Ink system).

Generated 2026-02 by component-by-component review of JSX and `className` strings, with
estimated rendered heights and grep-quantified consistency metrics. No source was modified.

## Contents

| File | Area | Findings |
|---|---|---|
| [`00-master-redesign-audit.md`](./00-master-redesign-audit.md) | Consolidated report (all areas, with summary tables) | 347 |
| [`01-marketing.md`](./01-marketing.md) | Marketing and legal surface, 16 public routes | 69 |
| [`02-customer.md`](./02-customer.md) | Customer / member journey | 70 |
| [`03-merchant.md`](./03-merchant.md) | Merchant console | 67 |
| [`04-admin.md`](./04-admin.md) | Admin back-office, shared data display, dev surfaces | 74 |
| [`05-design-system.md`](./05-design-system.md) | Design system, primitives, shells, accessibility | 67 |

Severity split: 33 Critical, 131 High, 146 Medium, 37 Low.

Each finding follows one structure: component/section, current problem (citing real
classes), why it is a problem, recommended redesign, and priority.

## Measured page heights (375px phone)

| Surface | Height | Note |
|---|---|---|
| `/admin/fraud` | ~26,000px | every row carries two full write forms |
| `/admin/merchants` | ~20,000px | 100 QR records, unpaginated card wall |
| `/admin/privacy` | ~13,500px | 4 stacked panels, 3 paginators on one URL |
| `/loyalty-for-pubs` | ~9,000px | tallest public page |
| `/home/activity` | ~5,800px | 40 unbounded rows, no grouping or paging |
| `/` landing | ~5,400px | ~8 viewports |
| `/app` dashboard | ~1,800px | ~4.6 viewports |
| Marketing footer | ~650px | repeated on every public route |

## Quantified inconsistency (full-codebase grep)

- 22 distinct radius+shadow combinations for one card concept; 153 hand-rolled surfaces
  against 57 uses of the existing `.surface-card` recipe
- 10 distinct `rounded-*` values against a three-shape contract; 26 distinct `py-*` section values
- `<h1>` renders at 6 sizes, `<h2>` at 11 (including an `<h2>` at `text-sm`)
- ~591 arbitrary Tailwind values; 11 `tracking-[…]` values against a two-value contract
- `Badge` ships 7 variants with 1 reachable; `Button` ships 9 sizes with 6 used
- ~74 of 141 CSS custom properties have no `var()` consumer
- 113 `StatusBanner` against 13 `Alert` — two competing inline-notice systems
- 4 `dark:` variants product-wide while `enableSystem` is on

## Recommended sequencing

1. **Safety and access** — cap and scroll the bottom sheet; skip links in all four shells;
   restore `focus-ring` on the seven opted-out controls; fix inverted destructive styling and
   add confirmations; mask referral emails; load the real 500/800 font weights.
2. **Height collapse** — `md:` breakpoint sweep across 11 marketing layouts; reorder the stamp
   screen so the press control is above the fold; strip `/home` chrome; tabs for the stacked
   admin panels and the four QR print lanes; collapse per-row admin write forms into
   disclosures; paginate the five `.limit(100)` routes.
3. **Consistency codemod** — collapse to `.surface-card` plus two variants; delete the four
   extra radius rungs; mint the type scale as named utilities; one border weight; adopt
   `SelectField`, `SubmitButton` and `StatusBanner` everywhere; add a `tokens:check` rule so
   the drift cannot recur.
4. **Structural** — merchant bottom tab bar and sidebar regrouping; server-side search and
   paging on the members table; ship the already-written `MerchantNextActions` task layer;
   unify `/terms` and `/privacy` onto `LegalDocumentPage`; admin command palette.

## Status

These are findings and recommendations only. Nothing here has been implemented, and no
finding should be treated as accepted product direction until it is triaged.
