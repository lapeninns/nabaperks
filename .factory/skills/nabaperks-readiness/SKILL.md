---
name: nabaperks-readiness
description: Verify Nabaperks changes against its fast and full autonomous-readiness controls before handoff.
---

# Nabaperks readiness verification

1. Read `AGENTS.md` and identify whether the change affects product code,
   database behavior, browser journeys, or an external provider.
2. Run the smallest targeted test while iterating.
3. Run `pnpm quality:fast` for every code change.
4. Run `pnpm quality:check` when configuration, dependencies, docs, flags, or
   maintainability controls change.
5. Run `pnpm build` before release. Add `pnpm test:db` or `pnpm test:e2e` when
   the affected boundary requires live database or browser evidence.
6. State local, CI, provider, and production proof separately in the handoff.

Do not reintroduce the retired Micro-Spec governance framework. This skill is a
focused verification checklist, not a new delivery methodology.
