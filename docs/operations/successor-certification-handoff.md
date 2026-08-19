# Successor certification handoff

This branch preserves the committed successor remediation lineage and the
documentation needed to resume certification without relying on the dirty
`main` worktree.

## Branch state

- Branch: `codex/successor-remediation-certification`
- Handoff base: `96e1ec4b540be08ddc6140b2f515ea1ecfb29042`
- Tree: `7cca38f19149849a02c4aa6d8f0bd887cf470580`
- Parent: `0ccd99291ed55e5895474da43d429d642b971567`
- Lock SHA-256: `5f730848bfada828ed1e7374502f63dc761f7d68aba484999f1ee6206f79a6c3`
- Certification verdict: **not certified**

The previous automated run was closed as a manual handoff. Twenty-two of 58
top-level plan items were complete and 36 remained unchecked. Skipped work was
not converted into a passing result.

## What this branch contains

- The committed successor remediation history through `96e1ec4b…`.
- Task 21 runtime and matrix repairs from that history.
- This current handoff and the remaining-work checklist.

The local `.omo/evidence/` tree remains intentionally outside Git because it
contains large machine-generated receipts and unresolved PII-shaped findings.
The dirty and untracked files in the `main` worktree were also excluded because
they belong to concurrent user and agent work and were not part of this branch.

## Why automated certification stopped

Task 20A required a fresh exact-SHA replay of Tasks 17–20 before Task 21 could
start. Attempts v4–v7 exceeded the repeated executor input, working-directory,
provenance and control failure threshold. Independent review found no product
source defect in those failures.

A future replay should use one fail-closed declarative controller that:

1. Binds one attempt root and exact working directory.
2. Validates the full SHA, tree, parent and lock hash before every command.
3. Uses the verified 17-name local synthetic environment contract.
4. Supplies both SEO fixture paths explicitly.
5. Persists argv, working directory, timing, process group, exit code and log
   digest for each command.
6. Stops scheduling immediately on a genuine non-zero exit, timeout,
   interruption, drift or cleanup failure.
7. Treats truncated display output as non-authoritative and reads the persisted
   exit receipt once.
8. Cleans only attempt-owned resources and proves zero residue.

Task 21 must remain blocked until Task 20A independently passes.

## Local evidence

The uncommitted local evidence remains under:

```text
.omo/evidence/successor-remediation-certification/20260811T221856Z/
```

The manual handoff summary is stored locally at:

```text
.omo/evidence/successor-remediation-certification/20260811T221856Z/manual-handoff-20260819/summary.md
```

Do not publish evidence until its PII disposition and redaction have been
independently verified.
