---
name: close-micro-spec
description: Close a shipped Micro-Spec by rewriting it from a build plan into a durable rationale record, then advancing verified -> closed. Use when an implemented spec's work has shipped and review evidence is complete, when the user says a spec or feature is finished, or when a closed record needs healing after a rename breaks its pointers.
managed-by: ai-governance-starter-kit
---

# Close Micro-Spec

A spec is a build plan while you build and a rationale record once you ship.
Closing flips it: the code becomes the only source of *how*; the closed spec
keeps the *why*, the invariants, and a pointer map into the code. Do not
summarize the implementation — anyone can read the code; if a paragraph
restates what a function does, cut it and point at the function.

## Workflow

1. **Confirm it shipped.** Status is `implemented`, the gates are green, and
   the ledger's latest run covers every declared gate. Unfinished work gets
   finished, not closed.
2. **Verify:** `<pkg> governance:advance MS-<area>-<slug> --to verified`
   with `--attest "<manual-gate> by <who>: <note>"` for each declared
   `manual:*` gate and `--ack "<item>"` for each `evidence_required` entry
   (exact trimmed text — the CLI refuses mismatches and extras). Commit the
   spec and ledger together.
3. **Diff plan against reality.** Read what the spec predicted, then what
   landed. The divergences — dropped tasks, renamed seams, assumptions that
   broke — are the most valuable thing to record; a future reader would
   otherwise re-derive them.
4. **Rewrite the body in place** (same file — no archive move). Replace the
   six numbered sections with the closed-record shape the engine validates:
   - `## Why It Exists` — the problem and why this shape, present tense.
   - `## Invariants` — what must stay true; what silently breaks if violated.
   - `## Code Pointers` — dash lines, each carrying at least one
     backtick-wrapped repo path that exists (file or directory — directory
     pointers survive file renames); bare symbols and URLs read as prose.
   - `## Dead Ends` — approaches tried and rejected, with reasons. Required
     even as "None." — the attestation is the point.
   Cut task breakdowns, "will/next" prose, and anything the code can answer.
   Drop the `not-yet-created` sentinel from `related_tests` and remove spent
   `approved_exceptions`.
5. **Unbiased claim audit — before advancing.** Spawn fresh subagents that
   did not write the record and lack this conversation; split the claims
   across them and have each return a verdict per statement against the real
   code and tests: pointers resolve and say what the record says; invariants
   are enforced, not just asserted; no leftover plan tense. Fix and re-audit
   changed claims until every statement survives.
6. **Close:** `<pkg> governance:advance MS-<area>-<slug> --to closed`.
   The CLI validates the record (refusing before gates on any missing
   heading, lingering plan heading, dead pointer, or sentinel), runs the
   gates fresh, and records the transition. Commit the spec and ledger
   together. From here the only transition is `superseded`.

## Healing a stale closed record

Renames rot pointers, and the checker fails a closed spec whose pointer no
longer resolves — deliberately. Hand-edit the record (body edits are
sanctioned; the `status:` line is not), prefer a directory pointer when the
file name is volatile, then re-prove with
`<pkg> governance:run-gates --spec MS-<area>-<slug> --record` and commit.

## Deliberate divergences from dzhng's close-spec

- No `specs/done/` move: Micro-Spec paths are load-bearing (blast-radius
  globs, related_tests, ledger mapping) — `closed` is a status, not a
  location.
- No visual-provenance section: evidence stays tracked JSON; binary evidence
  is never committed.

## Smell Test

- Could a reader reconstruct the paragraph from the code? Cut it, leave a
  pointer.
- Says "will" or "next", or names a task number? Still a plan — keep
  rewriting.
- A real decision diverged from the plan and went unrecorded? That is the one
  thing worth keeping; add it.
