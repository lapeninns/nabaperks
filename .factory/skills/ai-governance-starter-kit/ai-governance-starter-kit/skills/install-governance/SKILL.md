---
name: install-governance
description: Install or upgrade the AI Governance Starter Kit in a target repository. Use when the user asks to add AI governance, Micro-Specs, governance checks, or blast-radius enforcement to a repo, wants a one-prompt governance rollout, or needs an existing install upgraded to the current kit.
managed-by: ai-governance-starter-kit
---

# Install Governance

Install the portable, CI-enforced governance factory — intake, gates,
evidence ledger, lifecycle — into any repository, with zero dependencies.

## Workflow

1. **Locate the installer.** It ships next to the kit skill, never assume the
   target repo has it:
   `find "$HOME/.claude/skills" "$PWD/.factory/skills" -name install-ai-governance.mjs 2>/dev/null | head -1`
2. **Inspect the target repo.** Existing `AGENTS.md`, `package.json` scripts,
   CI workflows, test layout, package manager, and any durable-proof scripts
   (`test:db` / `test:integration` / `test:e2e`).
3. **Preview:** `node <installer> --preview "$TARGET"` and read the plan
   (writes, skips, warnings, blockers). Resolve blockers first.
4. **Install:** run without `--preview`. It copies the templates, merges the
   `governance:*` scripts (preserving any the repo defines), plants the four
   station skills in `<target>/.claude/skills/` (`--no-skills` opts out), and
   adds a governance CI workflow only when CI is not already wired.
5. **Adapt the seed files.** Fill `micro-specs/GLOBAL_CONTEXT.md` with the
   real product context and validation commands; true up the `AGENTS.md`
   stack section; map codebase areas to risk classes; for high-risk classes
   ensure a durable-proof script exists (or record a dated
   `approved_exceptions` entry). Keep the README gate list equal to what CI
   runs — the checker fails on drift.
6. **Verify.** The governance check passes, `governance:check` and
   `governance:run-gates` exist in `package.json`, and the repo's own
   lint/typecheck/test/build still pass (or failures are clearly
   pre-existing).

## Upgrading

Re-run with `--upgrade`: engine-owned files (`scripts/` engine, instruction
guides, kit workflow, suite skills) are refreshed in place with
`.bak.<timestamp>` backups; seed files the repo adapts (`AGENTS.md`,
`GLOBAL_CONTEXT.md`, the governance README, specs, and
`governance-constants.mjs` — the per-repo tuning point) are never
overwritten. Afterwards: diff constants against the template for new keys,
reconcile the README gate matrix, review and delete the `.bak` files (the
blast-radius check flags them until deleted).
