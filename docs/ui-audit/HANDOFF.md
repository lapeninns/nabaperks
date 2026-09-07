# UI audit — handoff

> **Picking this up fresh?** Read
> `docs/ui-audit/HANDOFF-NEXT-AGENT.md` first — worktree, gates, the verification
> boundary, and the traps that cost this campaign real time.

Branch `feat/ui-redesign-audit-fixes`, 138 commits.
Read `COVERAGE.md` for the evidence behind every number here.

## Where it landed

|                                      |        count |
| ------------------------------------ | -----------: |
| Findings tracked (each exactly once) |          347 |
| Done                                 |          301 |
| Partial                              |           23 |
| Stale — not reproducible in the tree |           14 |
| Open                                 |            9 |
| **Criticals resolved**               | **26 of 33** |

"Criticals resolved" means `[x]` or `[stale]` — shipped, or the premise
disproved. The 7 that are neither are named, so the number cannot drift into
a claim: 01#22, 02#10, 02#20, 02#50, 02#64, 03#16, 03#37.

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

## The 10 open findings, categorised

None of these is open for want of effort. Every one was attempted, measured, or
scoped out by instruction. The categories are what matter:

### Excluded by your standing instruction (2)

`01#67` legal/terms/privacy structural migration · `05#13` Button size-variant
API deletion. Both were named out of scope at the start and are unchanged.

### Attempted, then reverted because a contract said no (2)

`01#63` · `01#65`. Each has a written attempt and a revert; no assertion was
weakened.

**01#49 has left this group.** It was here on the strength of a "measured CLS of
0.1924"; that number came from a dev server. The identical probe on a production
build gives **0.0000**, and Lighthouse on the built artefact gives 0.0000 across
three runs against a 0.100 threshold. The defect does not exist in what ships, so
there is nothing to renegotiate and the finding is now `[stale]` with its premise
disproved rather than its fix shipped. See NEEDS-SIGNOFF 7.

### Declined with reasoning, evidence recorded (1)

`03#16` — the migration does not fix the defect it cites (DataTable's own
`mobileCard` path renders both trees).

**`03#13` has also left this group.** "A merchant-wide count needs an aggregate
that does not exist" was wrong about the schema, not about the risk: `ready` is
first in the first-match-wins chain, so a SQL predicate and the badge agree by
construction, and the count is now one deduplicated id read plus one
`head: true` COUNT. It is `[x]`.

**04#60 has left this group.** "Sorting across 8 live panels, where half-built
is worse than none" was the sticky header's blocker applied to the whole
finding. Sorting is opt-in per column (`sortKey`), so the panels that do not
use it are byte-identical and nothing was migrated; it is URL-driven so the
ORDER BY lands in PostgreSQL, and it is browser-proved on the real component.
The finding is now `[~]` with only the sticky header (NEEDS-SIGNOFF 12) and the
optional column-visibility toggle outstanding.

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
4. ~~**One contract renegotiation** — 01#49.~~ **WITHDRAWN.** This asked you to
   renegotiate `marketing-offer-source` on the strength of a measured CLS of
   0.1924. That number came from a dev server. The identical probe on a
   production build gives **0.0000**, and Lighthouse on the built artefact gives
   0.0000 across three runs against a 0.100 threshold. The collapsing list also
   sits at top 1295px on a 390x844 viewport — below the fold — so it moves no
   visible content. Nothing to renegotiate; no assertion needs touching. (§7)

## Open findings, all 9

01#23, 01#55, 01#63, 01#65, 01#67, 02#50, 02#64, 04#54, 05#13

- **Blocked by a test** (attempted, reverted, no assertion weakened): 01#63,
  01#65, plus 03#46 in STATUS-m-launch. 01#49 was here until its premise was
  disproved — the CLS it cited is a dev-server artefact and production measures
  0.0000, so it is `[stale]` and needs no contract change.
- **Copy / product**: 01#23, 01#55, 02#50, 02#64, 04#54.
- **Data-layer**: 03#13 (a merchant-wide "rewards ready" count means duplicating
  badge logic in SQL or loading every member; counting the loaded page would
  print a false readback). 03#16 left this list — it is now partial, not open;
  see below.
- **Out of scope by instruction**: 01#67, 05#13.
- **Large API addition**: none left. 04#60 was here; the API turned out to be
  one optional field on a column, and only its sticky-header half is blocked by
  the `overflow-x-auto` scroll container.

### 03#16 is declined, not missed — and now evidenced rather than asserted

It argues the members table should adopt `DataTable` to stop rendering every row
twice. `DataTable`'s own `mobileCard` path renders the card list AND the table
and hides one with CSS, so the migration does not remove the double mount. The
`lane/merchant` re-verification added the fact that settles it: `DataTable`'s
one mitigation for the double mount — the `mobilePageSize` reveal — is skipped
for any caller that supplies `onRowClick`/`getRowProps`
(`components/data/data-table.tsx:345-347`), and this table supplies both so its
rows stay keyboard-operable. A migrated 50-row page would therefore mount 50
cards plus 50 rows: identical to today, not merely no better.

The audit's second defect (the two renderers had drifted) is now stale and
locked by `tests/contracts/merchant-members-renderer-parity.test.mjs`. What is
left is a DESIGN.md amendment, not merchant work: the doc prunes the `lg`
breakpoint the table measurably needs. Options in NEEDS-SIGNOFF 46. The real
fix remains a DOM-preserving responsive table (one tree, restyled by container
query), which would fix all 10 `mobileCard` consumers at once.

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
