# UX/UI Production Polish Fixes Goal

## Goal

Execute the Nabaperks UX/UI production polish fix phase using the audit outputs
and the 354-row coverage ledger as the source of truth.

The executable local OMO plan is:

- `.omo/plans/ux-ui-production-polish-fixes.md`

Note: `.omo/` is intentionally ignored by Git in this repo, so this tracked file
is the durable repository mirror of the goal. The local `.omo/plans/...` file is
the runnable artifact for `$start-work`.

## Paste-Ready Execution Prompt

```text
/goal

$start-work ux-ui-production-polish-fixes

Work in: /Users/amankumarshrestha/LapenInns Project/Nabaperks

Use the executable plan at:
.omo/plans/ux-ui-production-polish-fixes.md

Do not re-plan unless the plan is missing, internally inconsistent, or unsafe to
execute. Treat the ledger as the single source of truth.
```

## Required Inputs

Read all before implementation:

- `.omo/evidence/ux-ui-production-polish-audit/final-report.md`
- `.omo/evidence/ux-ui-production-polish-audit/route-inventory.md`
- `.omo/evidence/ux-ui-production-polish-audit/route-status-matrix.tsv`
- `.omo/evidence/ux-ui-production-polish-audit/findings-*.md`
- `.omo/evidence/ux-ui-production-polish-fixes/lane-manifest.md`
- `.omo/evidence/ux-ui-production-polish-fixes/coverage-ledger.md`
- `.omo/evidence/ux-ui-production-polish-fixes/coverage-ledger.tsv`
- `AGENTS.md`
- `DESIGN.md`
- `app/globals.css`
- `micro-specs/README.md`
- `micro-specs/GLOBAL_CONTEXT.md`
- `Instructions_MircroSpecsCreation.md`
- `Instructions_tdd.md`

## Execution Contract

Every one of the 354 ledger rows must finish with a terminal status:

- `FIXED`: code changed, gates green, re-verified, and Notes include a
  screenshot, spec, or source pointer.
- `DEFERRED`: written reason references a known-deliberate decision or a
  follow-up goal.
- `BLOCKED`: needs a product, legal, ops, credential, or fixture decision; the
  row records options and a recommendation.

Cross-file duplicates collapse to one fix. Every duplicate row must still be
marked `FIXED` with `dup-of <ID>` in Notes.

## Guardrails

- Preserve auth, Supabase/RLS, Stripe, QR, loyalty, billing, webhooks, audit
  trails, and server-authoritative state.
- Wet Ink remains the design contract: `DESIGN.md`, `app/globals.css`, and
  shared foundations.
- Fix through tokens, the unlayered `[data-slot]` layer, wrappers, or variants.
- Do not visually style shadcn primitives directly.
- Do not add raw animation/framer usage outside `components/motion`.
- Use en-GB copy.
- No emoji, no exclamation marks, and no banned signup language on customer
  surfaces.
- Author the required active Micro-Spec or Micro-Specs before product-code
  implementation.
- Use `Instructions_tdd.md` where an active spec and harness exist.

## Required Orchestration

This must not be executed single-threaded.

The coordinator owns the ledger, sequencing, integration, and final verdict.
Implementation is delegated to file-disjoint sub-agents, with no two workers
touching the same files at once.

Execution order:

1. Phase A: read `lane-manifest.md` and both ledgers, confirm 39 coordination
   points and 31 area-fallback rows, and lock file ownership.
2. Phase B: run the consolidation backbone alone for all `C-consolidate` rows.
3. Phase C: run P0/P1 lanes in safe parallelism: legal notices, admin lookup,
   errors, feedback, copy, geometry, targets, and marketing/PWA.
4. Phase D: run the P2 consistency pass.
5. Phase E: run the P3 refinement batch by directory.
6. Phase F: draft the 11 decision rows as options and recommendations, mark
   them `BLOCKED`, and surface them to the user in one batch.
7. Final verification: reconcile ledgers, run gates, recapture screenshots, run
   re-audit, and write the fix report.

## Verification

Run after every phase:

- `pnpm governance:check`
- `pnpm governance:run-gates` when an active spec exists
- `pnpm typecheck`
- `pnpm build`
- `pnpm lint`
- `pnpm tokens:check`
- `pnpm claims:check`
- `pnpm test`
- `pnpm test:a11y` where flows or accessibility changed
- `pnpm test:visual` where layout or visual states changed

Re-capture evidence with a true-viewport Playwright harness at 375, 768, and
1280. Do not rely on `chrome --window-size` for the 375px proof.

Screenshots should go under:

- `.omo/evidence/ux-ui-production-polish-fixes/screenshots/`

## Stop Condition

Stop only when:

1. All 354 ledger rows are `FIXED`, `DEFERRED`, or `BLOCKED`, with zero `todo`
   or `wip` rows.
2. The full gate suite is green, or any remaining non-green item is a named
   environment-only blocker with evidence.
3. 375, 768, and 1280 evidence exists for every touched surface.
4. An independent re-audit sub-agent confirms the updated verdict and names
   remaining blockers.
5. `.omo/evidence/ux-ui-production-polish-fixes/fix-report.md` exists and
   includes shipped work, ledger outcome counts, blocked/deferred rows, evidence
   paths, residual risk, and updated verdict.
