# Micro-Spec Creation Instructions

Use a Micro-Spec when work is risky, cross-cutting, user-visible, security
sensitive, data-affecting, billing-affecting, migration-related, or likely to
span multiple files.

## Required frontmatter

Every Micro-Spec under `micro-specs/` except `README.md` and
`GLOBAL_CONTEXT.md` must include:

```yaml
---
spec_id: MS-short-kebab-id
status: draft
risk_class: docs-tooling
owner: team-or-person
last_reviewed: YYYY-MM-DD
allowed_blast_radius:
  - path/or/glob/**
implementation_surfaces:
  - path/or/file
related_tests:
  - tests/path.test.ext
verification_gates:
  - pnpm governance:check
required_playwright_projects: []
evidence_required:
  - Command output or proof artifact required.
approved_exceptions: []
---
```

## Lifecycle

- `draft`: planning only.
- `active`: implementation may proceed and blast-radius checks apply.
- `implemented`: code is complete but not fully verified.
- `verified`: gates and evidence are complete.
- `superseded`: replaced by a newer Micro-Spec.

Only `active` Micro-Specs can authorize implementation.

## Writing rules

- State the user problem, acceptance criteria, out-of-scope items, and risks.
- Keep acceptance criteria testable.
- List exact files or globs in `allowed_blast_radius`.
- Choose the lowest accurate `risk_class`.
- Include validation gates that match repository scripts.
- Add browser, DB, webhook, security, or migration proof only when the risk
  class demands it.
