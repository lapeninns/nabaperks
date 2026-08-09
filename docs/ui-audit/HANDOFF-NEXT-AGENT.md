# Handoff for the next agent

Written at HEAD `259e289a`, 337 commits ahead of `origin/main`, worktree clean,
everything pushed. PR #215 is open and `MERGEABLE`.

## Where to work

    worktree  /Users/amankumarshrestha/LapenInns Project/Nabaperks-ui-redesign
    branch    feat/ui-redesign-audit-fixes

**Never commit to `/Users/amankumarshrestha/LapenInns Project/Nabaperks`** — that
is the user's own worktree. Commits here use
`git -c user.name="Claude Code" -c user.email="noreply@anthropic.com"`.

## State

**292 done / 24 partial / 19 stale / 12 open of 347.** 30 of 33 Criticals.
`pnpm ui-audit:check` enforces every number in this paragraph.

Open: `01#23 01#55 01#63 01#65 01#67 02#50 02#64 03#13 03#16 04#54 04#60 05#13`.

Read in this order:

1. `docs/ui-audit/HANDOFF.md` — the open findings, categorised, and the four
   things that block merge.
2. `docs/ui-audit/NEEDS-SIGNOFF.md` — 32 sections, 22 still live. This is the
   decision queue.
3. `docs/ui-audit/COVERAGE.md` — the method log, including every mistake and
   what it cost. Read this before trusting any measurement in the other two.
4. `docs/ui-audit/STATUS-*.md` — per-finding notes, one file per report.

## Why this is stalled, honestly

Not for want of work. Everything remaining routes through a decision the agent
cannot make:

- **§24** three indexed `/guides/*` pages name a commercial guarantee with no
  `CLAIMS_BOUNDARY`. Copy/legal call.
- **§31** three venue spokes are unlinked and `index: false` on purpose. Retain,
  consolidate, or hold — a marketing/SEO call.
- **§32** the verification boundary (below).
- **121 stale visual baselines** (net −56,880px) need a human to approve the
  diffs. Regenerating them from this branch would rubber-stamp whatever they
  contain.
- Five copy/product decisions: `01#23 01#55 02#50 02#64 04#54`.
- Two excluded by the user's standing instruction: `01#67`, `05#13`.

## The verification boundary — read this before measuring anything

`app/dev/layout.tsx` returns `notFound()` in production, so **every `/dev`
harness 404s in a production build**, and the real app routes are auth-gated.

    marketing / auth / legal / guides    production-verifiable
    customer / merchant / admin          dev server only
    anything needing real data           `pnpm test:db`, never run here

Dev and production agree on **static layout heights** (verified: `/how-it-works`
is 6,211px in both). They disagree on **hydration timing** and **CSS cascade**.
Two findings were mis-decided on that difference before it was understood.

## Traps that cost real time

- **`rc` from a piped shell command is `tail`'s exit code.** Always
  `pnpm <gate> >/tmp/g.log 2>&1; echo EXIT=$?`. A TypeScript error shipped for
  two commits because a narrow grep could not see it.
- **Grepping a gate's output for expected failures cannot see unexpected ones.**
- **`page.goto` returns null on same-document navigation**, so
  `expect(response?.status())` throws under a saturated worker pool. Six specs
  still have this shape; measured stable, left alone deliberately.
- **Playwright reports `pointer: fine` at any viewport width.** Tap-target
  probes need a device profile, or every `[@media(pointer:coarse)]` floor is
  invisible.
- **Scroll-reveal sections rest at `scale(0.98)`**, so geometry probes
  under-measure by 2% unless reduced motion is on. The config forces it via
  `contextOptions`; a file-level `test.use({ reducedMotion })` is a silent no-op
  and `playwright.config.ts` says so in a comment.
- **An unstyled page cannot overflow.** Assert
  `document.styleSheets.length > 0` before measuring layout, or a broken control
  will agree with you.
- **A test name is not a file.** Eight names exist as both a contract and an
  e2e spec — for example `tests/contracts/merchant-onboarding-continuity.test.mjs`
  and `tests/e2e/merchant-onboarding-continuity-flow.ts`. Dismissing a blocker
  against the wrong one shipped a dead submit button for thirty turns.
- **Five `/dev` harnesses duplicate production markup** rather than importing it,
  so a fix can need applying twice. `components/merchant/account/profile-panel-view.tsx`
  shows the pattern that fixes it.

## Gates

    pnpm lint          pnpm typecheck        pnpm quality:check
    pnpm build         pnpm bundle:check     pnpm tokens:check
    pnpm claims:check  pnpm jsonld:check     pnpm env:check

`quality:check` = lint + typecheck + 614 contract + 961 unit + deadcode +
deadexports + duplicates + debt + docs + agents + ui-audit.

Browser suites, each sabotage-verified:

    pnpm exec playwright test --project=chromium --grep '@a11y'    67 pass
    pnpm exec playwright test --project=motion                      3 pass
    pnpm exec playwright test console-hygiene touch-targets         2 pass
    node scripts/check-small-screen.mjs      (needs pnpm build && pnpm start)

Always pass `PLAYWRIGHT_BASE_URL=http://127.0.0.1:<unused port>`; the config
defaults to 3146 and concurrent runs silently attach to each other's server.

## Guards this branch added, and why

Each exists because something got through, and each has been made to fail on the
thing it was written for:

    scripts/check-ui-audit-tally.mjs     tally, cited file paths, HANDOFF's open list
    scripts/check-dead-exports.mjs       233 baselined; new ones fail
    scripts/check-small-screen.mjs       320px containment, production only
    tests/e2e/console-hygiene.desktop.spec.ts
    tests/e2e/touch-targets.desktop.spec.ts

`scripts/check-bundle-size.mjs` was enforcing its route budget on **zero** routes
and reporting PASS; it now checks 113 and fails loudly if the manifest format
moves again. Expect more of this: **any check that filters its input must assert
the filter did not eat everything.**

## If you want to keep shipping code

The honest list of remaining engineering, in value order:

1. **Cmd-K palette for admin** (`04#6`, the last implementable clause). No
   command primitive exists; it needs `cmdk` or a hand-rolled radix combobox,
   and it can only be verified in a dev harness. Deferred deliberately, not
   forgotten.
2. **Fraud queue paging** (`04#6`, §30) — needs a `severity_rank` column or SQL
   CASE ordering. Data-layer, not UI.
3. **Generic TOC** (`01#60`, §18) — blocked only by the pinned literal living
   inside `guide-spine.tsx`, which `marketing-offer-source` reads by name. A
   contract move for deduplication; ask first.

## Ground rules that were followed

- `tests/contracts/*` outrank audit opinion. No assertion was weakened or
  deleted. Adding a non-emptiness assertion is allowed — it only makes a test
  harder to pass.
- Small verified batches; `pnpm build` before each commit.
- Findings needing a browser, an asset, or a product/copy call were flagged, not
  guessed.
