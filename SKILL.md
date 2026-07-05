---
name: nabaperks-governance
description: Current Nabaperks agent routing and AI governance spine.
---

# Nabaperks Governance Skill

Use this as a lightweight orientation file only. The binding repo guidance lives
in:

- `AGENTS.md`
- `Instructions_MircroSpecsCreation.md`
- `Instructions_tdd.md`
- `micro-specs/README.md`
- `micro-specs/GLOBAL_CONTEXT.md`
- `DESIGN.md`

The CI-enforced gate baseline is the "Current Verification Gates" list in
`micro-specs/README.md` (lint, typecheck, governance checks, node/unit/DB
tests, Playwright e2e/a11y/visual tiers, build and budget checks — the checker
fails when that list drifts from `ci.yml`).

Micro-Spec lifecycle moves only through `pnpm governance:advance`
(`draft -> active -> implemented -> verified -> closed`; `superseded` is the
exit ramp), with `pnpm governance:new-spec` as intake. The station skills in
`.factory/skills/` — write-micro-spec, implement-micro-spec,
close-micro-spec, install-governance — carry the working procedures.
