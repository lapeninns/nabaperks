---
name: ai-governance-starter-kit
description: Install and adapt the AI Governance Starter Kit in any repository. Use when the user asks to add AI governance, Micro-Specs, agent rules, governance checks, blast-radius enforcement, or a one-prompt governance rollout.
user-invocable: true
disable-model-invocation: false
---

# AI Governance Starter Kit

Install a portable, CI-enforced **AI software factory**: spec intake → TDD →
gates → machine-readable evidence → machine-enforced lifecycle → CI audit
trail, in any repository, with zero dependencies.

## What it installs

- `AGENTS.md` — agent entrypoint and working rules.
- `Instructions_MicroSpecsCreation.md` / `Instructions_tdd.md` — how to author
  Micro-Specs (EARS) and implement them (Red → Green → Refactor).
- `micro-specs/` — governance index, risk-gate matrix, `GLOBAL_CONTEXT.md`, and a
  starter **active** Micro-Spec.
- `scripts/` — the enforcement engine (strict frontmatter parser, engine-fixed
  glob dialect, `check-governance.mjs`, `run-governance-gates.mjs`) plus the
  factory stations: `new-spec.mjs` (intake), `advance-spec.mjs` (lifecycle),
  `governance-evidence.mjs` (tracked gate-run ledgers).
- A `governance` CI workflow (added only when CI does not already run it),
  with step-summary audit output on every run.

The engine enforces, per pull request: strict Micro-Spec metadata (parse
failures carry file:line), a risk-class gate floor (high-risk work must
declare durable non-browser-only proof), **blast-radius** (changed files must
fall inside an active spec's allowlist, with per-spec attribution),
bidirectional docs-drift between CI and the README gate list, exception
expiry, active-spec review freshness, and — once adopted — the **evidence
ledger**: implemented/verified statuses must be reached by a recorded
`governance:advance` transition whose latest gate run covers the declared
gates. Hand-flipped statuses and doctored ledgers fail.

## Factory loop (after install)

```sh
<pkg> governance:new-spec --id MS-<area>-<slug> --risk <class> --title "..."
<pkg> governance:advance MS-<area>-<slug> --to active
# implement test-first per Instructions_tdd.md, then:
<pkg> governance:run-gates --spec MS-<area>-<slug> --record   # proof as you go
<pkg> governance:advance MS-<area>-<slug> --to implemented    # fresh gates + ledger
<pkg> governance:advance MS-<area>-<slug> --to verified --attest "..." --ack "..."
```

## Upgrading an existing install

Re-run the installer with `--upgrade`: engine-owned files (scripts, the two
instruction guides, the kit workflow) are refreshed in place with `.bak`
backups; seed files the repo adapts (`AGENTS.md`, `GLOBAL_CONTEXT.md`, the
governance README, specs, and `governance-constants.mjs` — the per-repo
tuning point) are never overwritten. The report prints the installed vs
shipped `KIT_VERSION` and a post-upgrade review list.

## This skill is self-contained

The installer and templates are bundled **next to this file** under
`ai-governance-starter-kit/`. Do not assume the target repo already has them.
Resolve the installer by the absolute path of the directory containing this
SKILL.md — call it `SKILL_DIR` — and run it against the target repo:

```sh
# SKILL_DIR = the folder holding this SKILL.md (e.g. the skill's install path).
# TARGET    = the repository to install into (default: current directory).
node "$SKILL_DIR/ai-governance-starter-kit/install-ai-governance.mjs" --preview "$TARGET"
node "$SKILL_DIR/ai-governance-starter-kit/install-ai-governance.mjs" "$TARGET"
```

If you cannot determine `SKILL_DIR` from context, locate the installer:

```sh
find "$HOME/.claude/skills" "$PWD/.factory/skills" -name install-ai-governance.mjs 2>/dev/null | head -1
```

## Workflow

1. **Inspect the target repo.** Read any existing `AGENTS.md`, `package.json`
   scripts, CI workflows, and test layout. Note the package manager and which
   validation scripts exist (lint, typecheck, test, build, and any
   durable-proof scripts such as `test:db` / `test:integration` / `test:e2e`).
2. **Preview.** Run the installer with `--preview` and read the plan (writes,
   skips, missing scripts, CI wiring, blockers). Resolve blockers first.
3. **Install.** Run without `--preview`. It copies templates, merges
   `governance:check` / `governance:run-gates` / `governance:new-spec` /
   `governance:advance` / `test:micro-specs` scripts
   (preserving any the repo already defines), and adds a governance workflow
   when CI is not already wired. Use `--force` only after checking `git status`;
   it backs up overwritten files.
4. **Adapt the generated files** (see checklist below). Generic placeholders are
   a starting point, not the finished spine.
5. **Verify.** Run the governance check plus the repo's own lint/typecheck/test/
   build. Fix generated-file issues before reporting success.

## Adaptation checklist

- Fill `micro-specs/GLOBAL_CONTEXT.md`: product context, settled stack, security
  baseline, and the real validation commands.
- Refine the `AGENTS.md` Stack section with the true runtime/backend/auth/hosting.
- Keep the risk classes generic and repo-agnostic unless the repo genuinely
  needs domain classes; map each area of the codebase to a class.
- For high-risk classes (`data-model`, `auth-session`, `billing`, `webhooks`,
  `migrations`), ensure a durable-proof script exists and the active spec
  declares it — or record a dated `approved_exceptions`. Browser-only proof does
  not count.
- Keep `micro-specs/README.md` "Current Verification Gates" in sync with the CI
  workflow (the checker fails on drift).

## Success criteria

- The repo has `AGENTS.md`, the two instruction guides, `micro-specs/` with an
  active starter spec, the governance scripts, and a governance CI workflow.
- `package.json` exposes `governance:check` and `governance:run-gates`.
- The governance check passes, and blast-radius enforcement is live in CI
  (workflow checks out full history so PRs diff against the base branch).
- The repo's existing validation commands still pass, or failures are clearly
  attributed to pre-existing project issues.

## Maintainers

The canonical kit lives in the repo at `ai-governance-starter-kit/`. After
editing it, re-sync the self-contained bundles:

```sh
node scripts/sync-skill-bundles.mjs              # refresh the in-repo .factory bundle
node scripts/sync-skill-bundles.mjs --claude-home # also refresh ~/.claude/skills
```

A drift-guard test (`tests/micro-specs/skill-bundle-sync.test.mjs`) fails CI if
the bundle and source diverge.
