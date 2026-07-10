---
name: implement-micro-spec
description: Implement the active Micro-Spec test-first under the governance gates. Use when starting or resuming implementation of an active spec, when the user asks to build what a spec describes, or right after write-micro-spec activates one. Narrow first, red -> green -> refactor, record proof with governance:run-gates, advance to implemented.
managed-by: ai-governance-starter-kit
---

# Implement Micro-Spec

Build the active spec to completion, one requirement at a time, leaving a
machine-readable evidence trail. The spec is the source of truth — and when
the code proves the spec stale, the spec gets amended first.

## Workflow

1. **Narrow first.** Read the spec, then inspect the live repo and cut the
   task list to requirements not already satisfied. If the spec conflicts
   with buildable code, stop and reconcile the spec before editing
   production files.
2. **Red:** write the test that proves the next requirement is missing, and
   watch it fail for the right reason. **Green:** the smallest change inside
   `allowed_blast_radius` that passes it. **Refactor:** collapse any shims or
   duplication the pass introduced while the gates stay green.
3. **Use focused feedback while converging.** After each Red -> Green step,
   run the narrowest tests that cover the requirement and directly affected
   contract. A Git commit is a checkpoint, not a reason to rerun every full
   gate or write a new evidence-ledger entry.
4. **Record proof at a coherent boundary:**
   `<pkg> governance:run-gates --spec MS-<area>-<slug> --record`
   writes the run into the spec's evidence ledger. When one change makes
   several specs stale, repeat `--spec <id>` in the same command; the runner
   executes their exact-command union once and attributes per-spec evidence.
   Recorded red runs remain honest history, not something to delete.
5. **Amend the spec first** when reality diverges: adjust requirements,
   radius, or gates in the spec file (body edits are sanctioned; the
   `status:` line is machine-owned), then continue implementing against the
   amended contract.
6. **Loop.** A green commit is a checkpoint, not permission to stop — go
   straight back to the next unsatisfied requirement until every EARS line
   and verification criterion is met.
7. **Advance:** on a clean tree,
   `<pkg> governance:advance MS-<area>-<slug> --to implemented`
   runs the declared gates fresh, enforces the branch diff against the
   spec's radius, and records the transition. Commit the spec and ledger
   together. Hand the shipped spec to close-micro-spec when review evidence
   is complete.

## Rules

- Never edit outside the spec's `allowed_blast_radius`; if the work genuinely
  needs another path, amend the radius (and say why) before touching it.
- Never weaken a declared gate or repin a failing contract to get green;
  prove the old contract wrong in the spec first.
- Dirty-tree advances need `--allow-dirty --note` and leave a waiver debt the
  checker collects on; prefer committing first.
- Done means the spec's verification criteria are observable in the running
  repo, the ledger's latest run covers every declared gate with exit 0, and
  the status line says `implemented` because the machine wrote it.
