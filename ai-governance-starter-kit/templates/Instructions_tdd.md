# TDD and Implementation Instructions

Use this workflow when an active Micro-Spec drives implementation.

## Workflow

1. Read `AGENTS.md`, `micro-specs/GLOBAL_CONTEXT.md`, and the active
   Micro-Spec.
2. Confirm the requested files are inside `allowed_blast_radius`.
3. Add or update the smallest useful test first when the change is testable.
4. Implement the minimum production change needed to pass.
5. Refactor only after tests pass.
6. Run every gate listed in the active Micro-Spec.
7. Do not mark the work complete until gates pass or the user explicitly
   accepts documented failures.

## Safety rules

- Never use browser-only proof for data, auth, billing, webhook, migration, or
  permission guarantees.
- Never broaden blast radius silently. Update the active Micro-Spec first.
- Never add fake no-op validation scripts to make governance pass. If a repo
  lacks a gate, document the exception in the Micro-Spec.
- Never commit secrets, logs, local env files, or generated artifacts unless
  explicitly required.
