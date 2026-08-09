# UI audit — handoff

Branch `feat/ui-redesign-audit-fixes`, 138 commits.
Read `COVERAGE.md` for the evidence behind every number here.

## Where it landed

|                                      | count |
| ------------------------------------ | ----: |
| Findings tracked (each exactly once) |   347 |
| <<<<<<< HEAD                         |
| Done                                 |   291 |
| Partial                              |    25 |
| =======                              |
| Done                                 |   291 |
| Partial                              |    25 |

> > > > > > > lane/merchant
> > > > > > > | Stale — not reproducible in the tree | 18 |
> > > > > > > | Open | 13 |
> > > > > > > | **Criticals closed** | **30 of 33** |

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm quality:fast` (607 contract + 960 unit)
· `pnpm build` · `check-design-tokens` — all green.

Browser matrix, journeys only: chromium 204 · desktop-firefox 187 ·
desktop-safari 187 · mobile-safari 235 — 0 failed. `pnpm test:a11y` 270 passed
across all four.

## Keeping this document honest

`pnpm ui-audit:check` (in `quality:check`) parses the STATUS files and fails if
any number in COVERAGE.md or HANDOFF.md disagrees with them. It exists because
those tables were wrong for most of the campaign and nothing noticed.

If you edit a status mark by hand, run it.

### The known flake set

Three spec files fail only under a saturated worker pool and pass alone, on
every full-matrix run: `analytics-funnel-privacy`, `cron-route-auth`,
`merchant-auth-recovery-flow`. Session-identity and cron-secret routes, none
touched by this branch. Re-run them in isolation before treating a red matrix as
a regression.

## Re-run before any future merge

A closed finding is a claim about a tree, and the tree moves. Merging main
resurrected 03#25 (six `border-[1.5px]` back across four files). The cheap guard
is to re-grep the swept patterns after any merge:

```bash
grep -rn 'border-\[1.5px\]\|rounded-xl\|max-w-7xl\|adminSelectClasses' \
  --include=*.tsx --include=*.ts components app
```

All four should return nothing. Matches inside explanatory comments are fine;
live classes are not.

### Read this one first

`NEEDS-SIGNOFF.md` §24: the three indexed `/guides/*` pages name a commercial
guarantee without rendering its limits. The contract that enforces "name a
guarantee, show its boundary" allowlists them as a known gap; the audit never
noticed it and asks for the boundary to appear LESS often elsewhere. Small fix,
claims question, not mine to make.

## BLOCKING before merge

**Lighthouse LCP (RESOLVED — see NEEDS-SIGNOFF 10) is red on three marketing routes** and green on main. Caused by
this branch's two added font faces: 4 preloaded ~113KB .ttf on the critical path,
measured at 4,854-5,265ms against a 4,000ms budget. woff2 recovers 1,622ms but
`poster-font-assets` pins .ttf for PDF parity, so it is reverted and recorded.
Three options in NEEDS-SIGNOFF §10.

## The 13 open findings, categorised

None of these is open for want of effort. Every one was attempted, measured, or
scoped out by instruction. The categories are what matter:

### Excluded by your standing instruction (2)

`01#67` legal/terms/privacy structural migration · `05#13` Button size-variant
API deletion. Both were named out of scope at the start and are unchanged.

### Attempted, then reverted because a contract said no (3)

`01#49` · `01#63` · `01#65`. Each has a written attempt and a revert; no
assertion was weakened. 01#49 is the one worth revisiting: the pinned expression
causes a **measured CLS of 0.1924** against a 0.1 threshold (section 7).

### Declined with reasoning, evidence recorded (3)

`03#16` — the migration does not fix the defect it cites (DataTable's own
`mobileCard` path renders both trees). `04#60` — sorting across 8 live panels,
where half-built is worse than none. `03#13` — a merchant-wide count needs an
aggregate that does not exist; page-scoped counting would print a false
readback.

### Genuine product or copy decisions (5)

`01#23` · `01#55` · `02#50` · `02#64` · `04#54`. Two are Critical. All five now
carry measurements rather than descriptions — the offer CTA at **y=904 on an
844px viewport**, the three persona spokes at **98.1% identical source** (section
8).

So the honest summary is: **5 need a decision from you, 3 need a contract
renegotiated, 3 are refusals you may overrule, and 2 were never in scope.**

## What still needs YOU, not more engineering

Four decisions unblock most of the remainder. Each now carries measured
evidence in `NEEDS-SIGNOFF.md` rather than a description.

1. **Conversion copy** — 02#50, 02#64, 01#23, 01#55. Two are Criticals.
   Measured: the offer landing's "Claim this offer" CTA sits at **y=904px on an
   844px viewport** — below the fold — after four restatements of the benefit.
   The three persona spokes are **98.1% identical source**, ~360 words each,
   rendering the same page three times with the noun swapped. (§8)
2. **Legal migration** — 01#67. Folding /terms and /privacy onto
   `LegalDocumentPage`. Their READABILITY is already fixed (01#64/66); this is
   the structural merge, and a clause silently dropped in migration is a
   compliance problem, not a UI bug. (§4)
3. **The 121 stale visual baselines.** Net **-56,880px** across 231 measured
   size deltas (135 shrank, 96 grew; largest single shrink -5,365px), so the
   compaction the audit asked for is real. Regenerating them from this branch
   would rubber-stamp whatever they now contain. That approval is not mine.
4. **One contract renegotiation** — 01#49. `marketing-offer-source` pins the
   exact expression that causes a measured **CLS of 0.1924** (Google's "good"
   threshold is 0.1) on the SEO hub: the section list is 302px at first paint
   and 0px after hydration. The assertion's intent is sound; the literal it
   pins is the bug. (§7)

## Open findings, all 13

01#23, 01#49, 01#55, 01#63, 01#65, 01#67, 02#50, 02#64, 03#13, 03#16, 04#54, 04#60, 05#13

- **Blocked by a test** (attempted, reverted, no assertion weakened): 01#49,
  01#63, 01#65, plus 03#46 in STATUS-m-launch.
- **Copy / product**: 01#23, 01#55, 02#50, 02#64, 04#54.
- **Data-layer**: 03#13 (a merchant-wide "rewards ready" count means duplicating
  badge logic in SQL or loading every member; counting the loaded page would
  print a false readback), 03#16 (see below).
- **Out of scope by instruction**: 01#67, 05#13.
- **Large API addition**: 04#60 sorting across 8 live panels; its sticky-header
  half is blocked by the `overflow-x-auto` scroll container.

### 03#16 is declined, not missed

It argues the members table should adopt `DataTable` to stop rendering every row
twice. `DataTable`'s own `mobileCard` path renders the card list AND the table
and hides one with CSS — the migration would not remove the double mount. It
also needs an `lg` cardBreakpoint and per-renderer row props, API nothing else
consumes. The real fix is a DOM-preserving responsive table (one tree, restyled
by container query), which would fix all 10 `mobileCard` consumers at once.

## Before you merge

- Rebase: this branched from `585356e7`; your branch has moved on.
- Run `pnpm test:db` (needs live credentials) — never run here.
- Review the visual diffs and approve or reject the baselines.

## What the browser tiers caught

Eleven regressions, every one introduced by an audit finding that was correct in
principle and wrong for its specific surface. The worst: every password field on
/signup and /reset-password rendered with **no accessible name** for several
commits, because a reveal-toggle wrapper swallowed `FormField`'s control
cloning. 960 unit tests and 607 contract tests passed throughout.

That is the durable lesson from this campaign: a static audit can be
self-consistent and still wrong about the rendered result.

## Test changes made, in full

One whitespace relaxation (`merchant-sidebar-state`, after Prettier re-wrapped a
ternary), one additive extension (`merchant-shell`), one new file
(`motion-tokens-bounded`), and one stale locator (`offer-campaign-flow`, where
the old locator contradicted the test's own href assertion). **No assertion was
weakened or deleted.**

## Verification boundary (NEEDS-SIGNOFF 32)

Customer, merchant and admin numbers in this campaign are dev-server
measurements. `/dev` harnesses 404 in a production build by design, and the real
routes are auth-gated, so no one can re-check them against a built artefact
without credentials or a seeded staging deploy. Marketing, auth, legal and guide
numbers are production-verified.
