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

The current tracked repo keeps only build-facing gates:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Use only the current checked-in gates unless a new active Micro-Spec explicitly
adds the required test, database, security, or browser automation harness inside
its approved blast radius.
