---
name: ai-governance-starter-kit
description: Install and adapt the AI Governance Starter Kit in any repository. Use when the user asks to add AI governance, Micro-Specs, agent rules, governance checks, or one-prompt governance rollout.
user-invocable: true
disable-model-invocation: false
---

# AI Governance Starter Kit

## Goal

Install a portable governance spine that makes AI-assisted delivery safer,
auditable, and repeatable across repositories.

## Inputs

- Target repository path, default to the current working directory.
- Optional mode:
  - `preview`: inspect and report exact changes.
  - `install`: create files and merge scripts.
  - `force`: overwrite existing governance files after backing them up.

## Workflow

1. Inspect the target repo:
   - Read existing `AGENTS.md`, package scripts, CI workflows, test layout, and stack markers.
   - Detect package manager from `packageManager`, lockfiles, or scripts.
   - Identify validation commands: lint, typecheck, tests, build, e2e, DB, security.
2. Install or merge the starter kit:
   - Copy templates from `ai-governance-starter-kit/templates`.
   - Preserve existing user-owned content by merging when possible.
   - If overwriting is requested, create backups before writing.
3. Adapt generated files:
   - Replace generic placeholders with repo name, stack, package manager, and validation commands.
   - Keep `AGENTS.md` as the primary agent entrypoint.
   - Keep `micro-specs/GLOBAL_CONTEXT.md` repo-specific.
4. Wire scripts:
   - Add `governance:check`.
   - Add `governance:run-gates`.
   - Add `test:micro-specs` when Node's test runner is available.
5. Wire CI:
   - Add governance checks to existing CI when safe.
   - If no CI exists, add a minimal GitHub Actions workflow.
6. Verify:
   - Run package-manager install only if dependencies are missing and the user approved package changes.
   - Run governance checks, typecheck, tests, and build when those scripts exist.
   - Fix generated-file issues before reporting success.

## Fast path

Preview first:

```sh
node ai-governance-starter-kit/install-ai-governance.mjs --preview .
```

Then install when the plan is safe:

```sh
node ai-governance-starter-kit/install-ai-governance.mjs .
```

Use `--force` only after checking `git status` and confirming backups are
acceptable.

The installer detects package manager, stack markers, validation scripts, and
CI wiring. It preserves existing package scripts by default, creates a separate
governance workflow when CI is not already wired, and prints a readiness report
with skips, writes, missing scripts, warnings, and blockers.

## Success criteria

- The repo has `AGENTS.md`, Micro-Spec instructions, `micro-specs/`, governance
  scripts, and a starter active governance Micro-Spec.
- Package scripts include `governance:check` and `governance:run-gates`.
- `governance:check` passes.
- Existing validation commands still pass or failures are clearly attributed to
  pre-existing project issues.
