# Gate Review: Not Found Branded 404

recommendation: REJECT

## originalIntent

The user asked for an `omo:visual-qa`-driven sweep across all Nabaperks routes and expected any blocking visual issue to be fixed. The reported issue was that missing routes and invalid dynamic token routes were rendering the unbranded Next.js default 404.

## desiredOutcome

Missing routes and invalid dynamic tokens should render a real, branded Wet Ink Nabaperks 404 surface using the design system, across mobile, tablet, and desktop, with no overflow or status surprises. The approval packet should include trustworthy code/diff evidence, executor verification, code review coverage including remove-ai-slops/programming perspectives, manual QA evidence, and a notepad path.

## userOutcomeReview

Direct source and capture review supports the user-visible outcome locally:

- `app/not-found.tsx` uses a real React/Next component tree, not a pasted raster or background-image stand-in.
- The page composes existing primitives: `Logo`, `EmptyState`, and `Button`.
- Styling is token/primitives-driven apart from small layout utilities (`min-h-svh`, grid centering, responsive width).
- `EmptyState` renders Hugeicons through the brand `Icon` wrapper, satisfying the icon rule even though the glyph is imported in `app/not-found.tsx`.
- The actual route sweep JSON shows `/missing-route`, `/r/demo-token`, and `/merchant/demo-merchant/terms` return `404` with heading `Page not found` and no horizontal overflow on mobile, tablet, and desktop.
- The inspected screenshots show warm paper background, ink border/dashed empty-state surface, vermillion action button, and no overlapping text.

Formal approval is still blocked because required gate artifacts are missing or unsupported.

## checked artifact paths

- `AGENTS.md`
- `DESIGN.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`
- `app/not-found.tsx`
- `tests/e2e/not-found-visual.spec.ts`
- `components/brand/typography.tsx`
- `components/brand/logo.tsx`
- `components/ui/button.tsx`
- `components/ui/empty.tsx`
- `app/r/[token]/page.tsx`
- `playwright.config.ts`
- `/tmp/nabaperks-visual-qa/not-found-after/mobile__rootr__demo-token.png`
- `/tmp/nabaperks-visual-qa/not-found-after/desktop__rootmissing-route.png`
- `/tmp/nabaperks-visual-qa/after-full/mobile__rootr__demo-token.png`
- `/tmp/nabaperks-visual-qa/after-full/desktop__rootmissing-route.png`
- `/tmp/nabaperks-visual-qa/after-full/route-capture-results.json`
- `/Users/amankumarshrestha/.codex/plugins/cache/sisyphuslabs/omo/4.11.1/skills/remove-ai-slops/SKILL.md`
- `/Users/amankumarshrestha/.codex/plugins/cache/sisyphuslabs/omo/4.11.1/skills/programming/SKILL.md`
- `/Users/amankumarshrestha/.codex/plugins/cache/sisyphuslabs/omo/4.11.1/skills/programming/references/typescript/README.md`
- `/Users/amankumarshrestha/.codex/memories/MEMORY.md`

## direct verification performed

- `pnpm exec eslint app/not-found.tsx tests/e2e/not-found-visual.spec.ts`: PASS
- `pnpm typecheck`: PASS
- `pnpm exec playwright test tests/e2e/not-found-visual.spec.ts`: PASS, 2 tests
- Route sweep JSON inspected directly: 192 captures, 64 routes, viewports `mobile`, `tablet`, `desktop`, statuses `200: 183`, `404: 9`, overflow rows `0`, issue rows `0`
- Screenshot metadata inspected directly: checked PNGs are RGB with `hasAlpha: no`
- Pure LOC measured: `app/not-found.tsx` 24, `tests/e2e/not-found-visual.spec.ts` 22

## remove-ai-slops / programming review

Direct slop pass over production code:

- No faked-with-image anti-pattern.
- No one-off design system reimplementation.
- No excessive abstraction or speculative helper.
- No dead code, defensive catch, `any`, type assertion, non-null assertion, or broad error swallowing.
- No oversized file risk.
- The production change is minimal and framework-conventional for Next root `app/not-found.tsx`.

Direct slop pass over tests:

- The tests are not deletion-only and do not merely check that a route was removed.
- The first test guards the missing route visible outcome and absence of the stock Next copy.
- The second test guards the invalid `/r/demo-token` visible outcome.
- The tests are behavior-level Playwright checks, not implementation-mirroring unit assertions.
- Weakness: the focused tests do not assert HTTP status, and only the first test asserts the old default copy is absent. The supplied route sweep evidence does cover status, but this is not represented in the focused regression test.

Programming criteria:

- TypeScript/TSX code is strict and framework-appropriate.
- `export default` is acceptable here because it is a Next.js file convention.
- No public API signatures, boundary parsing, or async error paths were introduced.
- The changed files are far below the 250 pure LOC ceiling.

## blockers

1. Missing required code review report artifact. The supplied packet does not include a code review report path, and no local report was found that explicitly covers the `remove-ai-slops` and `programming` skill-perspective checks. The final gate instructions require rejecting when report coverage is absent, missing, or unsupported.

2. Missing manual QA matrix artifact. The supplied packet includes screenshot paths and route sweep JSON, but not the requested manual QA matrix artifact tying the acceptance dimensions to observed evidence.

3. Missing notepad path. The final gate input was expected to include a notepad path; none was provided or discoverable from the supplied evidence.

4. Claimed changed files are untracked. `git status --short` shows `?? app/not-found.tsx` and `?? tests/e2e/not-found-visual.spec.ts`, so the work is present locally but not part of a tracked diff. This is an approval risk for a "shipped artifact" gate.

5. Alpha evidence gap. The shared diff evidence claims `alphaChannelIntact: true`, but the inspected screenshots are RGB PNGs with `hasAlpha: no`. The rendered UI has no visible alpha defect, but the specific alpha-channel claim is unsupported by the actual capture files.

## exact evidence gaps

- No path to executor notepad.
- No path to code review report.
- No proof that a code review report explicitly evaluated overfit/slop tests, production slop, and programming constraints.
- No path to manual QA matrix for the route sweep.
- No committed/staged diff for `app/not-found.tsx` and `tests/e2e/not-found-visual.spec.ts`; they are currently untracked.
- No rerun of `pnpm qa:visual` by this gate reviewer because `docs/QA_MATRIX.md` states visual QA needs dev server plus DB and mutates demo data; direct review instead inspected the supplied route sweep JSON and screenshots and reran the focused not-found Playwright spec.

