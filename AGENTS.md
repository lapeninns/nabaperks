# Nabaperks Agent Guide

This repo is a buildable Next.js app with a retained Wet Ink design system and
a CI-enforced AI governance spine.

## Stack

| Layer | Current surface |
| --- | --- |
| Frontend | Next.js App Router, React, Tailwind CSS 4 |
| UI system | `DESIGN.md`, `app/globals.css`, `components/brand`, `components/ui`, `components/motion`, `components/loyalty` |
| Backend | Next.js Route Handlers and Server Actions |
| Database | Supabase Postgres migrations under `supabase/migrations` |
| Auth | Supabase Auth and RLS |
| Payments | Stripe Billing and webhooks |
| Notifications | Resend email, Web Push support, Twilio later |
| Hosting | Vercel |

## Working Rules

- Keep the app buildable. Verify meaningful code changes with
  `pnpm governance:check`, `pnpm typecheck`, and `pnpm build`; add
  `pnpm governance:run-gates` when an active Micro-Spec is driving the work.
- Use focused tests while a change is converging. Run complete recorded gates
  at coherent proof/lifecycle boundaries, not after every Git commit; when a
  shared change affects several specs, batch them by repeating `--spec <id>`.
- Treat the design system as the durable product contract. Preserve
  `DESIGN.md`, `app/globals.css`, and the shared component foundations.
- Treat `micro-specs/README.md`, `micro-specs/GLOBAL_CONTEXT.md`,
  `Instructions_MircroSpecsCreation.md`, and `Instructions_tdd.md` as
  governance only unless an active Micro-Spec exists. Only `status: active`
  Micro-Specs can drive implementation.
- Keep governance current-only. Add planning packs, generated route docs,
  screenshot evidence folders, design-source mirrors, or `.omo` evidence files
  only when the user explicitly asks for them.
- Micro-Spec statuses are machine-owned: scaffold with
  `pnpm governance:new-spec`, move the lifecycle only with
  `pnpm governance:advance` (`draft -> active -> implemented -> verified ->
  closed`; `superseded` is the exit ramp). Closing rewrites the body into a
  rationale record the checker validates — see the close-micro-spec station
  skill and `micro-specs/README.md`, "Closed-Record Contract".
- Read the relevant Next.js 16 guide in `node_modules/next/dist/docs/` before
  changing app-router APIs, route handlers, server actions, or config.
- Server state remains authoritative. Browser storage is cache only; loyalty and
  billing-affecting changes must stay server-side and auditable. Browser-only
  Playwright proof does not count as DB/RLS/webhook/billing proof.

## Design System

Wet Ink is the active visual language: warm paper, hard ink borders, offset
shadows, short British copy, and stamp-led interactions. Runtime styling lives
in `app/globals.css` and the shared components; design-tool exports are not
tracked runtime inputs.

## AI Governance

The governance spine is deliberately small and enforceable:

- `Instructions_MircroSpecsCreation.md` defines how to author future
  Micro-Specs.
- `Instructions_tdd.md` defines the implementation workflow when an active spec
  and its required harness exist.
- `micro-specs/README.md` is the governance index, lifecycle policy, and current
  risk-gate/CI contract.
- `micro-specs/GLOBAL_CONTEXT.md` holds reusable project constraints.
- `scripts/check-governance.mjs` validates metadata, risk gates, blast radius,
  docs drift, evidence ledgers, closed-record contracts, and safe gate-command
  shapes.
- `scripts/run-governance-gates.mjs` runs active Micro-Spec verification gates
  (`--spec <id> --record` writes the evidence ledger).
- The station skills mirrored into `.factory/skills/` (write-micro-spec,
  implement-micro-spec, close-micro-spec, install-governance) carry the
  authoring, implementation, and closing procedures; the canonical copies
  live in `ai-governance-starter-kit/skills/`.

There are currently no active feature Micro-Specs checked in. The active
docs-tooling Micro-Spec is `micro-specs/governance/ai-delivery-framework.md`.
Do not treat absent spec paths as implementation input.
