---
name: ship-slice
description: >-
  Execute one Micro-Spec slice in the Nabaperks repo end to end — narrow the
  scope against live code, implement test-first (Red → Green → Refactor), and
  pass the full verification gate before declaring done. Use when asked to
  implement, change, or fix product behaviour here.
---

# Ship a slice

A repeatable workflow for landing a change in this repo without widening scope or
breaking the trust mechanic. Binding rules live in `CLAUDE.md`,
`Instructions_tdd.md`, and `micro-specs/GLOBAL_CONTEXT.md` — this skill is the
operational checklist.

## 1. Narrow the work

- Read the AI governance contract in `micro-specs/README.md`, then find the
  Micro-Spec in `micro-specs/` (or write one with
  `Instructions_MircroSpecsCreation.md`).
- **Inspect live code first** — much is already built. Reduce the task to what is
  still missing. Never widen the spec's blast radius (the files/dirs it may
  touch) without approval.
- Confirm the spec is `active` before implementation. `draft` and `superseded`
  specs require a new active spec or an `approved_exceptions` record before
  Red → Green → Refactor starts.
- Confirm the change preserves the QR / customer / merchant / admin flows and the
  mutation boundary (loyalty writes go through the security-definer RPCs).

## 2. Red — a failing test per in-scope requirement

- Vitest specs in `tests/micro-specs/` (mock Supabase via `tests/helpers/supabase.ts`).
- Postgres invariants RLS/atomicity can't be mocked → SQL in `supabase/tests/`.
- Run it and watch it fail for the right reason:
  `pnpm vitest run tests/micro-specs/<file>.test.ts`

## 3. Green — the smallest code that passes

- Fake It (hardcode) when the algorithm is unclear, then Triangulate with a
  second input. Obvious Implementation only for trivial behaviour.
- Honour the design system: theme via `app/globals.css` tokens + the Wet Ink
  `data-slot` layer; never restyle `components/ui/` primitives. Icons use the
  `@hugeicons` free set via the brand `Icon` wrapper (the `✱` disc stays the
  logo signature only). No emoji, no exclamation marks. Copy is plain, warm,
  en-GB.

## 4. Refactor under green

- Remove duplication only on the third occurrence (Rule of Three). Change
  structure, not behaviour.

## 5. Verification gate (all must pass)

```bash
pnpm lint
pnpm typecheck
pnpm test            # add pnpm test:coverage when touching lib/
pnpm governance
pnpm quality         # naming, debt, N+1, AGENTS.md, complexity, routes, dead/dup code
pnpm build
```

Touched the data layer or RLS? also `pnpm db:verify` and the relevant
`supabase/tests` SQL. Touched a customer surface? a Playwright smoke
(`npx playwright test`). New route or handler? `pnpm docs:routes` and commit
`docs/ROUTES.md`.

## 6. Definition of done

All in-scope Micro-Specs pass; production code satisfies only the required
behaviour; fakes are triangulated away; no out-of-scope functionality, no retired
naming, no new shared staff secrets. Then write the PR using
`.github/pull_request_template.md`.
