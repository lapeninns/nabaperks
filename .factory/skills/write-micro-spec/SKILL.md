---
name: write-micro-spec
description: Author a Micro-Spec through the governance intake station. Use when new feature or tooling work needs a spec before implementation, when the user asks to write, scaffold, or activate a Micro-Spec, or when requested work is not covered by any active spec. Grill the requirements first, slice multi-part features into multiple specs at API seams, scaffold with governance:new-spec, activate with governance:advance.
managed-by: ai-governance-starter-kit
---

# Write Micro-Spec

Turn intent into a small activated contract the engine can enforce: exact
goal, blast radius, EARS requirements, and gates resolved to the risk floor.
A Micro-Spec is implementation input only while `status: active`.

## Workflow

1. **Grill before planning.** Ask one question at a time until you can state
   the goal, non-goals, risk class, blast radius, and first verifiable
   behavior without hand-waving. Give your recommended answer with each
   question so the user can accept, reject, or edit it. Inspect the repo
   instead of asking anything the code can answer. Stop when the remaining
   unknowns can safely be discovered by the first implementation task.
2. **Slice at API seams.** A multi-part feature becomes MULTIPLE Micro-Specs,
   one per seam — each with its own radius, gates, and verifiable outcome. If
   one spec would need three unrelated systems inside its blast radius,
   sharpen the seam and split.
3. **Scaffold:** `<pkg> governance:new-spec --id MS-<area>-<slug> --risk <class> --title "<text>"`.
   The draft's verification gates already satisfy the risk-class floor
   resolved against the repo's real package scripts — extend them, never trim.
4. **Fill the six numbered sections.** Goal as a user-visible outcome;
   blast radius prose agreeing with the frontmatter lists; constraints and
   assumptions; decisions the implementer must not re-litigate; one EARS
   requirement per line; verification criteria as observable behaviors.
   Frontmatter is a strict subset: one line per entry, no wrapped
   continuations, `key: []` inline. `related_tests` are literal existing
   paths or the `not-yet-created` sentinel. Every `implementation_surfaces`
   entry must fall inside the spec's own `allowed_blast_radius`.
5. **Fog-of-war reslice before activation.** Re-read each requirement as if
   you had to implement it next. Any line hiding multiple variables, an
   unproven seam, or "figure it out during implementation" gets split into
   its own requirement — or its own spec — before activation, not after.
6. **Activate:** `<pkg> governance:advance MS-<area>-<slug> --to active`.
   Activation machine-checks the six headings and fully validates the spec
   (reverting the file on failure). Commit the spec and its evidence ledger
   together.

## Rules

- The spec is done when a fresh agent could implement it without this
  conversation — decisions recorded, not implied.
- Blast radius is a permission list, not a prediction: include every path the
  work may touch (docs, tests, evidence), or the implementer will be forced
  to amend the spec mid-flight.
- Never scaffold by hand-copying another spec; the intake station resolves
  gate floors against the live package.json.
- Statuses are machine-owned everywhere: `governance:advance` is the only way
  a spec changes status, starting with this activation.
