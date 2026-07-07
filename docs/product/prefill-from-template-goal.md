# Prefill From Template — Implementation Program Goal

## Goal

Extend Nabaperks' existing "show a suggested default, persist nothing until the
user explicitly saves" pattern to the merchant surfaces that were left blank, and
fix the one place that persists template content **without** a save. This program
turns the prefill-from-template audit into governed, shipped Micro-Specs.

The program invariant, applied to every spec below:

> Template/default content is rendered into the form only. It becomes durable
> state **exclusively** through the user's explicit Save/Send/Add action. No
> auto-save, optimistic write, or on-render seed of template content.

## Source of Truth

- Live app code, Supabase migrations, and this charter.
- The originating audit identified six work items (the table below). Each becomes
  its own `active` Micro-Spec authored per `Instructions_MircroSpecsCreation.md`
  and implemented test-first per `Instructions_tdd.md`, under the
  `micro-specs/README.md` governance contract.

## Locked Decisions (owner, 2026-07-07)

1. **Reward-pool auto-seed → no-persist true prefill.** The pool starts empty; the
   business-typed reward templates populate the editor and save only when the
   merchant clicks Add. This deliberately changes the launch funnel (a merchant
   must explicitly add ≥3 active rewards to unlock the QR) and is the whole point
   of MS-prefill-reward-pool-seed.
2. **New template copy is agent-drafted for owner review.** Announcement and
   birthday-reward template strings are written in en-GB Wet Ink voice inside each
   spec's plan for the owner to approve before the spec ships.
3. **Scope is all six specs.**

## Micro-Specs (sequenced low-risk → high-risk)

| # | spec_id | risk_class | Primary surface | What | Priority |
|---|---------|-----------|-----------------|------|----------|
| 1 | `MS-prefill-card-name` | `ui-only` | `components/merchant/launch/card-panel.tsx` | Business-personalise the new-card name default (`{business} Mystery Card`) instead of the hardcoded `"Mystery Visit Card"` | Low |
| 2 | `MS-prefill-announcement-templates` | `ui-only` | `components/merchant/announcements/announcement-compose.tsx` | Quick-fill announcement templates (title + body) for the recurring venue updates | High |
| 3 | `MS-prefill-send-reward` | `ui-only` | `components/merchant/send-reward-form.tsx` | Prefill reward name/terms from preset chips (and reuse-last where cheap) | High |
| 4 | `MS-prefill-birthday-reward` | `ui-only` | `components/merchant/launch/birthday-reward-form.tsx` | Business-typed birthday name/terms prefill + stop persisting template copy on a disabled save | High |
| 5 | `MS-prefill-admin-note` | `ui-only` | `app/admin/pilot/page.tsx` | Note-type-driven scaffold for the pilot note textarea (placeholder, not value) | Medium |
| 6 | `MS-prefill-reward-pool-seed` | `rls-rpc-ledger` | `lib/merchant/seed-default-reward-pool.ts`, `components/merchant/launch/rewards-panel.tsx` | Remove the on-render DB auto-seed; prefill the editor from business-typed presets instead | High |

All six live under `micro-specs/prefill/**`.

## Extend, Don't Reinvent

- `lib/merchant/reward-presets.ts` — the reusable business-typed template object
  (`rewardPresetsForBusinessType`). New template constants mirror this shape.
- `lib/merchant/loyalty-card-copy.ts` — the computed-template + "is-still-default"
  detector. The gold-standard pattern the new prefills copy.
- New template/derivation logic lands in `lib/**` with `node --test` unit tests so
  `pnpm test:coverage` (lib ≥80/80/70) stays green; UI wiring is proven with the
  existing DB-free Playwright harnesses.
- e2e harnesses to extend: `@reward-presets`
  (`tests/e2e/merchant-reward-presets-flow.ts`), `@merchant-announcements`
  (`tests/e2e/merchant-announcements-flow.ts`), `@merchant-flow`
  (`tests/e2e/merchant-send-reward.spec.ts`).

## Guardrails (in addition to `AGENTS.md` + `micro-specs/GLOBAL_CONTEXT.md`)

- The program invariant above is non-negotiable and is the primary EARS line of
  every spec.
- Wet Ink is the design contract; en-GB copy; no emoji, no exclamation marks, no
  banned claims (`pnpm tokens:check`, `pnpm claims:check`).
- Server-authoritative loyalty/billing state; no new dependencies; changes stay
  inside each spec's declared blast radius.
- Template copy is owner-reviewable before it ships.

## Verification (per spec)

- Each spec declares the risk-class gate floor from `micro-specs/README.md`.
  Browser gates are grep/project-scoped to the feature's own tag and the
  `chromium` + `mobile-safari` projects, matching the house authoring rule.
- `MS-prefill-reward-pool-seed` (rls-rpc-ledger) additionally declares
  `pnpm test:db` — the auto-seed removal is proven against a live database, not a
  browser harness.
- Visual note: any resting-state change captured by a `@visual` test needs a
  baseline refresh. The CI `-linux` twin snapshots can only be blessed from a CI
  run, so those steps land on push and are recorded per spec rather than blocked.

## Execution Contract (per spec)

`governance:new-spec` (draft) → author the six sections → `governance:advance --to
active` → TDD red → green → refactor (`Instructions_tdd.md`) →
`governance:run-gates --spec <id> --record` → `--to implemented` → `--to verified`
→ `--to closed` (body rewritten to the closed-record contract). One spec reaches a
committed, gate-green state before the next begins (the advance step requires a
clean tree scoped to that spec's radius).

## Stop Condition

Stop only when every spec is `closed` — or `verified` with a single named,
evidenced CI-only step remaining (a `-linux` visual twin or a `SUPABASE_DB_URL`
DB run) — the full gate suite is green or blocked-with-evidence, and this charter's
spec table is reconciled to the final statuses.
