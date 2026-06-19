recommendation: REJECT

blockers:
- Required final-gate evidence is incomplete. No code review report artifact was supplied and none was found under `.omo/`, so I cannot confirm the required reviewer coverage for `omo:programming` and `omo:remove-ai-slops`.
- No notepad path was supplied.
- No scoped manual QA matrix artifact was supplied for the not-found visual fix. The screenshot sweep artifacts are present and useful, but they are automated capture evidence rather than the requested manual QA matrix.

originalIntent:
- Run `omo:visual-qa` across all routes in the Nabaperks Next.js app.
- Fix the unbranded default Next.js 404 shown on missing URLs and invalid dynamic tokens.
- Add a branded Wet Ink not-found surface so `/missing-route`, `/r/demo-token`, and other invalid routes no longer show the raw framework fallback.

desiredOutcome:
- Missing and invalid routes render a branded Nabaperks/Wet Ink not-found surface.
- The new surface is visually consistent across mobile, tablet, and desktop.
- It has no horizontal overflow, clipping, text overlap, tofu glyphs, or awkward wrapping.
- Tests and visual QA evidence demonstrate the default framework copy is gone.

userOutcomeReview:
- Visual fidelity result: PASS.
- CJK precision result: PASS, with no CJK content in scope and no English clipping/orphan wrapping observed.
- Direct screenshots show the bad old mobile `/r/demo-token` fallback was the default white `404 | This page could not be found.` screen, while the after screenshots show a warm paper background, centered compact mark, dashed bordered card, icon, `Page not found` heading, clear body copy, and vermillion `Back to Nabaperks` button.
- The implementation uses existing live components (`Logo`, `EmptyState`, `Button`) rather than a pasted image or mock-only composition.
- The final recommendation is still REJECT because the required final-gate evidence packet is missing the code review report, notepad path, and scoped manual QA matrix.

checkedArtifactPaths:
- `AGENTS.md`
- `app/not-found.tsx`
- `tests/e2e/not-found-visual.spec.ts`
- `components/brand/logo.tsx`
- `components/brand/typography.tsx`
- `components/brand/index.ts`
- `components/ui/button.tsx`
- `components/ui/empty.tsx`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`
- `/tmp/nabaperks-visual-qa/mobile__rootr__demo-token.png`
- `/tmp/nabaperks-visual-qa/not-found-after/mobile__rootr__demo-token.png`
- `/tmp/nabaperks-visual-qa/not-found-after/tablet__rootr__demo-token.png`
- `/tmp/nabaperks-visual-qa/not-found-after/desktop__rootmissing-route.png`
- `/tmp/nabaperks-visual-qa/after-full/mobile__rootr__demo-token.png`
- `/tmp/nabaperks-visual-qa/after-full/desktop__rootmissing-route.png`
- `/tmp/nabaperks-visual-qa/not-found-after/results.json`
- `/tmp/nabaperks-visual-qa/after-full/route-capture-results.json`

diffReview:
- `app/not-found.tsx` is a new 26-line root Next.js `not-found` file. Local Next docs state root `app/not-found` handles expected `notFound()` errors and unmatched URLs for the whole application.
- `tests/e2e/not-found-visual.spec.ts` is a new 26-line Playwright spec covering `/missing-route` and `/r/demo-token` with role-based assertions for the branded heading and link. It also asserts the default framework copy is absent on the missing-route case.
- No unnecessary production extraction, parser, normalization layer, speculative abstraction, or oversized module was introduced.
- The test is narrow but not tautological: it asserts observable route behavior and guards the exact regression class, while visual screenshots cover the style outcome.

scriptEvidenceReview:
- Image diff evidence was consumed: dimensions matched at 390x844, `diffRatio` was `0.9993`, `similarityScore` was `0`, `alphaChannelIntact` was `true`, and the hotspots were full-frame. This is expected because the reference was the bad default framework fallback and the actual was the desired branded UI.
- Post-fix all-route evidence was inspected from `/tmp/nabaperks-visual-qa/after-full/route-capture-results.json`: 192 PNG captures exist for 64 routes across mobile, tablet, and desktop.
- Normalized route sweep check found zero overflow records.
- All 404 records in the sweep for `/missing-route`, `/merchant/demo-merchant/terms`, and `/r/demo-token` across mobile/tablet/desktop reported status `404`, heading `Page not found`, and `overflow.overflows: false`.

evidenceTrace:
- Full-frame image-diff hotspots: caused by replacing the raw white Next.js 404 page with the warm paper branded Wet Ink surface. This is intended, not a regression.
- Mobile after screenshot: card, icon, heading, description, and button are centered; copy wraps cleanly within the constrained card; no horizontal overflow.
- Tablet after screenshot: same composition scales without oversized typography, clipping, or overlap.
- Desktop missing-route screenshot: same centered composition with constrained max width; no blank/default white framework surface.
- Alpha evidence: `alphaChannelIntact: true`; no unexpected black/opaque transparency artifact observed in opened PNGs.

findings:
- None for visual fidelity or CJK precision.

exactEvidenceGaps:
- Missing code review report artifact. Required because final-gate instructions demand confirmation that the review explicitly covers the same skill perspective and overfit/slop criteria.
- Missing notepad path.
- Missing scoped manual QA matrix artifact for this change.
- Command results (`pnpm typecheck`, lint, Playwright e2e, `pnpm qa:visual`) were supplied in the prompt but no log artifact path was supplied. I did not rerun them because this review was read-only.
- LSP diagnostics could not be used because the TypeScript LSP is not installed in this environment; local `pnpm typecheck` was reported as passed but not independently rerun.
