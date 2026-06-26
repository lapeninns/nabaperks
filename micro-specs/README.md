# AI Governance Index

This folder is the repo-local AI governance spine. It contains current
authoring and lifecycle rules, and it currently contains no active feature
Micro-Specs.

Use it to decide how agents should author, validate, and execute future
Micro-Specs against the current buildable app.

## Source Documents

- `Instructions_MircroSpecsCreation.md` - Product-side Micro-Spec authoring
  rules. The filename is retained for compatibility.
- `Instructions_tdd.md` - Engineering-side Red -> Green -> Refactor workflow.
- `micro-specs/GLOBAL_CONTEXT.md` - reusable project rules and constraints.
- `AGENTS.md` - agent entrypoint for the current app and governance routing.
- `DESIGN.md` - Wet Ink design-system source of truth.

## Current State

There are no active Micro-Spec implementation files in this directory. If a new
feature or governance change needs a Micro-Spec, create a focused file under a
clear area folder, for example:

```text
micro-specs/<area>/<short-slug>.md
```

Keep this folder limited to current governance files and active Micro-Specs
explicitly requested by the user.

## Source-of-Truth Hierarchy

When artifacts disagree, use this order:

1. Live app code, Supabase migrations, and checked-in configuration.
2. `DESIGN.md` for visual language, tokens, and shared component conventions.
3. `AGENTS.md` for agent-facing repo rules.
4. `micro-specs/GLOBAL_CONTEXT.md` for reusable AI governance constraints.
5. Active Micro-Spec files created under `micro-specs/`.
6. `Instructions_MircroSpecsCreation.md` and `Instructions_tdd.md` for
   authoring and implementation workflow.

Only current checked-in files in this hierarchy are implementation truth.

## Micro-Spec Metadata Schema

Every implementation-ready Micro-Spec must start with this YAML block:

```yaml
spec_id: MS-<area>-<slug>
status: draft | active | implemented | verified | superseded
risk_class: docs-tooling | ui-only | product-analytics | customer-pii | auth-session | billing | webhooks | rls-rpc-ledger | migrations
owner: <person-or-agent>
last_reviewed: YYYY-MM-DD
allowed_blast_radius:
  - <repo-local path or glob>
implementation_surfaces:
  - <repo-local path or glob>
related_docs:
  - <repo-local path>
related_tests:
  - <repo-local path or "not-yet-created">
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
approved_exceptions: []
```

## Lifecycle Status Vocabulary

- `draft`: intent can be refined, but implementation must not start.
- `active`: ready for Engineering after reconciliation against live code.
- `implemented`: code exists and required checks have been run, but final
  review evidence is not complete.
- `verified`: implementation evidence, review notes, and required gates are
  complete.
- `superseded`: non-current and blocked for implementation unless a new active
  spec or approved exception says otherwise.

## Lifecycle Transition Policy

| From | To | Required evidence |
| --- | --- | --- |
| `draft` | `active` | Complete metadata, EARS requirements, risk class, blast radius, and verification gates. |
| `active` | `implemented` | Requirement IDs mapped to checks, Red -> Green -> Refactor evidence where applicable, and in-scope files only. |
| `implemented` | `verified` | Passing gates, review notes, and manual QA evidence when the changed surface is user-visible. |
| `active` | `superseded` | Supersession link or rationale. |
| `implemented` | `superseded` | Replacement spec or explicit product decision. |

Draft and superseded specs are not valid implementation inputs.

## Risk Rubric

| risk_class | Applies to | Minimum posture |
| --- | --- | --- |
| `docs-tooling` | Governance docs, scripts, CI, templates, and review records. | CLI-first checks; no runtime product changes. |
| `ui-only` | Visual or copy changes without data mutation changes. | Automated checks plus browser/manual evidence for the changed surface. |
| `product-analytics` | Event naming, funnels, reports, and PostHog mirrors. | Preserve source-of-truth writes and event contracts. |
| `customer-pii` | Customer phone, consent, identity, profile, or privacy surfaces. | Prove unnecessary personal data is not exposed. |
| `auth-session` | Merchant, customer, admin, cookie, OTP, or session behavior. | Runtime and security-sensitive evidence for user flows. |
| `billing` | Stripe checkout, portal, subscription sync, or entitlement gates. | Build evidence plus webhook and entitlement checks. |
| `webhooks` | Stripe or future inbound webhook handlers. | Signature verification, idempotency, and database readback. |
| `rls-rpc-ledger` | Supabase RLS, RPCs, loyalty ledger, fraud, or audit invariants. | Real database evidence for invariants mocks cannot enforce. |
| `migrations` | Supabase migrations or schema changes. | Migration replay/idempotency checks on a disposable database. |

## Current Verification Gates

The current tracked repo keeps only the build-facing gates:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Use only the gates listed above unless a new active Micro-Spec explicitly adds a
governance, test, database, security, or browser automation harness as part of
its approved blast radius.

## Working Rule

Before implementing any active Micro-Spec, inspect the live repo and narrow the
task to requirements that are not already satisfied. If the spec conflicts with
buildable code, stop and reconcile the spec before editing production files.
