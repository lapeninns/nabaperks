# Handoff for the next agent

HEAD `a2a105be`, 346 commits ahead of `origin/main`, worktree clean, everything
pushed. PR #215 is open and `MERGEABLE`.

## Where to work

    repo    /Users/amankumarshrestha/LapenInns Project/Nabaperks
    branch  feat/ui-redesign-audit-fixes   (checked out there, HEAD d6456cc6)

**This instruction inverted on 2026-08-09 and earlier copies of this file say
the opposite.** The branch used to live in an isolated worktree at
`…/Nabaperks-ui-redesign`, and every prompt from that era said _never commit to
`…/Nabaperks`_ because it held `main`. That worktree has been removed and the
branch is now checked out in the main repo, so `…/Nabaperks` is exactly where
you SHOULD commit. If you were handed an older prompt carrying the old rule, it
is wrong and will stop you dead.

`main` is still at `f9be041a`; `git checkout main` returns there. A safety tag
`backup/ui-redesign-audit-d6456cc6` marks this HEAD.

Commits use
`git -c user.name="Claude Code" -c user.email="noreply@anthropic.com"`.

If you fan out to sub-agents, lane worktrees still work, but `-b` is NOT
optional — git refuses to check the same branch out twice, and the main repo now
holds it:

    git worktree add -b lane/<name> ../nb-lane-<name> feat/ui-redesign-audit-fixes

Two of four lane agents froze permanently last round and produced nothing, and a
third stalled mid-commit and had to have its work committed for it. Have lanes
commit in small verified batches rather than at the end, and poll them.

## State

**301 done / 23 partial / 14 stale / 9 open of 347.** 26 of 33 Criticals.
`pnpm ui-audit:check` enforces those numbers, that every source path cited in the
evidence docs exists, and that HANDOFF's open list matches the parsed state.

Open: `01#23 01#55 01#63 01#65 01#67 02#50 02#64 04#54 05#13`.

**Every one of those nine now needs the owner, not an engineer.** Five are
copy or conversion calls (`01#23 01#55 02#50 02#64 04#54`), two are excluded
by standing instruction (`01#67 05#13`), and two are contract-versus-design-
system rulings written up for approval (`01#63 01#65`). None is open for want
of effort or evidence — each carries a measurement or a cited clause.

The one Critical that remains open is `03#37`'s single-route
collapse (pinned by `qr-a4-poster-templates` and `merchant-shell`; a contract
change to ask for, not to take). `03#18` closed in `lane/merchant`: both of its
recorded blockers were disproved — see NEEDS-SIGNOFF 23.
04#60 left the list: sorting shipped, only its sticky-header half is blocked.

Read in this order: `HANDOFF.md`, `NEEDS-SIGNOFF.md` (48 sections, 26 live),
`COVERAGE.md` (method log, including every mistake and what it cost),
`STATUS-*.md` (per-finding notes).

## Sub-agent fan-out

Same branch, separate worktrees, merged back one at a time:

    git worktree add -b lane/marketing    ../nb-lane-marketing    feat/ui-redesign-audit-fixes
    git worktree add -b lane/customer     ../nb-lane-customer     feat/ui-redesign-audit-fixes
    git worktree add -b lane/merchant     ../nb-lane-merchant     feat/ui-redesign-audit-fixes
    git worktree add -b lane/admin        ../nb-lane-admin        feat/ui-redesign-audit-fixes
    git worktree add -b lane/designsystem ../nb-lane-designsystem feat/ui-redesign-audit-fixes

The `-b` is not optional. Git refuses to check the same branch out twice, so
`git worktree add <path> feat/ui-redesign-audit-fixes` fails with "already used
by worktree at ..." — each lane needs its OWN branch off the shared one, and the
fan-in is `git merge lane/<name>` back into `feat/ui-redesign-audit-fixes`.

Each lane owns one report (01–05) and must:

- export `PLAYWRIGHT_BASE_URL=http://127.0.0.1:<unique port>`. The config
  defaults to 3146 and concurrent lanes silently attach to each other's dev
  server — this produced a false "regression" last time;
- never `pkill` by pattern; a lane killed its siblings' servers;
- report each closure with the evidence, not the claim.

Fan-in: merge lanes one at a time, re-run `pnpm ui-audit:check`, and **recompute
the tally tables from the STATUS files** rather than picking a side on a
conflict. Lanes append to the same docs, so conflicts are usually "take both".

## Gates

    pnpm lint          pnpm typecheck        pnpm quality:check
    pnpm build         pnpm bundle:check     pnpm tokens:check
    pnpm claims:check  pnpm jsonld:check     pnpm env:check

Always `pnpm <gate> >/tmp/g.log 2>&1; echo EXIT=$?`. `rc` from a piped command is
`tail`'s exit code, and grepping a gate's output for the failures you expect
cannot see the ones you do not — both shipped bugs here.

Browser suites, each sabotage-verified:

    playwright --project=chromium --grep '@a11y'        67 pass
    playwright --project=motion                          3 pass
    playwright console-hygiene touch-targets             2 pass
    playwright admin-command-palette                     1 pass
    node scripts/check-small-screen.mjs   (needs pnpm build && pnpm start)

## Harnesses — the way past the verification wall

`/dev` routes 404 in production and the app is auth-gated, so customer, merchant
and admin surfaces can only be measured through a harness. Three were added
precisely to unblock findings, each mounting the REAL component:

    /dev/home-harness/present-code          02#33 counter overlay
    /dev/app-harness/trial/admin-command    04#6  Cmd-K palette
    /dev/home-harness/offer-claim           02#64 claim landing

If a finding is stuck on "cannot be verified", build the harness. Register it in
`tests/contracts/dev-route-production-guard.test.mjs` — that contract will refuse
the page until you do. Do NOT copy production markup into a harness; five
existing ones do, and that drift cost two wrong conclusions. Split a view
component instead, as `components/merchant/account/profile-panel-view.tsx` does.

## Traps that cost real time

- **Anchor on what the code guarantees, not what the page says.** Three wrong
  numbers came from text heuristics matching an ancestor: "innermost element
  containing 'Growth Plan'" gave 332px for a 1,653px sheet. `#pricing` and
  `data-takeover-enquiry` gave the right ones.
- **`page.goto` returns null on same-document navigation**, so
  `expect(response?.status())` throws under a saturated worker pool.
- **Playwright reports `pointer: fine` at any viewport width** — tap probes need
  a device profile.
- **Scroll-reveal sections rest at `scale(0.98)`**; geometry needs reduced
  motion, which the ROOT config sets via `contextOptions`. A file-level
  `test.use({ reducedMotion })` is a silent no-op and the config says so.
- **Assert `document.styleSheets.length > 0` before measuring layout.** An
  unstyled page cannot overflow, and a broken control will agree with you.
- **Sticky is bounded by its containing block**, not the scrollport.
- **A test name is not a file.** Eight names exist as both a contract and an e2e
  spec, e.g. `tests/contracts/merchant-onboarding-continuity.test.mjs` and
  `tests/e2e/merchant-onboarding-continuity-flow.ts`.
- **Contracts read source text, not build output.** A contract can pass on a file
  that no longer compiles; that is not evidence.
- **Any check that filters its input must assert the filter did not eat
  everything.** `bundle:check` enforced its budget on 0 of 150 routes.

## Testing a blocker before believing it

Roughly ten recorded blockers were disproved by re-testing. The tells:

1. names a file or an owner rather than a behaviour;
2. true of one half, applied to the whole;
3. asserts a tree fact that a merge has since changed;
4. says something must be BUILT — check it does not already exist.

And the one that keeps catching contract citations: **does the assertion's SCOPE
actually cover the change the audit asks for?** 02#50 and 02#64 both cited real
assertions that constrain nothing relevant — the first stops at a component name,
the second is an anti-duplication guard indifferent to layout. Both were recorded
as contract-blocked for weeks; neither was.

Not a valid reason to decline: "I cannot fully verify it". Valid: "the device
this ships to already does the right thing" (03#64's picker — both scanners
already request `facingMode: environment`).

## Remaining engineering, value order

1. ~~**Fraud queue lookup + paging** (04#6, §30)~~ — DONE. `severity_rank` is a
   stored generated column (20260809100000); the queue orders in SQL and pages
   like the other ten. Eleven of eleven admin lists now have lookup + paging.
2. **Generic TOC** (01#60, §18) — blocked only because the pinned literal lives
   inside `guide-spine.tsx` and `marketing-offer-source` reads that file by name.
   Moving it is a contract change; ask first.
3. **Re-test the remaining partials** with the tells above.

## Blocked on the user — do not guess

§24 claims gap on three indexed `/guides/*` pages (copy/legal)
§31 three venue spokes: retain / consolidate / hold (marketing SEO)
§32 the verification boundary
121 stale visual baselines need human diff approval
Copy/conversion: 01#23 01#55 02#50 02#64 04#54 — 02#64 and 01#20 are now
costed, so those two can be decided against real numbers
Excluded by standing instruction: 01#67, 05#13
